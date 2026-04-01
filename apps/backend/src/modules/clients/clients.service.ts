import { Injectable } from '@nestjs/common';
import { ClientStatus, Prisma, ServiceType } from '@prisma/client';
import dayjs from 'dayjs';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface SubscriptionDebt {
  subscriptionId: string;
  tipo: ServiceType;
  fechaAlta: Date;
  mesesObligatorios: string[];
  mesesPagados: string[];
  mesesAdeudados: string[];
  cantidadDeuda: number;
  requiereCorte: boolean;
}

export interface ClientDebtInfo {
  clientId: string;
  codCli: string;
  nombreNormalizado: string;
  estado: ClientStatus;
  fechaAlta: Date | null;
  calle: string | null;
  // Retrocompat — peor caso entre suscripciones
  mesesObligatorios: string[];
  mesesPagados: string[];
  mesesAdeudados: string[];
  cantidadDeuda: number;
  requiereCorte: boolean;
  // Desglose por servicio
  subscriptions: SubscriptionDebt[];
  requiereCorteCable: boolean;
  requiereCorteInternet: boolean;
  deudaCable: number;
  deudaInternet: number;
}

export interface ClientDetailResult extends ClientDebtInfo {
  nombreOriginal: string;
  documents: Array<{
    id: string;
    tipo: string;
    fechaDocumento: Date | null;
    numeroDocumento: string | null;
    descripcionOriginal: string | null;
    paymentPeriods: Array<{ year: number; month: number }>;
  }>;
  docPagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ClientListFilters {
  search?: string;
  estado?: ClientStatus;
  debtStatus?: 'AL_DIA' | '1_MES' | '2_MESES' | 'MAS_2_MESES';
  page?: number;
  limit?: number;
}

// Include reutilizable para cargar suscripciones con periodos
const SUBS_INCLUDE = {
  subscriptions: {
    include: {
      paymentPeriods: { select: { year: true, month: true } },
    },
  },
} as const;

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lista clientes con filtros y paginación.
   *
   * FIX Fase 4: Cuando se filtra por debtStatus, la paginación se calcula
   * DESPUÉS del filtro en memoria, no antes. Esto corrige el bug donde
   * pagination.total no matcheaba con los resultados mostrados.
   */
  async findAll(filters: ClientListFilters) {
    const { search, estado, debtStatus, page = 1, limit = 20 } = filters;

    const where: Prisma.ClientWhereInput = {};
    if (search) {
      where.OR = [
        { nombreNormalizado: { contains: search.toUpperCase(), mode: 'insensitive' } },
        { codCli: { contains: search } },
      ];
    }
    if (estado) {
      where.estado = estado;
    }

    // ── Sin filtro de deuda: paginación normal en DB ──────────────
    if (!debtStatus) {
      const [clients, total] = await Promise.all([
        this.prisma.client.findMany({
          where,
          orderBy: { nombreNormalizado: 'asc' },
          skip: (page - 1) * limit,
          take: limit,
          include: SUBS_INCLUDE,
        }),
        this.prisma.client.count({ where }),
      ]);

      const data = clients.map((c) => ({
        ...c,
        debtInfo: this.calculateDebt(
          c.id, c.codCli, c.nombreNormalizado, c.estado, c.fechaAlta, c.calle,
          c.subscriptions,
        ),
      }));

      return {
        data,
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
      };
    }

    const allClients = await this.prisma.client.findMany({
      where,
      orderBy: { nombreNormalizado: 'asc' },
      include: SUBS_INCLUDE,
    });

    const withDebt = allClients.map((c) => ({
      ...c,
      debtInfo: this.calculateDebt(
        c.id, c.codCli, c.nombreNormalizado, c.estado, c.fechaAlta, c.calle,
        c.subscriptions,
      ),
    }));

    // Filtrar por debtStatus
    const filtered = withDebt.filter((c) => {
      const d = c.debtInfo.cantidadDeuda;
      switch (debtStatus) {
        case 'AL_DIA': return d === 0;
        case '1_MES': return d === 1;
        case '2_MESES': return d === 2;
        case 'MAS_2_MESES': return d > 2;
        default: return true;
      }
    });

    // Paginar en memoria
    const total = filtered.length;
    const start = (page - 1) * limit;
    const data = filtered.slice(start, start + limit);

    return {
      data,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Detalle completo de un cliente: deuda + documentos.
   *
   * FIX Fase 4: Ahora retorna documentos con sus períodos.
   */
  async findOneWithDebt(
    id: string,
    docPage = 1,
    docLimit = 20,
  ): Promise<ClientDetailResult | null> {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: SUBS_INCLUDE,
    });
    if (!client) return null;

    const [documents, docTotal] = await Promise.all([
      this.prisma.document.findMany({
        where: { clientId: id },
        orderBy: { fechaDocumento: 'desc' },
        skip: (docPage - 1) * docLimit,
        take: docLimit,
        include: {
          paymentPeriods: { select: { year: true, month: true } },
          subscription: { select: { tipo: true } },
        },
      }),
      this.prisma.document.count({ where: { clientId: id } }),
    ]);

    const debt = this.calculateDebt(
      client.id,
      client.codCli,
      client.nombreNormalizado,
      client.estado,
      client.fechaAlta,
      client.calle,
      client.subscriptions,
    );

    return {
      ...debt,
      nombreOriginal: client.nombreOriginal,
      documents: documents.map((d) => ({
        id: d.id,
        tipo: d.tipo,
        fechaDocumento: d.fechaDocumento,
        numeroDocumento: d.numeroDocumento,
        descripcionOriginal: d.descripcionOriginal,
        paymentPeriods: d.paymentPeriods.map((pp) => ({
          year: pp.year,
          month: pp.month,
        })),
      })),
      docPagination: {
        total: docTotal,
        page: docPage,
        limit: docLimit,
        totalPages: Math.ceil(docTotal / docLimit),
      },
    };
  }

