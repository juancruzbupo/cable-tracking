import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { ServiceType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';

@Injectable()
export class PlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findActive(tipo?: ServiceType) {
    const where: any = { activo: true };
    if (tipo) where.tipo = tipo;
    return this.prisma.servicePlan.findMany({ where, orderBy: { nombre: 'asc' } });
  }

  async findAll() {
    return this.prisma.servicePlan.findMany({
      orderBy: { nombre: 'asc' },
      include: { _count: { select: { subscriptions: true } } },
    });
  }

  async create(userId: string, data: { nombre: string; tipo: ServiceType; precio: number; descripcion?: string }) {
    const plan = await this.prisma.servicePlan.create({
      data: { nombre: data.nombre, tipo: data.tipo, precio: data.precio, descripcion: data.descripcion },
    });
    await this.audit.log(userId, 'PLAN_CREATED', 'PLAN', plan.id, { nombre: data.nombre, tipo: data.tipo });
    return plan;
  }

  async update(userId: string, id: string, data: { nombre?: string; precio?: number; descripcion?: string; activo?: boolean }) {
    if (data.activo === false) {
      const count = await this.prisma.subscription.count({ where: { planId: id, estado: 'ACTIVO' } });
      if (count > 0) throw new BadRequestException(`Este plan tiene ${count} suscripciones activas. Reasignálas antes de desactivarlo.`);
    }
    const plan = await this.prisma.servicePlan.update({ where: { id }, data });
    const action = data.activo === false ? 'PLAN_DEACTIVATED' : 'PLAN_UPDATED';
    await this.audit.log(userId, action, 'PLAN', id, data);
    return plan;
  }

  async remove(userId: string, id: string) {
    const count = await this.prisma.subscription.count({ where: { planId: id } });
    if (count > 0) throw new BadRequestException(`Este plan tiene ${count} suscripciones. No se puede eliminar.`);
    await this.prisma.servicePlan.delete({ where: { id } });
    await this.audit.log(userId, 'PLAN_DELETED', 'PLAN', id);
  }
}
