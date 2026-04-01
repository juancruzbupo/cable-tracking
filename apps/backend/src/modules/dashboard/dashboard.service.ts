import { Injectable, Logger } from '@nestjs/common';
import { ClientStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ClientsService, ClientDebtInfo } from '../clients/clients.service';

const CACHE_TTL = 60_000; // 1 minuto

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  private metricsCache: { data: any; expiresAt: number } | null = null;
  private corteCache: { data: ClientDebtInfo[]; expiresAt: number } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly clientsService: ClientsService,
  ) {}

  /**
   * Invalida el cache. Llamar después de importaciones.
   */
  invalidateCache() {
    this.metricsCache = null;
    this.corteCache = null;
    this.logger.log('Cache de dashboard invalidado');
  }

  async getDashboardMetrics() {
    if (this.metricsCache && Date.now() < this.metricsCache.expiresAt) {
      return this.metricsCache.data;
    }

    const [totalClients, activeClients, bajaClients, debtStats, docCounts, recentImports] =
      await Promise.all([
        this.prisma.client.count(),
        this.prisma.client.count({ where: { estado: ClientStatus.ACTIVO } }),
        this.prisma.client.count({ where: { estado: ClientStatus.BAJA } }),
        this.clientsService.getDebtStats(),
        this.getDocumentCounts(),
        this.getRecentImports(),
      ]);

    const result = {
      resumen: { totalClients, activeClients, bajaClients },
      deuda: debtStats,
      documentos: docCounts,
      ultimasImportaciones: recentImports,
    };

    this.metricsCache = { data: result, expiresAt: Date.now() + CACHE_TTL };
    return result;
  }

  async getClientesParaCorte() {
    if (this.corteCache && Date.now() < this.corteCache.expiresAt) {
      return this.corteCache.data;
    }

    const clients = await this.prisma.client.findMany({
      where: { estado: ClientStatus.ACTIVO },
      include: {
        subscriptions: {
          include: { paymentPeriods: { select: { year: true, month: true } } },
        },
      },
    });

    const result = clients
      .map((c) =>
        this.clientsService.calculateDebt(
          c.id,
          c.codCli,
          c.nombreNormalizado,
          c.estado,
          c.fechaAlta,
          c.calle,
          c.subscriptions,
        ),
      )
      .filter((d) => d.requiereCorte)
      .sort((a, b) => b.cantidadDeuda - a.cantidadDeuda);

    this.corteCache = { data: result, expiresAt: Date.now() + CACHE_TTL };
    return result;
  }

  private async getDocumentCounts() {
    const [ramitos, facturas, periods] = await Promise.all([
      this.prisma.document.count({ where: { tipo: 'RAMITO' } }),
      this.prisma.document.count({ where: { tipo: 'FACTURA' } }),
      this.prisma.paymentPeriod.count(),
    ]);
    return { ramitos, facturas, periodosRegistrados: periods };
  }

  private async getRecentImports() {
    return this.prisma.importLog.findMany({
      orderBy: { executedAt: 'desc' },
      take: 5,
    });
  }
}
