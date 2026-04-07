import { Injectable } from '@nestjs/common';
import { ClientStatus, Prisma, ServiceType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DebtService, SubscriptionDebt, ClientDebtInfo } from './debt.service';
import { ClientsRepository } from './clients.repository';

// Re-export for backwards compatibility
export { SubscriptionDebt, ClientDebtInfo } from './debt.service';

export interface ClientDetailResult extends ClientDebtInfo {
  nombreOriginal: string;
  tipoDocumento: string | null;
  numeroDocFiscal: string | null;
  condicionFiscal: string;
  razonSocial: string | null;
  telefono: string | null;
  email: string | null;
  codigoPostal: string | null;
  localidad: string | null;
  provincia: string | null;
  zona: string | null;
  tipoComprobante: string;
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
  zona?: string;
  page?: number;
  limit?: number;
}

// Full include for real-time debt calculation (detail view only)
const SUBS_INCLUDE = {
  subscriptions: {
    include: {
      paymentPeriods: { select: { year: true, month: true } },
      plan: { include: { promotions: { where: { activa: true, tipo: 'MESES_GRATIS' as const } } } },
      clientPromotions: { include: { promotion: { select: { id: true, nombre: true, tipo: true, valor: true, fechaInicio: true, fechaFin: true } } } },
    },
  },
} as const;

// Lightweight include for list views — uses pre-computed fields only
const SUBS_PRECOMPUTED_INCLUDE = {
  subscriptions: {
    where: { estado: ClientStatus.ACTIVO },
    select: {
      id: true,
      tipo: true,
      deudaCalculada: true,
      requiereCorte: true,
    },
  },
} as const;

