import { Injectable } from '@nestjs/common';
import { ClientStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class ClientsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Paginated client list with configurable include.
   */
  async findAllPaginated(
    where: Prisma.ClientWhereInput,
    page: number,
    limit: number,
    include: Prisma.ClientInclude,
  ) {
    const [clients, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        orderBy: { nombreNormalizado: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include,
      }),
      this.prisma.client.count({ where }),
    ]);
    return { clients, total };
  }

  /**
   * Find a single client by ID with configurable include.
   */
  async findById(id: string, include: Prisma.ClientInclude) {
    return this.prisma.client.findUnique({ where: { id }, include });
  }

  /**
   * Raw query: debt bucket counts for active clients using pre-computed subscription fields.
   */
  async getDebtStatsBuckets() {
    return this.prisma.$queryRaw<Array<{ bucket: string; cnt: number }>>`
      SELECT
        CASE
          WHEN max_deuda = 0 THEN 'alDia'
          WHEN max_deuda = 1 THEN 'unMes'
          WHEN max_deuda = 2 THEN 'dosMeses'
          ELSE 'masDosMeses'
        END as bucket,
        COUNT(*)::int as cnt
      FROM (
        SELECT c.id, COALESCE(MAX(s.deuda_calculada), 0) as max_deuda
        FROM clients c
        LEFT JOIN subscriptions s ON s.client_id = c.id AND s.estado = 'ACTIVO'
        WHERE c.estado = 'ACTIVO'
        GROUP BY c.id
      ) sub
      GROUP BY bucket
    `;
  }

  /**
   * Raw query: get client IDs matching a debtStatus filter.
   */
  async getClientIdsForDebtFilter(
    debtCondition: Prisma.Sql,
    whereClause: Prisma.Sql,
  ) {
    return this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT c.id FROM clients c
      LEFT JOIN (
        SELECT client_id, MAX(COALESCE(deuda_calculada, 0)) as max_debt
        FROM subscriptions WHERE estado = 'ACTIVO'
        GROUP BY client_id
      ) s ON s.client_id = c.id
      WHERE ${whereClause} AND ${debtCondition}
    `;
  }

  /**
   * Raw query: client names with >2 months debt (para corte).
   */
  async getClientesParaCorte() {
    return this.prisma.$queryRaw<Array<{ nombre_normalizado: string }>>`
      SELECT c.nombre_normalizado
      FROM clients c
      INNER JOIN subscriptions s ON s.client_id = c.id AND s.estado = 'ACTIVO'
      WHERE c.estado = 'ACTIVO'
      GROUP BY c.id, c.nombre_normalizado
      HAVING COALESCE(MAX(s.deuda_calculada), 0) > 2
      ORDER BY c.nombre_normalizado
    `;
  }

  /**
   * Raw query: scoring distribution for active clients.
   */
  async getScoringDistribution() {
    return this.prisma.$queryRaw<Array<{ scoring: string; cnt: number }>>`
      SELECT
        CASE
          WHEN max_deuda >= 4 OR has_corte THEN 'critico'
          WHEN max_deuda >= 2 THEN 'riesgo'
          WHEN max_deuda = 1 THEN 'regular'
          ELSE 'bueno'
        END as scoring,
        COUNT(*)::int as cnt
      FROM (
        SELECT c.id,
          COALESCE(MAX(s.deuda_calculada), 0) as max_deuda,
          BOOL_OR(COALESCE(s.requiere_corte, false)) as has_corte
        FROM clients c
        LEFT JOIN subscriptions s ON s.client_id = c.id AND s.estado = 'ACTIVO'
        WHERE c.estado = 'ACTIVO'
        GROUP BY c.id
      ) sub
      GROUP BY scoring
    `;
  }

  /**
   * Count clients by estado.
   */
  async countByEstado(estado: ClientStatus) {
    return this.prisma.client.count({ where: { estado } });
  }

  /**
   * Paginated documents for a client.
   */
  async findDocumentsByClient(clientId: string, page: number, limit: number) {
    const [documents, total] = await Promise.all([
      this.prisma.document.findMany({
        where: { clientId },
        orderBy: { fechaDocumento: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          paymentPeriods: { select: { year: true, month: true } },
          subscription: { select: { tipo: true } },
        },
      }),
      this.prisma.document.count({ where: { clientId } }),
    ]);
    return { documents, total };
  }
}
