import { ClientsService } from './clients.service';
import { DebtService } from './debt.service';
import { ClientStatus, ServiceType } from '@prisma/client';

const mockPrisma = {
  client: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
  },
  document: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
  $queryRaw: jest.fn(),
};

const mockRepository = {
  findAllPaginated: jest.fn(),
  findById: jest.fn(),
  getDebtStatsBuckets: jest.fn(),
  getClientIdsForDebtFilter: jest.fn(),
  getClientesParaCorte: jest.fn(),
  getScoringDistribution: jest.fn(),
  countByEstado: jest.fn(),
  findDocumentsByClient: jest.fn(),
};

const debtService = new DebtService();

function createService() {
  return new ClientsService(mockPrisma as any, debtService, mockRepository as any);
}

/** Client shape for list views (precomputed subscription fields) */
function makeClientList(overrides: any = {}) {
  return {
    id: 'c1', codCli: '100', nombreOriginal: 'TEST', nombreNormalizado: 'TEST',
    estado: ClientStatus.ACTIVO, fechaAlta: new Date('2025-01-01'), calle: 'Calle 1',
    zona: 'Centro', telefono: '123456', tipoComprobante: 'RAMITO',
    subscriptions: [{
      id: 's1', tipo: ServiceType.CABLE,
      deudaCalculada: 0, requiereCorte: false,
    }],
    _count: { tickets: 0 },
    ...overrides,
  };
}

/** Client shape for detail views (full subscription with payment periods) */
function makeClient(overrides: any = {}) {
  return {
    id: 'c1', codCli: '100', nombreOriginal: 'TEST', nombreNormalizado: 'TEST',
    estado: ClientStatus.ACTIVO, fechaAlta: new Date('2025-01-01'), calle: 'Calle 1',
    zona: 'Centro', telefono: '123456', tipoComprobante: 'RAMITO',
    subscriptions: [{
      id: 's1', tipo: ServiceType.CABLE, estado: ClientStatus.ACTIVO,
      fechaAlta: new Date('2025-06-01'),
      paymentPeriods: [{ year: 2026, month: 3 }],
      plan: { promotions: [] }, clientPromotions: [],
    }],
    _count: { tickets: 0 },
    ...overrides,
  };
}

beforeEach(() => jest.clearAllMocks());