@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly debtService: DebtService,
    private readonly repository: ClientsRepository,
  ) {}

  /**
   * Lista clientes con filtros y paginación.
   *
   * Uses pre-computed deudaCalculada/requiereCorte from Subscription rows
   * (written by the nightly scheduler) for both debt filtering and display.
   * This avoids loading all clients into memory.
   */
  async findAll(filters: ClientListFilters) {
    const { search, estado, debtStatus, zona, page = 1, limit = 20 } = filters;

    const where: Prisma.ClientWhereInput = {};
    if (zona) {
      where.zona = zona === 'Sin zona' ? null : zona;
    }
    if (search) {
      where.OR = [
        { nombreNormalizado: { contains: search.toUpperCase(), mode: 'insensitive' } },
        { codCli: { contains: search } },
      ];
    }
    if (estado) {
      where.estado = estado;
    }

    // ── DB-level debtStatus filter using pre-computed fields ──────
    if (debtStatus) {
      const debtConditions: Record<string, Prisma.Sql> = {
        'AL_DIA': Prisma.sql`COALESCE(max_debt, 0) = 0`,
        '1_MES': Prisma.sql`max_debt = 1`,
        '2_MESES': Prisma.sql`max_debt = 2`,
        'MAS_2_MESES': Prisma.sql`max_debt > 2`,
      };
      const debtCondition = debtConditions[debtStatus];

      // Build a WHERE clause for the raw query that mirrors the Prisma where
      const rawConditions: Prisma.Sql[] = [Prisma.sql`c.estado = 'ACTIVO'`];
      if (zona) {
        if (zona === 'Sin zona') {
          rawConditions.push(Prisma.sql`c.zona IS NULL`);
        } else {
          rawConditions.push(Prisma.sql`c.zona = ${zona}`);
        }
      }
      if (search) {
        const upperSearch = `%${search.toUpperCase()}%`;
        rawConditions.push(Prisma.sql`(c.nombre_normalizado ILIKE ${upperSearch} OR c.cod_cli LIKE ${`%${search}%`})`);
      }
      if (estado) {
        rawConditions.push(Prisma.sql`c.estado = ${estado}::"ClientStatus"`);
      }

      const whereClause = Prisma.sql`${Prisma.join(rawConditions, ' AND ')}`;

      const matchingIds = await this.repository.getClientIdsForDebtFilter(debtCondition, whereClause);
      where.id = { in: matchingIds.map((r) => r.id) };
    }

    const { clients, total } = await this.repository.findAllPaginated(
      where,
      page,
      limit,
      { ...SUBS_PRECOMPUTED_INCLUDE, _count: { select: { tickets: { where: { estado: 'ABIERTO' } } } } },
    );

    const data = clients.map((c) => {
      const debtInfo = this.buildDebtInfoFromPrecomputed(c);
      return { ...c, ticketsAbiertos: c._count?.tickets ?? 0, debtInfo, scoring: DebtService.calcularScoring(debtInfo.cantidadDeuda, debtInfo.requiereCorte) };
    });

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

    const { documents, total: docTotal } = await this.repository.findDocumentsByClient(id, docPage, docLimit);

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
      tipoDocumento: client.tipoDocumento,
      numeroDocFiscal: client.numeroDocFiscal,
      condicionFiscal: client.condicionFiscal,
      razonSocial: client.razonSocial,
      telefono: client.telefono,
      email: client.email,
      codigoPostal: client.codigoPostal,
      localidad: client.localidad,
      provincia: client.provincia,
      zona: client.zona,
      tipoComprobante: client.tipoComprobante,
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
    // Use pre-computed deudaCalculada from Subscription rows (set by nightly scheduler)
    const [buckets, total, clientesParaCorteRows, scoringRows] = await Promise.all([
      this.repository.getDebtStatsBuckets(),
      this.repository.countByEstado(ClientStatus.ACTIVO),
      this.repository.getClientesParaCorte(),
      this.repository.getScoringDistribution(),
    ]);

    const bucketMap: Record<string, number> = {};
    for (const b of buckets) bucketMap[b.bucket] = b.cnt;
    const alDia = bucketMap['alDia'] ?? 0;
    const unMes = bucketMap['unMes'] ?? 0;
    const dosMeses = bucketMap['dosMeses'] ?? 0;
    const masDosMeses = bucketMap['masDosMeses'] ?? 0;

    const clientesParaCorte = clientesParaCorteRows.map((r) => r.nombre_normalizado);

    const scoringMap: Record<string, number> = {};
    for (const s of scoringRows) scoringMap[s.scoring] = s.cnt;
    const scoring = {
      bueno: scoringMap['bueno'] ?? 0,
      regular: scoringMap['regular'] ?? 0,
      riesgo: scoringMap['riesgo'] ?? 0,
      critico: scoringMap['critico'] ?? 0,
    };

    return {
      total,
      alDia,
      unMes,
      dosMeses,
      masDosMeses,
      requierenCorte: clientesParaCorte.length,
      tasaMorosidad: total > 0 ? ((unMes + dosMeses + masDosMeses) / total) * 100 : 0,
      clientesParaCorte,
      scoring,
    };
  }

  /**
   * Build a ClientDebtInfo-compatible object from pre-computed subscription fields.
   * Used for list views where real-time calculation is not needed.
   */
  private buildDebtInfoFromPrecomputed(client: {
    id: string;
    codCli: string;
    nombreNormalizado: string;
    estado: ClientStatus;
    fechaAlta: Date | null;
    calle: string | null;
    subscriptions: Array<{
      id: string;
      tipo: ServiceType;
      deudaCalculada: number | null;
      requiereCorte: boolean;
    }>;
  }): ClientDebtInfo {
    const subDebts: SubscriptionDebt[] = client.subscriptions.map((sub) => ({
      subscriptionId: sub.id,
      tipo: sub.tipo,
      fechaAlta: new Date(),
      mesesObligatorios: [],
      mesesPagados: [],
      mesesAdeudados: [],
      mesesConPromoGratis: [],
      cantidadDeuda: sub.deudaCalculada ?? 0,
      requiereCorte: sub.requiereCorte,
    }));

    const cableDebt = subDebts.find((s) => s.tipo === ServiceType.CABLE);
    const internetDebt = subDebts.find((s) => s.tipo === ServiceType.INTERNET);
    const maxDeuda = Math.max(0, ...subDebts.map((s) => s.cantidadDeuda));

    return {
      clientId: client.id,
      codCli: client.codCli,
      nombreNormalizado: client.nombreNormalizado,
      estado: client.estado,
      fechaAlta: client.fechaAlta,
      calle: client.calle,
      mesesObligatorios: [],
      mesesPagados: [],
      mesesAdeudados: [],
      cantidadDeuda: maxDeuda,
      requiereCorte: subDebts.some((s) => s.requiereCorte),
      subscriptions: subDebts,
      requiereCorteCable: cableDebt?.requiereCorte ?? false,
      requiereCorteInternet: internetDebt?.requiereCorte ?? false,
      deudaCable: cableDebt?.cantidadDeuda ?? 0,
      deudaInternet: internetDebt?.cantidadDeuda ?? 0,
    };
  }
}