  /**
   * Calcula deuda de una suscripción individual.
   */
  private calculateSubDebt(
    subId: string,
    tipo: ServiceType,
    estado: ClientStatus,
    fechaAlta: Date,
    paidPeriods: Array<{ year: number; month: number }>,
  ): SubscriptionDebt {
    const result: SubscriptionDebt = {
      subscriptionId: subId,
      tipo,
      fechaAlta,
      mesesObligatorios: [],
      mesesPagados: [],
      mesesAdeudados: [],
      cantidadDeuda: 0,
      requiereCorte: false,
    };

    if (estado !== ClientStatus.ACTIVO) return result;

    const now = dayjs();
    const alta = dayjs(fechaAlta).startOf('month');

    let endMonth = now.startOf('month');
    if (now.date() <= 15) {
      endMonth = endMonth.subtract(1, 'month');
    }

    const paidSet = new Set(
      paidPeriods.map((p) => `${p.year}-${String(p.month).padStart(2, '0')}`),
    );

    let debtStartMonth: dayjs.Dayjs;
    if (paidPeriods.length > 0) {
      const lastPaid = paidPeriods.reduce((latest, p) => {
        if (p.year > latest.year || (p.year === latest.year && p.month > latest.month)) return p;
        return latest;
      }, paidPeriods[0]);
      debtStartMonth = dayjs(`${lastPaid.year}-${String(lastPaid.month).padStart(2, '0')}-01`).add(1, 'month');
    } else {
      debtStartMonth = alta;
    }

    let current = alta;
    while (current.isBefore(endMonth, 'month') || current.isSame(endMonth, 'month')) {
      result.mesesObligatorios.push(current.format('YYYY-MM'));
      current = current.add(1, 'month');
    }

    result.mesesPagados = result.mesesObligatorios.filter((m) => paidSet.has(m));
    result.mesesAdeudados = result.mesesObligatorios.filter((m) => {
      const monthDate = dayjs(m + '-01');
      return !paidSet.has(m) && (monthDate.isAfter(debtStartMonth, 'month') || monthDate.isSame(debtStartMonth, 'month'));
    });

    result.cantidadDeuda = result.mesesAdeudados.length;
    result.requiereCorte = result.cantidadDeuda > 1;
    return result;
  }

