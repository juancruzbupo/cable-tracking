import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ClientStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ClientsService } from '../clients/clients.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);
  private lastRun: { at: Date; processed: number; conCorte: number } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly clientsService: ClientsService,
  ) {}

  getStatus() {
    return this.lastRun
      ? { ultimoCalculo: this.lastRun.at, procesadas: this.lastRun.processed, conCorte: this.lastRun.conCorte }
      : { ultimoCalculo: null, procesadas: 0, conCorte: 0 };
  }

  @Cron('0 5 * * *', { timeZone: 'America/Argentina/Buenos_Aires' })
  async recalcularDeudas() {
    this.logger.log('Iniciando recalculo nocturno de deudas...');

    // Cargar umbralCorte de config (una sola vez, fuera del loop)
    const config = await this.prisma.empresaConfig.findFirst();
    const umbralCorte = config?.umbralCorte ?? 1;

    const subs = await this.prisma.subscription.findMany({
      where: { estado: ClientStatus.ACTIVO },
      include: {
        client: { select: { id: true, codCli: true, nombreNormalizado: true, estado: true, fechaAlta: true, calle: true } },
        paymentPeriods: { select: { year: true, month: true } },
        plan: { include: { promotions: { where: { activa: true, tipo: 'MESES_GRATIS' as const } } } },
        clientPromotions: { include: { promotion: { select: { id: true, nombre: true, tipo: true, valor: true, fechaInicio: true, fechaFin: true } } } },
      },
    });

    let conCorte = 0;
    const BATCH = 500;

    for (let i = 0; i < subs.length; i += BATCH) {
      const batch = subs.slice(i, i + BATCH);
      const updates = batch.map((sub) => {
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
    }

    this.lastRun = { at: new Date(), processed: subs.length, conCorte };
    this.logger.log(`Recalculo completo: ${subs.length} suscripciones, ${conCorte} en corte (umbral: ${umbralCorte})`);
  }
}
