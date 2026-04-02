import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ClientStatus } from '@prisma/client';
import dayjs from 'dayjs';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { ClientsService } from '../clients/clients.service';

const BATCH_SIZE = 500;
const MESES_INACTIVIDAD_BAJA = 12;

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);
  private lastRun: { at: Date; processed: number; conCorte: number } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly clientsService: ClientsService,
    private readonly audit: AuditService,
  ) {}

  getStatus() {
    return this.lastRun
      ? { ultimoCalculo: this.lastRun.at, procesadas: this.lastRun.processed, conCorte: this.lastRun.conCorte }
      : { ultimoCalculo: null, procesadas: 0, conCorte: 0 };
  }

  @Cron('0 5 * * *', { timeZone: 'America/Argentina/Buenos_Aires' })
  async recalcularDeudas() {
    this.logger.log('Iniciando recalculo nocturno de deudas...');

    const config = await this.prisma.empresaConfig.findFirst();
    const umbralCorte = config?.umbralCorte ?? 1;

    let processed = 0;
    let conCorte = 0;
    let cursor: string | undefined;

    // Cursor-based pagination: carga de a BATCH_SIZE en vez de todo a memoria
    while (true) {
      const subs = await this.prisma.subscription.findMany({
        where: { estado: ClientStatus.ACTIVO },
        include: {
          paymentPeriods: { select: { year: true, month: true } },
          plan: { include: { promotions: { where: { activa: true, tipo: 'MESES_GRATIS' as const } } } },
          clientPromotions: { include: { promotion: { select: { id: true, nombre: true, tipo: true, valor: true, fechaInicio: true, fechaFin: true } } } },
        },
        take: BATCH_SIZE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { id: 'asc' },
      });

      if (subs.length === 0) break;

      const updates = subs.map((sub) => {
        const promosGratis = [
          ...(sub.plan?.promotions || [])
            .filter((p) => p.tipo === 'MESES_GRATIS')
            .map((p) => ({ id: p.id, nombre: p.nombre, tipo: p.tipo as any, valor: Number(p.valor), fechaInicio: p.fechaInicio, fechaFin: p.fechaFin })),
          ...(sub.clientPromotions || [])
            .filter((cp) => cp.promotion.tipo === 'MESES_GRATIS')
            .map((cp) => ({ id: cp.promotion.id, nombre: cp.promotion.nombre, tipo: cp.promotion.tipo as any, valor: Number(cp.promotion.valor), fechaInicio: cp.promotion.fechaInicio, fechaFin: cp.promotion.fechaFin })),
        ];
        const debt = this.clientsService.calculateSubDebt(sub.id, sub.tipo, sub.estado, sub.fechaAlta, sub.paymentPeriods, promosGratis, umbralCorte);
        if (debt.requiereCorte) conCorte++;
        return this.prisma.subscription.update({
          where: { id: sub.id },
          data: { deudaCalculada: debt.cantidadDeuda, requiereCorte: debt.requiereCorte, ultimoCalculo: new Date() },
        });
      });

      await this.prisma.$transaction(updates);
      processed += subs.length;
      cursor = subs[subs.length - 1].id;

      if (subs.length < BATCH_SIZE) break;
    }

    // Auto-baja de suscripciones con 12+ meses sin pago
    const autoDeactivated = await this.deactivateStaleSubscriptions();

    this.lastRun = { at: new Date(), processed, conCorte };
    this.logger.log(`Recalculo completo: ${processed} suscripciones, ${conCorte} en corte (umbral: ${umbralCorte})${autoDeactivated > 0 ? `, ${autoDeactivated} subs auto-baja` : ''}`);
  }

  /**
   * Da de baja suscripciones individuales con 12+ meses sin ningún pago.
   * El cliente puede seguir activo si tiene otro servicio al día.
   */
  private async deactivateStaleSubscriptions(): Promise<number> {
    const now = dayjs();
    const subs = await this.prisma.subscription.findMany({
      where: { estado: ClientStatus.ACTIVO, client: { estado: ClientStatus.ACTIVO } },
      include: {
        paymentPeriods: { select: { year: true, month: true }, orderBy: [{ year: 'desc' }, { month: 'desc' }], take: 1 },
      },
    });

    const toDeactivate: string[] = [];
    for (const sub of subs) {
      let mesesSinPago: number;
      if (sub.paymentPeriods.length === 0) {
        mesesSinPago = now.diff(dayjs(sub.fechaAlta), 'month');
      } else {
        const last = sub.paymentPeriods[0];
        mesesSinPago = now.diff(dayjs(new Date(last.year, last.month - 1)), 'month');
      }
      if (mesesSinPago >= MESES_INACTIVIDAD_BAJA) toDeactivate.push(sub.id);
    }

    if (toDeactivate.length === 0) return 0;

    await this.prisma.subscription.updateMany({ where: { id: { in: toDeactivate } }, data: { estado: ClientStatus.BAJA } });

    // Obtener un admin para el audit log
    const admin = await this.prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } });
    if (admin) {
      await this.prisma.auditLog.createMany({
        data: toDeactivate.map((id) => ({
          userId: admin.id,
          action: 'SUBSCRIPTION_AUTO_DEACTIVATED',
          entityType: 'SUBSCRIPTION',
          entityId: id,
          metadata: { reason: `${MESES_INACTIVIDAD_BAJA}+ meses sin pago`, automated: true },
        })),
      });
    }

    this.logger.log(`Auto-baja: ${toDeactivate.length} suscripciones con ${MESES_INACTIVIDAD_BAJA}+ meses sin pago`);
    return toDeactivate.length;
  }
}
