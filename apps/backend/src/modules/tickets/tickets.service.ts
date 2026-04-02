import { Injectable, BadRequestException } from '@nestjs/common';
import { TicketType } from '@prisma/client';
import dayjs from 'dayjs';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async findAll(filters: { estado?: string; tipo?: TicketType; clientId?: string; page?: number; limit?: number }) {
    const where: any = {};
    if (filters.estado) where.estado = filters.estado;
    if (filters.tipo) where.tipo = filters.tipo;
    if (filters.clientId) where.clientId = filters.clientId;

    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 20, 100);

    const [data, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        include: { client: { select: { id: true, nombreNormalizado: true, codCli: true } } },
        orderBy: [{ estado: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.ticket.count({ where }),
    ]);
    return { data, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async getStats() {
    const [abiertos, resueltos] = await Promise.all([
      this.prisma.ticket.count({ where: { estado: 'ABIERTO' } }),
      this.prisma.ticket.count({ where: { estado: 'RESUELTO' } }),
    ]);

    const porTipo = await this.prisma.ticket.groupBy({
      by: ['tipo'],
      where: { estado: 'ABIERTO' },
      _count: true,
    });

    const resolved30d = await this.prisma.ticket.findMany({
      where: { estado: 'RESUELTO', resuelto: { gte: dayjs().subtract(30, 'day').toDate() } },
      select: { createdAt: true, resuelto: true },
    });

    const avgHours = resolved30d.length > 0
      ? resolved30d.reduce((sum, t) => sum + dayjs(t.resuelto!).diff(dayjs(t.createdAt), 'hour'), 0) / resolved30d.length
      : 0;

    return {
      abiertos,
      resueltos,
      porTipo: Object.fromEntries(porTipo.map((g) => [g.tipo, g._count])),
      tiempoPromedioResolucion: Math.round(avgHours),
    };
  }

  async getClientTickets(clientId: string) {
    return this.prisma.ticket.findMany({
      where: { clientId },
      orderBy: [{ estado: 'asc' }, { createdAt: 'desc' }],
      take: 50,
    });
  }

  async create(userId: string, clientId: string, tipo: TicketType, descripcion?: string) {
    const ticket = await this.prisma.ticket.create({
      data: { clientId, tipo, descripcion, creadoPor: userId },
    });
    await this.audit.log(userId, 'TICKET_CREATED', 'TICKET', ticket.id, { tipo, clientId });
    return ticket;
  }

  async resolve(userId: string, ticketId: string, notas?: string) {
    const ticket = await this.prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });
    if (ticket.estado !== 'ABIERTO') throw new BadRequestException('El ticket ya está resuelto');

    const resolved = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: { estado: 'RESUELTO', resuelto: new Date(), notas },
    });

    const hours = dayjs().diff(dayjs(ticket.createdAt), 'hour');
    await this.audit.log(userId, 'TICKET_RESOLVED', 'TICKET', ticketId, { tiempoResolucion: hours });
    return resolved;
  }
}
