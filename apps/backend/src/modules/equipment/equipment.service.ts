import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { EquipmentStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';

@Injectable()
export class EquipmentService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async findAll(filters: { tipo?: string; estado?: EquipmentStatus; search?: string }) {
    const where: any = {};
    if (filters.tipo) where.tipo = filters.tipo;
    if (filters.estado) where.estado = filters.estado;
    if (filters.search) {
      where.OR = [
        { marca: { contains: filters.search, mode: 'insensitive' } },
        { modelo: { contains: filters.search, mode: 'insensitive' } },
        { numeroSerie: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.equipment.findMany({
      where,
      include: {
        assignments: {
          where: { fechaRetiro: null },
          include: { client: { select: { id: true, nombreNormalizado: true } } },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getStats() {
    const [total, enDeposito, asignados, enReparacion, deBaja] = await Promise.all([
      this.prisma.equipment.count(),
      this.prisma.equipment.count({ where: { estado: 'EN_DEPOSITO' } }),
      this.prisma.equipment.count({ where: { estado: 'ASIGNADO' } }),
      this.prisma.equipment.count({ where: { estado: 'EN_REPARACION' } }),
      this.prisma.equipment.count({ where: { estado: 'DE_BAJA' } }),
    ]);
    return { totalEquipos: total, porEstado: { enDeposito, asignados, enReparacion, deBaja } };
  }

  async findOne(id: string) {
    return this.prisma.equipment.findUniqueOrThrow({
      where: { id },
      include: { assignments: { include: { client: { select: { id: true, nombreNormalizado: true } } }, orderBy: { createdAt: 'desc' } } },
    });
  }

  async create(userId: string, data: { tipo: string; marca?: string; modelo?: string; numeroSerie?: string; notas?: string }) {
    const eq = await this.prisma.equipment.create({ data });
    await this.audit.log(userId, 'EQUIPMENT_CREATED', 'EQUIPMENT', eq.id, { tipo: data.tipo, numeroSerie: data.numeroSerie });
    return eq;
  }

  async update(id: string, data: { marca?: string; modelo?: string; notas?: string; estado?: EquipmentStatus }) {
    if (data.estado === 'EN_DEPOSITO') {
      const assigned = await this.prisma.equipmentAssignment.count({ where: { equipmentId: id, fechaRetiro: null } });
      if (assigned > 0) throw new BadRequestException('El equipo está asignado. Retirarlo primero.');
    }
    return this.prisma.equipment.update({ where: { id }, data });
  }

  async getClientEquipment(clientId: string) {
    return this.prisma.equipmentAssignment.findMany({
      where: { clientId },
      include: { equipment: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async assignToClient(userId: string, clientId: string, equipmentId: string, notas?: string) {
    const eq = await this.prisma.equipment.findUniqueOrThrow({ where: { id: equipmentId } });
    if (eq.estado !== 'EN_DEPOSITO') throw new BadRequestException('El equipo no está disponible (debe estar EN_DEPOSITO)');

    const assignment = await this.prisma.equipmentAssignment.create({
      data: { equipmentId, clientId, notas },
      include: { equipment: true },
    });
    await this.prisma.equipment.update({ where: { id: equipmentId }, data: { estado: 'ASIGNADO' } });
    await this.audit.log(userId, 'EQUIPMENT_ASSIGNED', 'EQUIPMENT', equipmentId, { clientId, tipo: eq.tipo, numeroSerie: eq.numeroSerie });
    return assignment;
  }

  async retire(userId: string, clientId: string, assignmentId: string, notas?: string) {
    const asig = await this.prisma.equipmentAssignment.findUniqueOrThrow({ where: { id: assignmentId } });
    if (asig.clientId !== clientId) throw new NotFoundException('Asignación no encontrada');
    if (asig.fechaRetiro) throw new BadRequestException('El equipo ya fue retirado');

    await this.prisma.equipmentAssignment.update({ where: { id: assignmentId }, data: { fechaRetiro: new Date(), notas } });
    await this.prisma.equipment.update({ where: { id: asig.equipmentId }, data: { estado: 'EN_DEPOSITO' } });
    await this.audit.log(userId, 'EQUIPMENT_RETIRED', 'EQUIPMENT', asig.equipmentId, { clientId });
  }
}