  /**
   * ═══════════════════════════════════════════════════════════
   * REGLA CENTRAL DE DEUDA — POR SUSCRIPCIÓN
   * ═══════════════════════════════════════════════════════════
   */
  calculateDebt(
    clientId: string,
    codCli: string,
    nombreNormalizado: string,
    estado: ClientStatus,
    fechaAlta: Date | null,
    calle: string | null,
    subscriptions: Array<{
      id: string;
      tipo: ServiceType;
      fechaAlta: Date;
      estado: ClientStatus;
      paymentPeriods: Array<{ year: number; month: number }>;
    }>,
  ): ClientDebtInfo {
    const subDebts: SubscriptionDebt[] = subscriptions.map((sub) =>
      this.calculateSubDebt(sub.id, sub.tipo, sub.estado, sub.fechaAlta, sub.paymentPeriods),
    );

    const cableDebt = subDebts.find((s) => s.tipo === ServiceType.CABLE);
    const internetDebt = subDebts.find((s) => s.tipo === ServiceType.INTERNET);

    // Retrocompat: peor caso entre suscripciones
    const allObligatorios = [...new Set(subDebts.flatMap((s) => s.mesesObligatorios))].sort();
    const allPagados = [...new Set(subDebts.flatMap((s) => s.mesesPagados))].sort();
    const allAdeudados = [...new Set(subDebts.flatMap((s) => s.mesesAdeudados))].sort();
    const maxDeuda = Math.max(0, ...subDebts.map((s) => s.cantidadDeuda));

    return {
      clientId,
      codCli,
      nombreNormalizado,
      estado,
      fechaAlta,
      calle,
      mesesObligatorios: allObligatorios,
      mesesPagados: allPagados,
      mesesAdeudados: allAdeudados,
      cantidadDeuda: maxDeuda,
      requiereCorte: subDebts.some((s) => s.requiereCorte),
      subscriptions: subDebts,
      requiereCorteCable: cableDebt?.requiereCorte ?? false,
      requiereCorteInternet: internetDebt?.requiereCorte ?? false,
      deudaCable: cableDebt?.cantidadDeuda ?? 0,
      deudaInternet: internetDebt?.cantidadDeuda ?? 0,
    };
  }

  async getDebtStats() {
    const clients = await this.prisma.client.findMany({
      where: { estado: ClientStatus.ACTIVO },
      include: SUBS_INCLUDE,
    });

    let alDia = 0;
    let unMes = 0;
    let dosMeses = 0;
    let masDosMeses = 0;
    const clientesParaCorte: string[] = [];

    for (const client of clients) {
      const debt = this.calculateDebt(
        client.id,
        client.codCli,
        client.nombreNormalizado,
        client.estado,
        client.fechaAlta,
        client.calle,
        client.subscriptions,
      );

      if (debt.cantidadDeuda === 0) alDia++;
      else if (debt.cantidadDeuda === 1) unMes++;
      else if (debt.cantidadDeuda === 2) dosMeses++;
      else {
        masDosMeses++;
        clientesParaCorte.push(client.nombreNormalizado);
      }
    }

    const total = clients.length;

    return {
      total,
      alDia,
      unMes,
      dosMeses,
      masDosMeses,
      requierenCorte: clientesParaCorte.length,
      tasaMorosidad:
        total > 0
          ? ((unMes + dosMeses + masDosMeses) / total) * 100
          : 0,
      clientesParaCorte,
    };
  }
}
