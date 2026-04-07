import { Injectable } from '@nestjs/common';
import { ClientStatus, ServiceType } from '@prisma/client';
import dayjs from 'dayjs';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class DashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Count active subscriptions. */
  async getActiveSubscriptionCount() {
    return this.prisma.subscription.count({ where: { estado: ClientStatus.ACTIVO } });
  }

  /** Active subscriptions that have a plan assigned, with plan data included. */
  async getSubscriptionsWithPlan() {
    return this.prisma.subscription.findMany({
      where: { estado: ClientStatus.ACTIVO, planId: { not: null } },
      include: { plan: true },
    });
  }

  /** Tendencia data: subscription counts and payment groupings for each month. */
  async getTendenciaData(monthsData: Array<{ m: dayjs.Dayjs; year: number; month: number }>) {
    return Promise.all(
      monthsData.flatMap(({ m, year, month }) => [
        this.prisma.subscription.count({
          where: { estado: ClientStatus.ACTIVO, fechaAlta: { lte: m.endOf('month').toDate() } },
        }),
        this.prisma.paymentPeriod.groupBy({
          by: ['subscriptionId'],
          where: { year, month, subscriptionId: { not: null } },
        }),
      ]),
    );
  }

  /** Subscriptions that require corte, with client info. */
  async getCorteSubscriptions() {
    return this.prisma.subscription.findMany({
      where: { estado: ClientStatus.ACTIVO, requiereCorte: true },
      select: {
        id: true,
        tipo: true,
        deudaCalculada: true,
        requiereCorte: true,
        client: {
          select: {
            id: true,
            codCli: true,
            nombreNormalizado: true,
            estado: true,
            fechaAlta: true,
            calle: true,
            zona: true,
            telefono: true,
          },
        },
      },
    });
  }

  /** Active clients with their active subscriptions' deuda data, for zona analysis. */
  async getZonaData() {
    return this.prisma.client.findMany({
      where: { estado: ClientStatus.ACTIVO },
      select: {
        zona: true,
        subscriptions: {
          select: { deudaCalculada: true },
          where: { estado: ClientStatus.ACTIVO },
        },
      },
    });
  }

  /** Total client count (all estados). */
  async getTotalClientCount() {
    return this.prisma.client.count();
  }

  /** Count clients by estado. */
  async countClientsByEstado(estado: ClientStatus) {
    return this.prisma.client.count({ where: { estado } });
  }

  /** Payment periods grouped by subscription for a given year/month. */
  async getPaymentPeriodsGrouped(year: number, month: number) {
    return this.prisma.paymentPeriod.groupBy({
      by: ['subscriptionId'],
      where: { year, month, subscriptionId: { not: null } },
    });
  }

  /** Count subscriptions matching a deuda threshold. */
  async countSubscriptionsAtDeuda(deuda: number) {
    return this.prisma.subscription.count({
      where: { estado: ClientStatus.ACTIVO, deudaCalculada: deuda },
    });
  }

  /** Count clients created since a date. */
  async countClientsCreatedSince(since: Date) {
    return this.prisma.client.count({ where: { createdAt: { gte: since } } });
  }

  /** Count clients created in a date range. */
  async countClientsCreatedInRange(from: Date, to: Date) {
    return this.prisma.client.count({ where: { createdAt: { gte: from, lt: to } } });
  }

  /** Count audit log entries by action since a date. */
  async countAuditLogSince(action: string, since: Date) {
    return this.prisma.auditLog.count({ where: { action, createdAt: { gte: since } } });
  }

  /** Count audit log entries by action in a date range. */
  async countAuditLogInRange(action: string, from: Date, to: Date) {
    return this.prisma.auditLog.count({ where: { action, createdAt: { gte: from, lt: to } } });
  }

  /** Count active internet subscriptions. */
  async countInternetSubscriptions() {
    return this.prisma.subscription.count({
      where: { estado: ClientStatus.ACTIVO, tipo: ServiceType.INTERNET },
    });
  }

  /** Get empresa config for umbralCorte. */
  async getEmpresaConfig() {
    return this.prisma.empresaConfig.findFirst({ select: { umbralCorte: true } });
  }

  /** Document counts by tipo. */
  async getDocumentCounts() {
    const [ramitos, facturas, periods] = await Promise.all([
      this.prisma.document.count({ where: { tipo: 'RAMITO' } }),
      this.prisma.document.count({ where: { tipo: 'FACTURA' } }),
      this.prisma.paymentPeriod.count(),
    ]);
    return { ramitos, facturas, periodosRegistrados: periods };
  }

  /** Recent import logs. */
  async getRecentImports(take = 5) {
    return this.prisma.importLog.findMany({ orderBy: { executedAt: 'desc' }, take });
  }

  /** Subscriptions at a given deuda level with client info (for riesgo). */
  async getSubscriptionsAtDeudaWithClient(deuda: number) {
    return this.prisma.subscription.findMany({
      where: { estado: ClientStatus.ACTIVO, deudaCalculada: deuda },
      include: {
        client: {
          select: { id: true, nombreNormalizado: true, calle: true, zona: true, telefono: true },
        },
      },
    });
  }

  /** Active subscriptions grouped by clientId and tipo. */
  async getActiveSubscriptionsGroupedByClient() {
    return this.prisma.subscription.groupBy({
      by: ['clientId', 'tipo'],
      where: { estado: ClientStatus.ACTIVO },
    });
  }

  /** MRR: active subscriptions with plan and payment periods for current month. */
  async getMrrSubscriptions(year: number, month: number) {
    return this.prisma.subscription.findMany({
      where: { estado: ClientStatus.ACTIVO },
      include: {
        plan: true,
        paymentPeriods: { where: { year, month } },
      },
    });
  }

  /** Ticket stats for dashboard. */
  async getTicketStats(hace48hs: Date, startOfDay: Date) {
    return Promise.all([
      this.prisma.ticket.count({ where: { estado: 'ABIERTO' } }),
      this.prisma.ticket.count({ where: { estado: 'RESUELTO', resuelto: { gte: startOfDay } } }),
      this.prisma.ticket.count({ where: { estado: 'ABIERTO', createdAt: { lte: hace48hs } } }),
      this.prisma.ticket.groupBy({ by: ['tipo'], where: { estado: 'ABIERTO' }, _count: true }),
      this.prisma.ticket.findMany({
        where: { estado: 'ABIERTO' },
        orderBy: { createdAt: 'asc' },
        take: 5,
        include: { client: { select: { id: true, nombreNormalizado: true } } },
      }),
    ]);
  }

  /** Resolved tickets in the last N days. */
  async getResolvedTicketsSince(since: Date) {
    return this.prisma.ticket.findMany({
      where: { estado: 'RESUELTO', resuelto: { gte: since } },
      select: { createdAt: true, resuelto: true },
    });
  }
}
