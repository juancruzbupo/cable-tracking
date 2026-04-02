import { EquipmentService } from './equipment.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

const mockPrisma = {
  equipment: { findMany: jest.fn(), findUniqueOrThrow: jest.fn(), create: jest.fn(), update: jest.fn(), count: jest.fn() },
  equipmentAssignment: { findMany: jest.fn(), create: jest.fn(), update: jest.fn(), findUniqueOrThrow: jest.fn(), count: jest.fn() },
};
const mockAudit = { log: jest.fn() };

function createService() { return new EquipmentService(mockPrisma as any, mockAudit as any); }

beforeEach(() => jest.clearAllMocks());

describe('EquipmentService', () => {
  describe('getStats', () => {
    it('returns counts by status', async () => {
      mockPrisma.equipment.count.mockResolvedValue(10);
      const svc = createService();
      const stats = await svc.getStats();
      expect(stats).toHaveProperty('totalEquipos');
      expect(stats).toHaveProperty('porEstado');
    });
  });

  describe('create', () => {
    it('creates equipment and logs audit', async () => {
      mockPrisma.equipment.create.mockResolvedValue({ id: 'e1', tipo: 'MODEM' });
      const svc = createService();
      await svc.create('u1', { tipo: 'MODEM', marca: 'TP-Link' });
      expect(mockPrisma.equipment.create).toHaveBeenCalled();
      expect(mockAudit.log).toHaveBeenCalledWith('u1', 'EQUIPMENT_CREATED', 'EQUIPMENT', 'e1', expect.any(Object));
    });
  });

  describe('assignToClient', () => {
    it('rejects if equipment not EN_DEPOSITO', async () => {
      mockPrisma.equipment.findUniqueOrThrow.mockResolvedValue({ id: 'e1', estado: 'ASIGNADO' });
      const svc = createService();
      await expect(svc.assignToClient('u1', 'c1', 'e1')).rejects.toThrow(BadRequestException);
    });

    it('creates assignment and updates status to ASIGNADO', async () => {
      mockPrisma.equipment.findUniqueOrThrow.mockResolvedValue({ id: 'e1', estado: 'EN_DEPOSITO', tipo: 'MODEM' });
      mockPrisma.equipmentAssignment.create.mockResolvedValue({ id: 'a1', equipment: {} });
      mockPrisma.equipment.update.mockResolvedValue({});
      const svc = createService();
      await svc.assignToClient('u1', 'c1', 'e1');
      expect(mockPrisma.equipment.update).toHaveBeenCalledWith({ where: { id: 'e1' }, data: { estado: 'ASIGNADO' } });
      expect(mockAudit.log).toHaveBeenCalledWith('u1', 'EQUIPMENT_ASSIGNED', 'EQUIPMENT', 'e1', expect.any(Object));
    });
  });

  describe('retire', () => {
    it('rejects if assignment belongs to different client', async () => {
      mockPrisma.equipmentAssignment.findUniqueOrThrow.mockResolvedValue({ id: 'a1', clientId: 'c2', fechaRetiro: null, equipmentId: 'e1' });
      const svc = createService();
      await expect(svc.retire('u1', 'c1', 'a1')).rejects.toThrow(NotFoundException);
    });

    it('rejects if already retired', async () => {
      mockPrisma.equipmentAssignment.findUniqueOrThrow.mockResolvedValue({ id: 'a1', clientId: 'c1', fechaRetiro: new Date(), equipmentId: 'e1' });
      const svc = createService();
      await expect(svc.retire('u1', 'c1', 'a1')).rejects.toThrow(BadRequestException);
    });

    it('retires and sets equipment back to EN_DEPOSITO', async () => {
      mockPrisma.equipmentAssignment.findUniqueOrThrow.mockResolvedValue({ id: 'a1', clientId: 'c1', fechaRetiro: null, equipmentId: 'e1' });
      mockPrisma.equipmentAssignment.update.mockResolvedValue({});
      mockPrisma.equipment.update.mockResolvedValue({});
      const svc = createService();
      await svc.retire('u1', 'c1', 'a1');
      expect(mockPrisma.equipment.update).toHaveBeenCalledWith({ where: { id: 'e1' }, data: { estado: 'EN_DEPOSITO' } });
      expect(mockAudit.log).toHaveBeenCalledWith('u1', 'EQUIPMENT_RETIRED', 'EQUIPMENT', 'e1', expect.any(Object));
    });
  });

  describe('update', () => {
    it('rejects EN_DEPOSITO if has active assignments', async () => {
      mockPrisma.equipmentAssignment.count.mockResolvedValue(1);
      const svc = createService();
      await expect(svc.update('e1', { estado: 'EN_DEPOSITO' as any })).rejects.toThrow(BadRequestException);
    });
  });
});
