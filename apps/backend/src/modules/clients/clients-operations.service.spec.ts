import { ClientsOperationsService } from './clients-operations.service';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import dayjs from 'dayjs';

const mockPrisma = {
  client: { findUniqueOrThrow: jest.fn(), create: jest.fn(), update: jest.fn() },
  subscription: { findFirst: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  document: { create: jest.fn() },
  paymentPeriod: { findFirst: jest.fn(), create: jest.fn() },
  clientNote: { findMany: jest.fn(), create: jest.fn(), delete: jest.fn() },
  auditLog: { findMany: jest.fn(), findFirst: jest.fn() },
  $queryRawUnsafe: jest.fn(),
};

const mockAudit = { log: jest.fn(), getByMultipleEntities: jest.fn() };
const mockFiscal = { emitirComprobanteParaPago: jest.fn() };

function createService() {
  return new ClientsOperationsService(mockPrisma as any, mockAudit as any, mockFiscal as any);
}

beforeEach(() => jest.clearAllMocks());

describe('ClientsOperationsService', () => {
  describe('createManualPayment', () => {
    const setup = () => {
      mockPrisma.subscription.findUnique.mockResolvedValue({ id: 's1', clientId: 'c1', tipo: 'CABLE' });
      mockPrisma.client.findUniqueOrThrow.mockResolvedValue({ id: 'c1', codCli: '100', tipoComprobante: 'RAMITO' });
      mockPrisma.paymentPeriod.findFirst.mockResolvedValue(null); // no duplicate
      mockPrisma.document.create.mockResolvedValue({ id: 'd1' });
      mockPrisma.paymentPeriod.create.mockResolvedValue({ id: 'pp1' });
      mockFiscal.emitirComprobanteParaPago.mockResolvedValue(null);
    };

    it('creates document + payment period', async () => {
      setup();
      const svc = createService();
      const result = await svc.createManualPayment('u1', 'c1', 's1', 2026, 3);
      expect(mockPrisma.document.create).toHaveBeenCalled();
      expect(mockPrisma.paymentPeriod.create).toHaveBeenCalled();
      expect(result.id).toBe('pp1');
    });

    it('rejects future payments', async () => {
      setup();
      const svc = createService();
      const futureYear = dayjs().year() + 1;
      await expect(svc.createManualPayment('u1', 'c1', 's1', futureYear, 12))
        .rejects.toThrow(BadRequestException);
    });

    it('rejects duplicate period', async () => {
      setup();
      mockPrisma.paymentPeriod.findFirst.mockResolvedValue({ id: 'existing' });
      const svc = createService();
      await expect(svc.createManualPayment('u1', 'c1', 's1', 2026, 3))
        .rejects.toThrow(ConflictException);
    });

    it('auto-emits comprobante for FACTURA clients', async () => {
      setup();
      mockPrisma.client.findUniqueOrThrow.mockResolvedValue({ id: 'c1', codCli: '100', tipoComprobante: 'FACTURA' });
      mockFiscal.emitirComprobanteParaPago.mockResolvedValue({ id: 'comp1', tipo: 'RECIBO_X' });

      const svc = createService();
      const result = await svc.createManualPayment('u1', 'c1', 's1', 2026, 3);
      expect(mockFiscal.emitirComprobanteParaPago).toHaveBeenCalledWith('c1', 's1', 'pp1', 'u1');
      expect(result.comprobante).toBeDefined();
    });

    it('logs PAYMENT_MANUAL_CREATED audit', async () => {
      setup();
      const svc = createService();
      await svc.createManualPayment('u1', 'c1', 's1', 2026, 3);
      expect(mockAudit.log).toHaveBeenCalledWith('u1', 'PAYMENT_MANUAL_CREATED', 'PAYMENT', 'pp1', expect.any(Object));
    });
  });

  describe('logWhatsApp', () => {
    it('registers WHATSAPP_SENT in audit', async () => {
      const svc = createService();
      await svc.logWhatsApp('u1', 'c1');
      expect(mockAudit.log).toHaveBeenCalledWith('u1', 'WHATSAPP_SENT', 'CLIENT', 'c1', expect.any(Object));
    });
  });

  describe('getLastWhatsApp', () => {
    it('returns null when no sends', async () => {
      mockPrisma.auditLog.findFirst.mockResolvedValue(null);
      const svc = createService();
      expect(await svc.getLastWhatsApp('c1')).toBeNull();
    });

    it('returns last send info', async () => {
      mockPrisma.auditLog.findFirst.mockResolvedValue({ createdAt: new Date(), user: { name: 'Admin' } });
      const svc = createService();
      const result = await svc.getLastWhatsApp('c1');
      expect(result).toHaveProperty('sentAt');
      expect(result).toHaveProperty('sentBy', 'Admin');
    });
  });

  describe('getNotes', () => {
    it('returns notes with limit 100', async () => {
      mockPrisma.clientNote.findMany.mockResolvedValue([]);
      const svc = createService();
      await svc.getNotes('c1');
      const call = mockPrisma.clientNote.findMany.mock.calls[0][0];
      expect(call.take).toBe(100);
    });
  });
});