describe('ClientsService', () => {
  describe('findAll', () => {
    it('returns paginated data without debtStatus filter', async () => {
      const clients = [makeClientList()];
      mockRepository.findAllPaginated.mockResolvedValue({ clients, total: 1 });

      const svc = createService();
      const result = await svc.findAll({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.pagination).toEqual({ total: 1, page: 1, limit: 20, totalPages: 1 });
      expect(result.data[0].debtInfo).toBeDefined();
      expect(result.data[0].scoring).toBeDefined();
      expect(result.data[0].ticketsAbiertos).toBe(0);
    });

    it('passes search to repository where clause', async () => {
      mockRepository.findAllPaginated.mockResolvedValue({ clients: [], total: 0 });

      const svc = createService();
      await svc.findAll({ search: 'GOMEZ', page: 1, limit: 20 });

      const call = mockRepository.findAllPaginated.mock.calls[0];
      expect(call[0].OR).toBeDefined();
      expect(call[0].OR[0].nombreNormalizado.contains).toBe('GOMEZ');
    });

    it('passes zona to repository where clause', async () => {
      mockRepository.findAllPaginated.mockResolvedValue({ clients: [], total: 0 });

      const svc = createService();
      await svc.findAll({ zona: 'Norte', page: 1, limit: 20 });

      const call = mockRepository.findAllPaginated.mock.calls[0];
      expect(call[0].zona).toBe('Norte');
    });

    it('filters by debtStatus at DB level using repository', async () => {
      // Repository returns matching client IDs
      mockRepository.getClientIdsForDebtFilter.mockResolvedValue([{ id: 'c1' }]);
      const clientAlDia = makeClientList({ id: 'c1', subscriptions: [{ id: 's1', tipo: ServiceType.CABLE, deudaCalculada: 0, requiereCorte: false }] });
      mockRepository.findAllPaginated.mockResolvedValue({ clients: [clientAlDia], total: 1 });

      const svc = createService();
      const result = await svc.findAll({ debtStatus: 'AL_DIA', page: 1, limit: 20 });

      expect(mockRepository.getClientIdsForDebtFilter).toHaveBeenCalled();
      expect(result.data).toHaveLength(1);
      result.data.forEach((c: any) => expect(c.debtInfo.cantidadDeuda).toBe(0));
    });

    it('includes scoring in response', async () => {
      mockRepository.findAllPaginated.mockResolvedValue({ clients: [makeClientList()], total: 1 });

      const svc = createService();
      const result = await svc.findAll({ page: 1, limit: 20 });

      const scoring = result.data[0].scoring;
      expect(['BUENO', 'REGULAR', 'RIESGO', 'CRITICO']).toContain(scoring);
    });
  });

  describe('findOneWithDebt', () => {
    it('returns null if client not found', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(null);

      const svc = createService();
      const result = await svc.findOneWithDebt('nonexistent');
      expect(result).toBeNull();
    });

    it('returns fiscal fields in response', async () => {
      const client = makeClient({ tipoDocumento: 'CUIT', numeroDocFiscal: '20331302954', condicionFiscal: 'MONOTRIBUTISTA', razonSocial: 'Test SA', email: 'test@test.com', codigoPostal: '3100', localidad: 'Paraná', provincia: 'Entre Ríos' });
      mockPrisma.client.findUnique.mockResolvedValue(client);
      mockRepository.findDocumentsByClient.mockResolvedValue({ documents: [], total: 0 });

      const svc = createService();
      const result = await svc.findOneWithDebt('c1');

      expect(result).not.toBeNull();
      expect(result!.telefono).toBe('123456');
      expect(result!.tipoDocumento).toBe('CUIT');
      expect(result!.zona).toBe('Centro');
      expect(result!.tipoComprobante).toBe('RAMITO');
    });

    it('returns documents with pagination', async () => {
      mockPrisma.client.findUnique.mockResolvedValue(makeClient());
      mockRepository.findDocumentsByClient.mockResolvedValue({
        documents: [{ id: 'd1', tipo: 'RAMITO', fechaDocumento: null, numeroDocumento: null, descripcionOriginal: null, paymentPeriods: [], subscription: null }],
        total: 1,
      });

      const svc = createService();
      const result = await svc.findOneWithDebt('c1', 1, 10);

      expect(result!.documents).toHaveLength(1);
      expect(result!.docPagination).toEqual({ total: 1, page: 1, limit: 10, totalPages: 1 });
    });
  });

  describe('getDebtStats', () => {
    it('counts debt categories correctly using repository', async () => {
      mockRepository.getDebtStatsBuckets.mockResolvedValue([
        { bucket: 'alDia', cnt: 5 },
        { bucket: 'unMes', cnt: 3 },
        { bucket: 'dosMeses', cnt: 2 },
        { bucket: 'masDosMeses', cnt: 1 },
      ]);
      mockRepository.countByEstado.mockResolvedValue(11);
      mockRepository.getClientesParaCorte.mockResolvedValue([{ nombre_normalizado: 'CLIENT A' }]);
      mockRepository.getScoringDistribution.mockResolvedValue([
        { scoring: 'bueno', cnt: 5 },
        { scoring: 'regular', cnt: 3 },
        { scoring: 'riesgo', cnt: 2 },
        { scoring: 'critico', cnt: 1 },
      ]);

      const svc = createService();
      const stats = await svc.getDebtStats();

      expect(stats.total).toBe(11);
      expect(stats.alDia).toBe(5);
      expect(stats.unMes).toBe(3);
      expect(stats.dosMeses).toBe(2);
      expect(stats.masDosMeses).toBe(1);
      expect(stats.clientesParaCorte).toEqual(['CLIENT A']);
      expect(stats.scoring).toBeDefined();
      expect(stats.scoring.bueno + stats.scoring.regular + stats.scoring.riesgo + stats.scoring.critico).toBe(11);
    });
  });

  describe('DebtService.calcularScoring', () => {
    it('BUENO when no debt', () => expect(DebtService.calcularScoring(0, false)).toBe('BUENO'));
    it('REGULAR when 1 month', () => expect(DebtService.calcularScoring(1, false)).toBe('REGULAR'));
    it('RIESGO when 2-3 months', () => {
      expect(DebtService.calcularScoring(2, false)).toBe('RIESGO');
      expect(DebtService.calcularScoring(3, false)).toBe('RIESGO');
    });
    it('CRITICO when 4+ months', () => expect(DebtService.calcularScoring(4, false)).toBe('CRITICO'));
    it('CRITICO when requiereCorte', () => expect(DebtService.calcularScoring(2, true)).toBe('CRITICO'));
  });
});
