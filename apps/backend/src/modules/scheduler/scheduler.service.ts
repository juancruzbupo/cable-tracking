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
    const subs = await this.prisma.subscription.findMany({
      where: { estado: ClientStatus.ACTIVO },
      include: {
        client: { select: { id: true, codCli: true, nombreNormalizado: true, estado: true, fechaAlta: true, calle: true } },
        paymentPeriods: { select: { year: true, month: true } },
      },
    });

    let conCorte = 0;
    const BATCH = 100;

    for (let i = 0; i < subs.length; i += BATCH) {
      const batch = subs.slice(i, i + BATCH);
      const updates = batch.map((sub) => {
        const debt = this.clientsService.calculateSubDebt(sub.id, sub.tipo, sub.estado, sub.fechaAlta, sub.paymentPeriods);
        if (debt.requiereCorte) conCorte++;
        return this.prisma.subscription.update({
          where: { id: sub.id },
          data: { deudaCalculada: debt.cantidadDeuda, requiereCorte: debt.requiereCorte, ultimoCalculo: new Date() },
        });
      });
      await this.prisma.$transaction(updates);
    }

    this.lastRun = { at: new Date(), processed: subs.length, conCorte };
    this.logger.log(`Recalculo completo: ${subs.length} suscripciones, ${conCorte} en corte`);
  }
}
