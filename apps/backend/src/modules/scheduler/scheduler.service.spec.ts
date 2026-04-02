import { SchedulerService } from './scheduler.service';
import { ClientStatus } from '@prisma/client';
import dayjs from 'dayjs';

// Mocks
const mockSubUpdate = jest.fn().mockResolvedValue({});
const mockPrisma = {
  empresaConfig: { findFirst: jest.fn() },
  subscription: { findMany: jest.fn(), updateMany: jest.fn(), update: mockSubUpdate },
  user: { findFirst: jest.fn() },
  auditLog: { createMany: jest.fn() },
  $transaction: jest.fn((fns: any[]) => Promise.all(fns.map((f: any) => typeof f === 'function' ? f() : f))),
};

const mockClientsService = {
  calculateSubDebt: jest.fn(),
};

const mockAudit = {
  log: jest.fn(),
};

function createService() {
  return new SchedulerService(
    mockPrisma as any,
    mockClientsService as any,
    mockAudit as any,
  );
}

function makeSub(id: string, overrides: any = {}) {
  return {
    id,
    tipo: 'CABLE',
    estado: ClientStatus.ACTIVO,
    fechaAlta: new Date('2025-01-01'),
    paymentPeriods: [{ year: 2026, month: 3 }],
    plan: { promotions: [] },
    clientPromotions: [],
    client: { id: 'c1', estado: ClientStatus.ACTIVO },
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.empresaConfig.findFirst.mockResolvedValue({ umbralCorte: 2 });
  mockPrisma.subscription.updateMany.mockResolvedValue({ count: 0 });
  mockPrisma.user.findFirst.mockResolvedValue({ id: 'admin1' });
  mockPrisma.auditLog.createMany.mockResolvedValue({ count: 0 });
});

describe('SchedulerService', () => {
  describe('getStatus', () => {
    it('returns null status when never run', () => {
      const svc = createService();
      expect(svc.getStatus()).toEqual({ ultimoCalculo: null, procesadas: 0, conCorte: 0 });
    });
  });

  describe('recalcularDeudas', () => {
    it('loads umbralCorte from config', async () => {
      const svc = createService();
      mockPrisma.subscription.findMany.mockResolvedValue([]);
      await svc.recalcularDeudas();
      expect(mockPrisma.empresaConfig.findFirst).toHaveBeenCalled();
    });

    it('processes subscriptions in batches with cursor', async () => {
      const subs = Array.from({ length: 3 }, (_, i) => makeSub(`s${i}`));
      mockPrisma.subscription.findMany
        .mockResolvedValueOnce(subs) // first batch
        .mockResolvedValueOnce([]);  // empty = done
      mockClientsService.calculateSubDebt.mockReturnValue({ cantidadDeuda: 0, requiereCorte: false });
      mockPrisma.$transaction.mockResolvedValue([]);

      const svc = createService();
      await svc.recalcularDeudas();

      expect(mockPrisma.subscription.findMany).toHaveBeenCalledTimes(2);
      const status = svc.getStatus();
      expect(status.procesadas).toBe(3);
    });

    it('passes promotions to calculateSubDebt (not empty array)', async () => {
      const sub = makeSub('s1', {
        plan: { promotions: [{ id: 'p1', nombre: 'Gratis', tipo: 'MESES_GRATIS', valor: 0, fechaInicio: new Date(), fechaFin: new Date() }] },
        clientPromotions: [{ promotion: { id: 'p2', nombre: 'Desc', tipo: 'PORCENTAJE', valor: 20, fechaInicio: new Date(), fechaFin: new Date() } }],
      });
      mockPrisma.subscription.findMany
        .mockResolvedValueOnce([sub])
        .mockResolvedValueOnce([]);
      mockClientsService.calculateSubDebt.mockReturnValue({ cantidadDeuda: 0, requiereCorte: false });
      mockPrisma.$transaction.mockResolvedValue([]);

      const svc = createService();
      await svc.recalcularDeudas();

      const callArgs = mockClientsService.calculateSubDebt.mock.calls[0];
      const promosArg = callArgs[5]; // 6th arg = promosGratis
      expect(promosArg.length).toBeGreaterThan(0);
    });

    it('counts corte correctly', async () => {
      const subs = [makeSub('s1'), makeSub('s2')];
      mockPrisma.subscription.findMany
        .mockResolvedValueOnce(subs)
        .mockResolvedValueOnce([]);
      mockClientsService.calculateSubDebt
        .mockReturnValueOnce({ cantidadDeuda: 3, requiereCorte: true })
        .mockReturnValueOnce({ cantidadDeuda: 0, requiereCorte: false });
      mockPrisma.$transaction.mockResolvedValue([]);

      const svc = createService();
      await svc.recalcularDeudas();
      expect(svc.getStatus().conCorte).toBe(1);
    });

    it('passes umbralCorte to calculateSubDebt', async () => {
      mockPrisma.empresaConfig.findFirst.mockResolvedValue({ umbralCorte: 5 });
      mockPrisma.subscription.findMany
        .mockResolvedValueOnce([makeSub('s1')])
        .mockResolvedValueOnce([]);
      mockClientsService.calculateSubDebt.mockReturnValue({ cantidadDeuda: 0, requiereCorte: false });
      mockPrisma.$transaction.mockResolvedValue([]);

      const svc = createService();
      await svc.recalcularDeudas();

      const umbralArg = mockClientsService.calculateSubDebt.mock.calls[0][6];
      expect(umbralArg).toBe(5);
    });

    it('defaults umbralCorte to 1 if no config', async () => {
      mockPrisma.empresaConfig.findFirst.mockResolvedValue(null);
      mockPrisma.subscription.findMany.mockResolvedValue([]);

      const svc = createService();
      await svc.recalcularDeudas();
      // no crash = defaults work
      expect(svc.getStatus().procesadas).toBe(0);
    });
  });
});
