import { TicketsService } from './tickets.service';
import { BadRequestException } from '@nestjs/common';

const mockPrisma = {
  ticket: { findMany: jest.fn(), findUniqueOrThrow: jest.fn(), create: jest.fn(), update: jest.fn(), count: jest.fn(), groupBy: jest.fn() },
};
const mockAudit = { log: jest.fn() };

function createService() { return new TicketsService(mockPrisma as any, mockAudit as any); }

beforeEach(() => jest.clearAllMocks());

describe('TicketsService', () => {
  describe('create', () => {
    it('creates ticket ABIERTO and logs audit', async () => {
      mockPrisma.ticket.create.mockResolvedValue({ id: 't1', tipo: 'SIN_SENIAL', estado: 'ABIERTO' });
      const svc = createService();
      const result = await svc.create('u1', 'c1', 'SIN_SENIAL' as any, 'Sin señal hace 2 días');
      expect(mockPrisma.ticket.create).toHaveBeenCalledWith({
        data: { clientId: 'c1', tipo: 'SIN_SENIAL', descripcion: 'Sin señal hace 2 días', creadoPor: 'u1' },
      });
      expect(mockAudit.log).toHaveBeenCalledWith('u1', 'TICKET_CREATED', 'TICKET', 't1', expect.any(Object));
    });
  });

  describe('resolve', () => {
    it('resolves open ticket', async () => {
      mockPrisma.ticket.findUniqueOrThrow.mockResolvedValue({ id: 't1', estado: 'ABIERTO', createdAt: new Date() });
      mockPrisma.ticket.update.mockResolvedValue({ id: 't1', estado: 'RESUELTO' });
      const svc = createService();
      await svc.resolve('u1', 't1', 'Reinicié el modem');
      expect(mockPrisma.ticket.update).toHaveBeenCalledWith({
        where: { id: 't1' },
        data: { estado: 'RESUELTO', resuelto: expect.any(Date), notas: 'Reinicié el modem' },
      });
      expect(mockAudit.log).toHaveBeenCalledWith('u1', 'TICKET_RESOLVED', 'TICKET', 't1', expect.any(Object));
    });

    it('rejects if already resolved', async () => {
      mockPrisma.ticket.findUniqueOrThrow.mockResolvedValue({ id: 't1', estado: 'RESUELTO' });
      const svc = createService();
      await expect(svc.resolve('u1', 't1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getClientTickets', () => {
    it('returns tickets with limit 50', async () => {
      mockPrisma.ticket.findMany.mockResolvedValue([]);
      const svc = createService();
      await svc.getClientTickets('c1');
      const call = mockPrisma.ticket.findMany.mock.calls[0][0];
      expect(call.take).toBe(50);
      expect(call.where.clientId).toBe('c1');
    });
  });

  describe('getStats', () => {
    it('calculates average resolution time', async () => {
      const now = new Date();
      const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
      mockPrisma.ticket.count.mockResolvedValue(0);
      mockPrisma.ticket.groupBy.mockResolvedValue([]);
      mockPrisma.ticket.findMany.mockResolvedValue([
        { createdAt: twoDaysAgo, resuelto: now },
      ]);

      const svc = createService();
      const stats = await svc.getStats();
      expect(stats.tiempoPromedioResolucion).toBe(48); // ~48 hours
    });
  });
});
