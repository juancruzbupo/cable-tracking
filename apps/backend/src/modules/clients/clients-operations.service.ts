import {
  Injectable, BadRequestException, ConflictException, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { ClientStatus, ServiceType } from '@prisma/client';
import dayjs from 'dayjs';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { normalizeName } from '../../common/utils/normalize-name.util';

@Injectable()
export class ClientsOperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── Alta de cliente ──────────────────────────────────────

  async createClient(
    userId: string,
    data: {
      nombreOriginal: string;
      codigoOriginal?: string;
      calle?: string;
      subscriptions: Array<{ tipo: ServiceType; fechaAlta: string }>;
    },
  ) {
    const { nombreNormalizado, nombreOriginal } = normalizeName(data.nombreOriginal);
    if (!nombreNormalizado) throw new BadRequestException('Nombre inválido');

    // Generar codCli: max numérico existente + 1
    const allCodes = await this.prisma.$queryRaw<Array<{ max: number }>>`
      SELECT COALESCE(MAX(CAST(cod_cli AS INTEGER)), 0) as max FROM clients WHERE cod_cli ~ '^[0-9]+$'
    `;
    const nextCode = String((allCodes[0]?.max || 0) + 1);

    const client = await this.prisma.client.create({
      data: {
        codCli: data.codigoOriginal?.trim() || nextCode,
        nombreOriginal,
        nombreNormalizado,
        calle: data.calle?.trim() || null,
        fechaAlta: data.subscriptions[0]
          ? new Date(data.subscriptions[0].fechaAlta)
          : new Date(),
        estado: ClientStatus.ACTIVO,
        subscriptions: {
          create: data.subscriptions.map((s) => ({
            tipo: s.tipo,
            fechaAlta: new Date(s.fechaAlta),
            estado: ClientStatus.ACTIVO,
          })),
        },
      },
      include: { subscriptions: true },
    });

    await this.audit.log(userId, 'CLIENT_CREATED', 'CLIENT', client.id, {
      subscriptions: data.subscriptions.map((s) => s.tipo),
    });

    return client;
  }

  // ── Baja/Reactivación de cliente ─────────────────────────

  async deactivateClient(userId: string, clientId: string) {
    const client = await this.prisma.client.findUniqueOrThrow({ where: { id: clientId } });
    if (client.estado === ClientStatus.BAJA) throw new BadRequestException('El cliente ya está dado de baja');

    await this.prisma.$transaction([
      this.prisma.client.update({ where: { id: clientId }, data: { estado: ClientStatus.BAJA } }),
      this.prisma.subscription.updateMany({ where: { clientId, estado: ClientStatus.ACTIVO }, data: { estado: ClientStatus.BAJA } }),
    ]);

    await this.audit.log(userId, 'CLIENT_DEACTIVATED', 'CLIENT', clientId);
    return this.prisma.client.findUnique({ where: { id: clientId }, include: { subscriptions: true } });
  }

  async reactivateClient(userId: string, clientId: string) {
    const client = await this.prisma.client.findUniqueOrThrow({ where: { id: clientId } });
    if (client.estado === ClientStatus.ACTIVO) throw new BadRequestException('El cliente ya está activo');

    await this.prisma.$transaction([
      this.prisma.client.update({ where: { id: clientId }, data: { estado: ClientStatus.ACTIVO } }),
      this.prisma.subscription.updateMany({ where: { clientId }, data: { estado: ClientStatus.ACTIVO } }),
    ]);

    await this.audit.log(userId, 'CLIENT_REACTIVATED', 'CLIENT', clientId);
    return this.prisma.client.findUnique({ where: { id: clientId }, include: { subscriptions: true } });
  }

  // ── Baja/Reactivación de suscripción ─────────────────────

  async deactivateSubscription(userId: string, clientId: string, subId: string) {
    const sub = await this.findSub(clientId, subId);
    if (sub.estado === ClientStatus.BAJA) throw new BadRequestException('La suscripción ya está dada de baja');

    await this.prisma.subscription.update({ where: { id: subId }, data: { estado: ClientStatus.BAJA } });

    // Si todas las suscripciones están en baja, dar de baja al cliente
    const activeSubs = await this.prisma.subscription.count({ where: { clientId, estado: ClientStatus.ACTIVO } });
    if (activeSubs === 0) {
      await this.prisma.client.update({ where: { id: clientId }, data: { estado: ClientStatus.BAJA } });
    }

    await this.audit.log(userId, 'SUBSCRIPTION_DEACTIVATED', 'SUBSCRIPTION', subId, { tipo: sub.tipo });
    return this.prisma.subscription.findUnique({ where: { id: subId } });
  }

  async reactivateSubscription(userId: string, clientId: string, subId: string) {
    const sub = await this.findSub(clientId, subId);
    if (sub.estado === ClientStatus.ACTIVO) throw new BadRequestException('La suscripción ya está activa');

    await this.prisma.subscription.update({ where: { id: subId }, data: { estado: ClientStatus.ACTIVO } });
    // Asegurar que el cliente quede activo
    await this.prisma.client.update({ where: { id: clientId }, data: { estado: ClientStatus.ACTIVO } });

    await this.audit.log(userId, 'SUBSCRIPTION_REACTIVATED', 'SUBSCRIPTION', subId, { tipo: sub.tipo });
    return this.prisma.subscription.findUnique({ where: { id: subId } });
  }

  async updateSubscriptionFechaAlta(userId: string, clientId: string, subId: string, fechaAlta: string) {
    const sub = await this.findSub(clientId, subId);
    const newDate = new Date(fechaAlta);
    if (newDate > new Date()) throw new BadRequestException('La fecha de alta no puede ser futura');
    if (newDate.getFullYear() < 1990) throw new BadRequestException('Fecha inválida');

    const before = sub.fechaAlta;
    await this.prisma.subscription.update({ where: { id: subId }, data: { fechaAlta: newDate } });

    await this.audit.log(userId, 'SUBSCRIPTION_FECHA_ALTA_UPDATED', 'SUBSCRIPTION', subId, {
      before: dayjs(before).format('YYYY-MM-DD'),
      after: dayjs(newDate).format('YYYY-MM-DD'),
    });
    return this.prisma.subscription.findUnique({ where: { id: subId } });
  }

  // ── Pago manual ──────────────────────────────────────────

  async createManualPayment(userId: string, clientId: string, subId: string, year: number, month: number) {
    const sub = await this.findSub(clientId, subId);
    const client = await this.prisma.client.findUniqueOrThrow({ where: { id: clientId } });

    // Validar no futuro
    const now = dayjs();
    if (year > now.year() || (year === now.year() && month > now.month() + 1)) {
      throw new BadRequestException('No se puede registrar un pago futuro');
    }

    // Verificar duplicado
    const existing = await this.prisma.paymentPeriod.findFirst({
      where: { subscriptionId: subId, year, month },
    });
    if (existing) {
      const monthNames = ['', 'ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
      throw new ConflictException(`El período ${monthNames[month]} ${year} ya está registrado`);
    }

    const periodo = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).toDate();
    const monthNames = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    const doc = await this.prisma.document.create({
      data: {
        clientId,
        codCli: client.codCli,
        subscriptionId: subId,
        tipo: 'RAMITO',
        fechaDocumento: periodo,
        numeroDocumento: `MANUAL-${Date.now()}`,
        descripcionOriginal: `Pago manual - ${monthNames[month]} ${year}`,
      },
    });

    const pp = await this.prisma.paymentPeriod.create({
      data: {
        clientId,
        codCli: client.codCli,
        documentId: doc.id,
        subscriptionId: subId,
        periodo,
        year,
        month,
      },
    });

    await this.audit.log(userId, 'PAYMENT_MANUAL_CREATED', 'PAYMENT', pp.id, {
      year, month, tipo: sub.tipo,
    });

    return { ...pp, document: doc };
  }

  async deleteManualPayment(userId: string, clientId: string, subId: string, periodId: string) {
    const pp = await this.prisma.paymentPeriod.findUnique({
      where: { id: periodId },
      include: { document: true },
    });
    if (!pp || pp.subscriptionId !== subId) throw new NotFoundException('Período no encontrado');
    if (!pp.document.numeroDocumento?.startsWith('MANUAL-')) {
      throw new ForbiddenException('Solo se pueden eliminar pagos manuales');
    }

    await this.prisma.$transaction([
      this.prisma.paymentPeriod.delete({ where: { id: periodId } }),
      this.prisma.document.delete({ where: { id: pp.documentId } }),
    ]);

    await this.audit.log(userId, 'PAYMENT_MANUAL_DELETED', 'PAYMENT', periodId, {
      year: pp.year, month: pp.month,
    });
  }

  // ── Notas ────────────────────────────────────────────────

  async createNote(userId: string, clientId: string, content: string) {
    if (!content || content.length > 1000) throw new BadRequestException('Contenido inválido (max 1000 caracteres)');

    const note = await this.prisma.clientNote.create({
      data: { clientId, userId, content },
      include: { user: { select: { name: true } } },
    });

    await this.audit.log(userId, 'NOTE_CREATED', 'NOTE', note.id);
    return note;
  }

  async deleteNote(userId: string, clientId: string, noteId: string) {
    const note = await this.prisma.clientNote.findUnique({ where: { id: noteId } });
    if (!note || note.clientId !== clientId) throw new NotFoundException('Nota no encontrada');

    await this.prisma.clientNote.delete({ where: { id: noteId } });
    await this.audit.log(userId, 'NOTE_DELETED', 'NOTE', noteId);
  }

  async getNotes(clientId: string) {
    return this.prisma.clientNote.findMany({
      where: { clientId },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Historial ────────────────────────────────────────────

  async getHistory(clientId: string) {
    // Get all entity IDs related to this client
    const subs = await this.prisma.subscription.findMany({ where: { clientId }, select: { id: true } });
    const notes = await this.prisma.clientNote.findMany({ where: { clientId }, select: { id: true } });
    const payments = await this.prisma.paymentPeriod.findMany({ where: { clientId }, select: { id: true } });

    const entityIds = [
      clientId,
      ...subs.map((s) => s.id),
      ...notes.map((n) => n.id),
      ...payments.map((p) => p.id),
    ];

    return this.audit.getByMultipleEntities(entityIds, 50);
  }

  // ── Helpers ──────────────────────────────────────────────

  private async findSub(clientId: string, subId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { id: subId } });
    if (!sub || sub.clientId !== clientId) throw new NotFoundException('Suscripción no encontrada');
    return sub;
  }
}
