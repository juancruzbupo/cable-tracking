import { Injectable, Logger } from '@nestjs/common';
import { ClientStatus, ServiceType } from '@prisma/client';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/es';
import { PrismaService } from '../../common/prisma/prisma.service';

dayjs.extend(relativeTime);
dayjs.locale('es');
import { ClientsService, ClientDebtInfo } from '../clients/clients.service';
import { calcularPrecioConPromo } from '../../common/utils/promotion-calculator.util';

const CACHE_TTL = 60_000;
const MONTH_LABELS = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);
  private cache: Map<string, { data: any; expiresAt: number }> = new Map();

  constructor(
    private readonly prisma: PrismaService,
    private readonly clientsService: ClientsService,
  ) {}

  invalidateCache() {
    this.cache.clear();
    this.logger.log('Cache de dashboard invalidado');
  }

  private getCached<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (entry && Date.now() < entry.expiresAt) return entry.data as T;
    return null;
  }

  private setCache(key: string, data: any) {
    this.cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL });
  }

  /** Carga umbralCorte una sola vez (cacheado junto con el resto) */
  private async getUmbralCorte(): Promise<number> {
    const config = await this.prisma.empresaConfig.findFirst({ select: { umbralCorte: true } });
    return config?.umbralCorte ?? 1;
  }

  // ── Existing endpoints ───────────────────────────────────

  async getDashboardMetrics() {
    const cached = this.getCached('metrics');
    if (cached) return cached;

    const [totalClients, activeClients, bajaClients, debtStats, docCounts, recentImports, umbralCorte] =
      await Promise.all([
        this.prisma.client.count(),
        this.prisma.client.count({ where: { estado: ClientStatus.ACTIVO } }),
        this.prisma.client.count({ where: { estado: ClientStatus.BAJA } }),
        this.clientsService.getDebtStats(),
        this.getDocumentCounts(),
        this.getRecentImports(),
        this.getUmbralCorte(),
      ]);
    const activeSubs = await this.prisma.subscription.count({ where: { estado: ClientStatus.ACTIVO } });
    const subsWithPlan = await this.prisma.subscription.findMany({
      where: { estado: ClientStatus.ACTIVO, planId: { not: null } },
      include: { plan: true },
    });
    const mrrTeorico = subsWithPlan.reduce((sum, s) => sum + (s.plan ? Number(s.plan.precio) : 0), 0);

    const now = dayjs();
    const paidThisMonth = await this.prisma.paymentPeriod.groupBy({
      by: ['subscriptionId'],
      where: { year: now.year(), month: now.month() + 1, subscriptionId: { not: null } },
    });

    const enRiesgo = await this.prisma.subscription.count({
      where: { estado: ClientStatus.ACTIVO, deudaCalculada: umbralCorte },
    });

    const altasMes = await this.prisma.client.count({
      where: { createdAt: { gte: now.startOf('month').toDate() } },
    });
    const bajasMes = await this.prisma.auditLog.count({
      where: { action: 'CLIENT_DEACTIVATED', createdAt: { gte: now.startOf('month').toDate() } },
    });

    const internetSubs = await this.prisma.subscription.count({
      where: { estado: ClientStatus.ACTIVO, tipo: ServiceType.INTERNET },
    });

    const result = {
      resumen: { totalClients, activeClients, bajaClients },
      deuda: debtStats,
      documentos: docCounts,
      ultimasImportaciones: recentImports,
      mrr: {
        teorico: mrrTeorico,
        recaudadoMesActual: 0, // simplified
        porcentaje: activeSubs > 0 ? Math.round((paidThisMonth.length / activeSubs) * 100) : 0,
      },
      clientesEnRiesgo: enRiesgo,
      crecimientoNeto: altasMes - bajasMes,
      penetracionInternet: activeSubs > 0 ? Math.round((internetSubs / activeSubs) * 100) : 0,
    };

    this.setCache('metrics', result);
    return result;
  }

  async getClientesParaCorte() {
    const cached = this.getCached<ClientDebtInfo[]>('corte');
    if (cached) return cached;

    const clients = await this.prisma.client.findMany({
      where: { estado: ClientStatus.ACTIVO },
      include: {
        subscriptions: {
          include: { paymentPeriods: { select: { year: true, month: true } } },
        },
      },
    });

    const result = clients
      .map((c) => this.clientsService.calculateDebt(c.id, c.codCli, c.nombreNormalizado, c.estado, c.fechaAlta, c.calle, c.subscriptions))
      .filter((d) => d.requiereCorte)
      .sort((a, b) => b.cantidadDeuda - a.cantidadDeuda);

    this.setCache('corte', result);
    return result;
  }

  // ── New: Tendencia 12 meses ──────────────────────────────

  async getTendencia() {
    const cached = this.getCached('tendencia');
    if (cached) return cached;

    const now = dayjs();
    const meses: any[] = [];

    for (let i = 11; i >= 0; i--) {
      const m = now.subtract(i, 'month');
      const year = m.year();
      const month = m.month() + 1;

      const [totalActivos, pagados] = await Promise.all([
        this.prisma.subscription.count({
          where: { estado: ClientStatus.ACTIVO, fechaAlta: { lte: m.endOf('month').toDate() } },
        }),
        this.prisma.paymentPeriod.groupBy({
          by: ['subscriptionId'],
          where: { year, month, subscriptionId: { not: null } },
        }),
      ]);

      meses.push({
        periodo: m.format('YYYY-MM'),
        label: `${MONTH_LABELS[month]} ${year}`,
        totalActivos,
        pagados: pagados.length,
        porcentaje: totalActivos > 0 ? Math.round((pagados.length / totalActivos) * 1000) / 10 : 0,
      });
    }

    const result = { meses };
    this.setCache('tendencia', result);
    return result;
  }

  // ── New: MRR ─────────────────────────────────────────────

  async getMrr() {
    const cached = this.getCached('mrr');
    if (cached) return cached;

    const now = dayjs();
    const subs = await this.prisma.subscription.findMany({
      where: { estado: ClientStatus.ACTIVO },
      include: {
        plan: true,
        paymentPeriods: { where: { year: now.year(), month: now.month() + 1 } },
      },
    });

    let teorico = 0, recaudado = 0, sinPlan = 0;
    let cableTeorico = 0, cableRecaudado = 0, internetTeorico = 0, internetRecaudado = 0;

    for (const sub of subs) {
      const precio = sub.plan ? Number(sub.plan.precio) : 0;
      if (!sub.plan) sinPlan++;
      teorico += precio;
      if (sub.tipo === 'CABLE') cableTeorico += precio;
      else internetTeorico += precio;

      if (sub.paymentPeriods.length > 0) {
        recaudado += precio;
        if (sub.tipo === 'CABLE') cableRecaudado += precio;
        else internetRecaudado += precio;
      }
    }

    const result = {
      periodo: `${MONTH_LABELS[now.month() + 1]} ${now.year()}`,
      mrrTeorico: teorico,
      mrrRecaudado: recaudado,
      porcentajeRecaudado: teorico > 0 ? Math.round((recaudado / teorico) * 1000) / 10 : 0,
      sinPlanAsignado: sinPlan,
      desglose: {
        cable: { teorico: cableTeorico, recaudado: cableRecaudado, porcentaje: cableTeorico > 0 ? Math.round((cableRecaudado / cableTeorico) * 1000) / 10 : 0 },
        internet: { teorico: internetTeorico, recaudado: internetRecaudado, porcentaje: internetTeorico > 0 ? Math.round((internetRecaudado / internetTeorico) * 1000) / 10 : 0 },
      },
    };

    this.setCache('mrr', result);
    return result;
  }

  // ── New: Riesgo ──────────────────────────────────────────

  async getRiesgo() {
    const umbralCorte = await this.getUmbralCorte();

    const subs = await this.prisma.subscription.findMany({
      where: { estado: ClientStatus.ACTIVO, deudaCalculada: umbralCorte },
      include: { client: { select: { id: true, nombreNormalizado: true, calle: true, zona: true, telefono: true } } },
    });

    const clientMap = new Map<string, any>();
    for (const sub of subs) {
      const c = sub.client;
      if (!clientMap.has(c.id)) {
        clientMap.set(c.id, {
          id: c.id, nombre: c.nombreNormalizado, calle: c.calle, zona: c.zona, telefono: c.telefono,
          deudaCable: null, deudaInternet: null, servicios: [],
        });
      }
      const entry = clientMap.get(c.id)!;
      entry.servicios.push(sub.tipo);
      if (sub.tipo === 'CABLE') entry.deudaCable = sub.deudaCalculada;
      else entry.deudaInternet = sub.deudaCalculada;
    }

    const clientes = [...clientMap.values()]
      .sort((a, b) => (a.zona || 'zzz').localeCompare(b.zona || 'zzz') || a.nombre.localeCompare(b.nombre))
      .slice(0, 50);

    return { umbralCorte, total: clientMap.size, clientes };
  }

  // ── New: Crecimiento ─────────────────────────────────────

  async getCrecimiento() {
    const now = dayjs();
    const startThisMonth = now.startOf('month').toDate();
    const startLastMonth = now.subtract(1, 'month').startOf('month').toDate();
    const endLastMonth = now.startOf('month').toDate();

    const [altasThisMonth, bajasThisMonth, altasLastMonth, bajasLastMonth, totalActivos] = await Promise.all([
      this.prisma.client.count({ where: { createdAt: { gte: startThisMonth } } }),
      this.prisma.auditLog.count({ where: { action: 'CLIENT_DEACTIVATED', createdAt: { gte: startThisMonth } } }),
      this.prisma.client.count({ where: { createdAt: { gte: startLastMonth, lt: endLastMonth } } }),
      this.prisma.auditLog.count({ where: { action: 'CLIENT_DEACTIVATED', createdAt: { gte: startLastMonth, lt: endLastMonth } } }),
      this.prisma.client.count({ where: { estado: ClientStatus.ACTIVO } }),
    ]);

    // Penetración internet
    const subsByClient = await this.prisma.subscription.groupBy({
      by: ['clientId', 'tipo'],
      where: { estado: ClientStatus.ACTIVO },
    });

    const clientTypes = new Map<string, Set<string>>();
    for (const s of subsByClient) {
      if (!clientTypes.has(s.clientId)) clientTypes.set(s.clientId, new Set());
      clientTypes.get(s.clientId)!.add(s.tipo);
    }

    let soloCable = 0, soloInternet = 0, ambos = 0;
    for (const types of clientTypes.values()) {
      if (types.has('CABLE') && types.has('INTERNET')) ambos++;
      else if (types.has('CABLE')) soloCable++;
      else if (types.has('INTERNET')) soloInternet++;
    }

    const totalConSub = soloCable + soloInternet + ambos;

    return {
      mesActual: {
        periodo: `${MONTH_LABELS[now.month() + 1]} ${now.year()}`,
        altas: altasThisMonth, bajas: bajasThisMonth, neto: altasThisMonth - bajasThisMonth, totalActivos,
      },
      mesAnterior: {
        periodo: `${MONTH_LABELS[now.subtract(1, 'month').month() + 1]} ${now.subtract(1, 'month').year()}`,
        altas: altasLastMonth, bajas: bajasLastMonth, neto: altasLastMonth - bajasLastMonth,
      },
      penetracionInternet: {
        soloCable, soloInternet, ambos, totalActivos: totalConSub,
        porcentajeInternet: totalConSub > 0 ? Math.round(((ambos + soloInternet) / totalConSub) * 1000) / 10 : 0,
        oportunidad: soloCable,
      },
    };
  }

  // ── New: Zonas ───────────────────────────────────────────

  async getZonas() {
    const umbralCorte = await this.getUmbralCorte();

    const clients = await this.prisma.client.findMany({
      where: { estado: ClientStatus.ACTIVO },
      select: { zona: true, subscriptions: { select: { deudaCalculada: true }, where: { estado: ClientStatus.ACTIVO } } },
    });

    const zonaMap = new Map<string, { total: number; enCorte: number; enRiesgo: number; alDia: number }>();

    for (const c of clients) {
      const zona = c.zona || 'Sin zona';
      if (!zonaMap.has(zona)) zonaMap.set(zona, { total: 0, enCorte: 0, enRiesgo: 0, alDia: 0 });
      const z = zonaMap.get(zona)!;
      z.total++;

      const maxDeuda = Math.max(0, ...c.subscriptions.map((s) => s.deudaCalculada ?? 0));
      if (maxDeuda > umbralCorte) z.enCorte++;
      else if (maxDeuda === umbralCorte) z.enRiesgo++;
      else z.alDia++;
    }

    const zonas = [...zonaMap.entries()]
      .map(([zona, stats]) => ({
        zona,
        totalClientes: stats.total,
        enCorte: stats.enCorte,
        enRiesgo: stats.enRiesgo,
        alDia: stats.alDia,
        porcentajeMorosidad: stats.total > 0 ? Math.round(((stats.enCorte + stats.enRiesgo) / stats.total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => a.zona.localeCompare(b.zona));

    return { zonas };
  }

  // ── New: Tickets ─────────────────────────────────────────

  async getTicketsDashboard() {
    const cached = this.getCached('tickets');
    if (cached) return cached;

    const now = dayjs();
    const hace48hs = now.subtract(48, 'hour').toDate();

    const [abiertos, resueltosHoy, sinResolver48hs, porTipo, ultimosAbiertos] = await Promise.all([
      this.prisma.ticket.count({ where: { estado: 'ABIERTO' } }),
      this.prisma.ticket.count({ where: { estado: 'RESUELTO', resuelto: { gte: now.startOf('day').toDate() } } }),
      this.prisma.ticket.count({ where: { estado: 'ABIERTO', createdAt: { lte: hace48hs } } }),
      this.prisma.ticket.groupBy({ by: ['tipo'], where: { estado: 'ABIERTO' }, _count: true }),
      this.prisma.ticket.findMany({
        where: { estado: 'ABIERTO' },
        orderBy: { createdAt: 'asc' },
        take: 5,
        include: { client: { select: { id: true, nombreNormalizado: true } } },
      }),
    ]);

    // Tiempo promedio resolución últimos 30 días
    const resolved30d = await this.prisma.ticket.findMany({
      where: { estado: 'RESUELTO', resuelto: { gte: now.subtract(30, 'day').toDate() } },
      select: { createdAt: true, resuelto: true },
    });
    const avgHours = resolved30d.length > 0
      ? Math.round(resolved30d.reduce((sum, t) => sum + dayjs(t.resuelto!).diff(dayjs(t.createdAt), 'hour'), 0) / resolved30d.length)
      : 0;

    const result = {
      abiertos,
      resueltosHoy,
      sinResolver48hs,
      tiempoPromedioResolucion: avgHours,
      porTipo: Object.fromEntries(porTipo.map((g) => [g.tipo, g._count])),
      ultimosAbiertos: ultimosAbiertos.map((t) => ({
        id: t.id,
        tipo: t.tipo,
        descripcion: t.descripcion,
        cliente: t.client.nombreNormalizado,
        clienteId: t.client.id,
        desdeHace: dayjs(t.createdAt).fromNow(),
        createdAt: t.createdAt,
      })),
    };

    this.setCache('tickets', result);
    return result;
  }

  // ── Private helpers ──────────────────────────────────────

  private async getDocumentCounts() {
    const [ramitos, facturas, periods] = await Promise.all([
      this.prisma.document.count({ where: { tipo: 'RAMITO' } }),
      this.prisma.document.count({ where: { tipo: 'FACTURA' } }),
      this.prisma.paymentPeriod.count(),
    ]);
    return { ramitos, facturas, periodosRegistrados: periods };
  }

  private async getRecentImports() {
    return this.prisma.importLog.findMany({ orderBy: { executedAt: 'desc' }, take: 5 });
  }
}
