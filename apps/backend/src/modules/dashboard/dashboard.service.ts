import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ClientStatus, ServiceType } from '@prisma/client';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/es';

dayjs.extend(relativeTime);
dayjs.locale('es');
import { ClientsService, ClientDebtInfo } from '../clients/clients.service';
import { DomainEvents } from '../../common/events/domain-events';
import { DashboardRepository } from './dashboard.repository';

const CACHE_TTL = 60_000;
const MONTH_LABELS = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);
  private cache: Map<string, { data: any; expiresAt: number }> = new Map();

  constructor(
    private readonly repository: DashboardRepository,
    private readonly clientsService: ClientsService,
  ) {}

  @OnEvent(DomainEvents.CLIENT_DEACTIVATED)
  @OnEvent(DomainEvents.CLIENT_REACTIVATED)
  @OnEvent(DomainEvents.PAYMENT_CREATED)
  @OnEvent(DomainEvents.PAYMENT_DELETED)
  @OnEvent(DomainEvents.IMPORT_COMPLETED)
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
    const config = await this.repository.getEmpresaConfig();
    return config?.umbralCorte ?? 1;
  }

  // ── Existing endpoints ───────────────────────────────────

  async getDashboardMetrics() {
    const cached = this.getCached('metrics');
    if (cached) return cached;

    const [totalClients, activeClients, bajaClients, debtStats, docCounts, recentImports, umbralCorte] =
      await Promise.all([
        this.repository.getTotalClientCount(),
        this.repository.countClientsByEstado(ClientStatus.ACTIVO),
        this.repository.countClientsByEstado(ClientStatus.BAJA),
        this.clientsService.getDebtStats(),
        this.repository.getDocumentCounts(),
        this.repository.getRecentImports(),
        this.getUmbralCorte(),
      ]);
    const activeSubs = await this.repository.getActiveSubscriptionCount();
    const subsWithPlan = await this.repository.getSubscriptionsWithPlan();
    const mrrTeorico = subsWithPlan.reduce((sum, s) => sum + (s.plan ? Number(s.plan.precio) : 0), 0);

    const now = dayjs();
    const paidThisMonth = await this.repository.getPaymentPeriodsGrouped(now.year(), now.month() + 1);

    const enRiesgo = await this.repository.countSubscriptionsAtDeuda(umbralCorte);

    const altasMes = await this.repository.countClientsCreatedSince(now.startOf('month').toDate());
    const bajasMes = await this.repository.countAuditLogSince('CLIENT_DEACTIVATED', now.startOf('month').toDate());

    const internetSubs = await this.repository.countInternetSubscriptions();

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
    const cached = this.getCached<(ClientDebtInfo & { zona: string | null; telefono: string | null })[]>('corte');
    if (cached) return cached;

    // Use pre-computed requiereCorte from Subscription rows (set by nightly scheduler)
    const subs = await this.repository.getCorteSubscriptions();

    // Group by client, build ClientDebtInfo-compatible objects
    const clientMap = new Map<string, {
      client: typeof subs[0]['client'];
      cableSub: { cantidadDeuda: number; requiereCorte: boolean } | null;
      internetSub: { cantidadDeuda: number; requiereCorte: boolean } | null;
      subscriptions: Array<{ subscriptionId: string; tipo: ServiceType; cantidadDeuda: number; requiereCorte: boolean }>;
    }>();

    for (const sub of subs) {
      const c = sub.client;
      if (!clientMap.has(c.id)) {
        clientMap.set(c.id, { client: c, cableSub: null, internetSub: null, subscriptions: [] });
      }
      const entry = clientMap.get(c.id)!;
      const subInfo = { cantidadDeuda: sub.deudaCalculada ?? 0, requiereCorte: sub.requiereCorte };
      if (sub.tipo === ServiceType.CABLE) entry.cableSub = subInfo;
      else entry.internetSub = subInfo;
      entry.subscriptions.push({
        subscriptionId: sub.id,
        tipo: sub.tipo,
        cantidadDeuda: sub.deudaCalculada ?? 0,
        requiereCorte: sub.requiereCorte,
      });
    }

    const result = [...clientMap.values()].map((entry) => {
      const { client: c, cableSub, internetSub, subscriptions: subsList } = entry;
      const maxDeuda = Math.max(0, ...subsList.map((s) => s.cantidadDeuda));
      return {
        clientId: c.id,
        codCli: c.codCli,
        nombreNormalizado: c.nombreNormalizado,
        estado: c.estado,
        fechaAlta: c.fechaAlta,
        calle: c.calle,
        zona: c.zona,
        telefono: c.telefono,
        mesesObligatorios: [] as string[],
        mesesPagados: [] as string[],
        mesesAdeudados: [] as string[],
        cantidadDeuda: maxDeuda,
        requiereCorte: true,
        subscriptions: subsList.map((s) => ({
          subscriptionId: s.subscriptionId,
          tipo: s.tipo,
          fechaAlta: new Date(),
          mesesObligatorios: [] as string[],
          mesesPagados: [] as string[],
          mesesAdeudados: [] as string[],
          mesesConPromoGratis: [] as string[],
          cantidadDeuda: s.cantidadDeuda,
          requiereCorte: s.requiereCorte,
        })),
        requiereCorteCable: cableSub?.requiereCorte ?? false,
        requiereCorteInternet: internetSub?.requiereCorte ?? false,
        deudaCable: cableSub?.cantidadDeuda ?? 0,
        deudaInternet: internetSub?.cantidadDeuda ?? 0,
      };
    }).sort((a, b) => b.cantidadDeuda - a.cantidadDeuda);

    this.setCache('corte', result);
    return result;
  }

  // ── New: Tendencia 12 meses ──────────────────────────────

  async getTendencia() {
    const cached = this.getCached('tendencia');
    if (cached) return cached;

    const now = dayjs();
    const monthsData = Array.from({ length: 12 }, (_, i) => {
      const m = now.subtract(11 - i, 'month');
      return { m, year: m.year(), month: m.month() + 1 };
    });

    // Ejecutar las 24 queries en paralelo (2 por mes × 12 meses)
    const results = await this.repository.getTendenciaData(monthsData);

    const meses = monthsData.map(({ m, month, year }, i) => {
      const totalActivos = results[i * 2] as number;
      const pagados = (results[i * 2 + 1] as any[]).length;
      return {
        periodo: m.format('YYYY-MM'),
        label: `${MONTH_LABELS[month]} ${year}`,
        totalActivos,
        pagados,
        porcentaje: totalActivos > 0 ? Math.round((pagados / totalActivos) * 1000) / 10 : 0,
      };
    });

    const result = { meses };
    this.setCache('tendencia', result);
    return result;
  }

  // ── New: MRR ─────────────────────────────────────────────

  async getMrr() {
    const cached = this.getCached('mrr');
    if (cached) return cached;

    const now = dayjs();
    const subs = await this.repository.getMrrSubscriptions(now.year(), now.month() + 1);

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
    const cached = this.getCached('riesgo');
    if (cached) return cached;
    const umbralCorte = await this.getUmbralCorte();

    const subs = await this.repository.getSubscriptionsAtDeudaWithClient(umbralCorte);

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

    const result = { umbralCorte, total: clientMap.size, clientes };
    this.setCache('riesgo', result);
    return result;
  }

  // ── New: Crecimiento ─────────────────────────────────────

  async getCrecimiento() {
    const cached = this.getCached('crecimiento');
    if (cached) return cached;
    const now = dayjs();
    const startThisMonth = now.startOf('month').toDate();
    const startLastMonth = now.subtract(1, 'month').startOf('month').toDate();
    const endLastMonth = now.startOf('month').toDate();

    const [altasThisMonth, bajasThisMonth, altasLastMonth, bajasLastMonth, totalActivos] = await Promise.all([
      this.repository.countClientsCreatedSince(startThisMonth),
      this.repository.countAuditLogSince('CLIENT_DEACTIVATED', startThisMonth),
      this.repository.countClientsCreatedInRange(startLastMonth, endLastMonth),
      this.repository.countAuditLogInRange('CLIENT_DEACTIVATED', startLastMonth, endLastMonth),
      this.repository.countClientsByEstado(ClientStatus.ACTIVO),
    ]);

    // Penetración internet
    const subsByClient = await this.repository.getActiveSubscriptionsGroupedByClient();

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

    const result = {
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
    this.setCache('crecimiento', result);
    return result;
  }

  // ── New: Zonas ───────────────────────────────────────────

  async getZonas() {
    const cached = this.getCached('zonas');
    if (cached) return cached;
    const umbralCorte = await this.getUmbralCorte();

    const clients = await this.repository.getZonaData();

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

    const result = { zonas };
    this.setCache('zonas', result);
    return result;
  }

  // ── New: Tickets ─────────────────────────────────────────

  async getTicketsDashboard() {
    const cached = this.getCached('tickets');
    if (cached) return cached;

    const now = dayjs();
    const hace48hs = now.subtract(48, 'hour').toDate();

    const [abiertos, resueltosHoy, sinResolver48hs, porTipo, ultimosAbiertos] =
      await this.repository.getTicketStats(hace48hs, now.startOf('day').toDate());

    // Tiempo promedio resolución últimos 30 días
    const resolved30d = await this.repository.getResolvedTicketsSince(now.subtract(30, 'day').toDate());
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

}
