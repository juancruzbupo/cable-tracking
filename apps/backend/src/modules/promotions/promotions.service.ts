import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PromoScope, PromoType } from '@prisma/client';
import dayjs from 'dayjs';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';

@Injectable()
export class PromotionsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async findAll(filters: { scope?: PromoScope; tipo?: PromoType; activa?: boolean; planId?: string }) {
    const where: any = {};
    if (filters.scope) where.scope = filters.scope;
    if (filters.tipo) where.tipo = filters.tipo;
    if (filters.activa !== undefined) where.activa = filters.activa;
    if (filters.planId) where.planId = filters.planId;
    return this.prisma.promotion.findMany({
      where,
      include: { plan: { select: { nombre: true, tipo: true } }, _count: { select: { clientPromotions: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findActive() {
    const today = new Date();
    return this.prisma.promotion.findMany({
      where: { activa: true, fechaInicio: { lte: today }, fechaFin: { gte: today } },
      include: { plan: { select: { nombre: true, tipo: true } } },
      orderBy: { nombre: 'asc' },
    });
  }

  async findOne(id: string) {
    const promo = await this.prisma.promotion.findUnique({
      where: { id },
      include: {
        plan: { select: { nombre: true, tipo: true } },
        clientPromotions: {
          include: { subscription: { include: { client: { select: { id: true, nombreNormalizado: true } } } } },
        },
      },
    });
    if (!promo) throw new NotFoundException('Promoción no encontrada');
    return promo;
  }

  async create(userId: string, data: {
    nombre: string; tipo: PromoType; valor: number; scope: PromoScope;
    fechaInicio: string; fechaFin: string; descripcion?: string; planId?: string;
  }) {
    const inicio = new Date(data.fechaInicio);
    const fin = new Date(data.fechaFin);
    if (fin <= inicio) throw new BadRequestException('fechaFin debe ser posterior a fechaInicio');
    if (data.scope === 'PLAN' && !data.planId) throw new BadRequestException('planId requerido para scope PLAN');
    if (data.scope === 'CLIENTE' && data.planId) throw new BadRequestException('planId no aplica para scope CLIENTE');
    if (data.tipo === 'PORCENTAJE' && (data.valor < 1 || data.valor > 100)) throw new BadRequestException('Porcentaje debe estar entre 1 y 100');
    if ((data.tipo === 'MONTO_FIJO' || data.tipo === 'PRECIO_FIJO') && data.valor <= 0) throw new BadRequestException('Valor debe ser mayor a 0');

    const promo = await this.prisma.promotion.create({
      data: {
        nombre: data.nombre,
        tipo: data.tipo,
        valor: data.tipo === 'MESES_GRATIS' ? 0 : data.valor,
        scope: data.scope,
        fechaInicio: inicio,
        fechaFin: fin,
        descripcion: data.descripcion,
        planId: data.planId || null,
      },
      include: { plan: { select: { nombre: true } } },
    });
    await this.audit.log(userId, 'PROMOTION_CREATED', 'PROMOTION', promo.id, { nombre: data.nombre, tipo: data.tipo, scope: data.scope });
    return promo;
  }

  async update(userId: string, id: string, data: { nombre?: string; descripcion?: string; fechaFin?: string; activa?: boolean }) {
    const updateData: any = {};
    if (data.nombre) updateData.nombre = data.nombre;
    if (data.descripcion !== undefined) updateData.descripcion = data.descripcion;
    if (data.fechaFin) updateData.fechaFin = new Date(data.fechaFin);
    if (data.activa !== undefined) updateData.activa = data.activa;

    const promo = await this.prisma.promotion.update({ where: { id }, data: updateData });
    const action = data.activa === false ? 'PROMOTION_DEACTIVATED' : 'PROMOTION_UPDATED';
    await this.audit.log(userId, action, 'PROMOTION', id, data);
    return promo;
  }

  async remove(userId: string, id: string) {
    const count = await this.prisma.clientPromotion.count({ where: { promotionId: id } });
    if (count > 0) throw new BadRequestException(`Esta promoción tiene ${count} asignaciones. Eliminalas primero.`);
    await this.prisma.promotion.delete({ where: { id } });
    await this.audit.log(userId, 'PROMOTION_DELETED', 'PROMOTION', id);
  }

  // ── Asignación a clientes ──

  async assignToSubscription(userId: string, clientId: string, subId: string, promotionId: string) {
    const promo = await this.prisma.promotion.findUnique({ where: { id: promotionId } });
    if (!promo || !promo.activa) throw new BadRequestException('Promoción no encontrada o inactiva');
    if (promo.scope !== 'CLIENTE') throw new BadRequestException('Solo se pueden asignar promos de scope CLIENTE');

    const sub = await this.prisma.subscription.findUnique({ where: { id: subId } });
    if (!sub || sub.clientId !== clientId) throw new NotFoundException('Suscripción no encontrada');

    try {
      const cp = await this.prisma.clientPromotion.create({
        data: { promotionId, subscriptionId: subId, assignedBy: userId },
        include: { promotion: true },
      });
      await this.audit.log(userId, 'PROMOTION_ASSIGNED', 'PROMOTION', promotionId, {
        promotionNombre: promo.nombre, subscriptionTipo: sub.tipo,
      });
      return cp;
    } catch {
      throw new ConflictException('Esta promo ya está asignada a esta suscripción');
    }
  }

  async removeFromSubscription(userId: string, clientId: string, subId: string, promoId: string) {
    const cp = await this.prisma.clientPromotion.findFirst({
      where: { promotionId: promoId, subscriptionId: subId },
    });
    if (!cp) throw new NotFoundException('Asignación no encontrada');
    await this.prisma.clientPromotion.delete({ where: { id: cp.id } });
    await this.audit.log(userId, 'PROMOTION_REMOVED', 'PROMOTION', promoId);
  }

  async getClientPromotions(clientId: string) {
    const subs = await this.prisma.subscription.findMany({
      where: { clientId },
      include: {
        plan: { include: { promotions: { where: { activa: true } } } },
        clientPromotions: { include: { promotion: true } },
      },
    });

    const today = dayjs();
    const result: Record<string, { promosPlan: any[]; promosCliente: any[] }> = {};

    for (const sub of subs) {
      const promosPlan = (sub.plan?.promotions || []).filter((p) =>
        today.isAfter(dayjs(p.fechaInicio).subtract(1, 'day')) && today.isBefore(dayjs(p.fechaFin).add(1, 'day')),
      );
      const promosCliente = sub.clientPromotions
        .map((cp) => cp.promotion)
        .filter((p) => p.activa && today.isAfter(dayjs(p.fechaInicio).subtract(1, 'day')) && today.isBefore(dayjs(p.fechaFin).add(1, 'day')));

      result[sub.tipo] = { promosPlan, promosCliente };
    }
    return result;
  }
}
