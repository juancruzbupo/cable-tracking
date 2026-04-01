import { Injectable } from '@nestjs/common';
import { ClientStatus, Prisma, ServiceType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DebtService, SubscriptionDebt, ClientDebtInfo } from './debt.service';

// Re-export for backwards compatibility
export { SubscriptionDebt, ClientDebtInfo } from './debt.service';

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

// Include reutilizable para cargar suscripciones con periodos y promos
const SUBS_INCLUDE = {
  subscriptions: {
    include: {
      paymentPeriods: { select: { year: true, month: true } },
      plan: { include: { promotions: { where: { activa: true, tipo: 'MESES_GRATIS' as const } } } },
      clientPromotions: { include: { promotion: { select: { id: true, nombre: true, tipo: true, valor: true, fechaInicio: true, fechaFin: true } } } },
    },
  },
} as const;

@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly debtService: DebtService,
  ) {}

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

  /** Proxy → DebtService.calculateSubDebt */
  calculateSubDebt(...args: Parameters<DebtService['calculateSubDebt']>): SubscriptionDebt {
    return this.debtService.calculateSubDebt(...args);
  }

  /** Proxy → DebtService.calculateClientDebt */
  calculateDebt(...args: Parameters<DebtService['calculateClientDebt']>): ClientDebtInfo {
    return this.debtService.calculateClientDebt(...args);
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
