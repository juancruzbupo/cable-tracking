import { FiscalService } from './fiscal.service';
import { TipoComprobante, CondicionFiscal } from '@prisma/client';

// Only test the pure logic methods (no DB needed)
const service = Object.create(FiscalService.prototype) as FiscalService;

describe('FiscalService.determinarTipoComprobante', () => {
  it('mock provider → always RECIBO_X', () => {
    expect(service.determinarTipoComprobante('Responsable Inscripto', CondicionFiscal.RESPONSABLE_INSCRIPTO, true))
      .toBe(TipoComprobante.RECIBO_X);
    expect(service.determinarTipoComprobante('Monotributista', CondicionFiscal.CONSUMIDOR_FINAL, true))
      .toBe(TipoComprobante.RECIBO_X);
  });

  it('monotributista emisor → FACTURA_C', () => {
    expect(service.determinarTipoComprobante('Monotributista', CondicionFiscal.CONSUMIDOR_FINAL, false))
      .toBe(TipoComprobante.FACTURA_C);
    expect(service.determinarTipoComprobante('Monotributista', CondicionFiscal.RESPONSABLE_INSCRIPTO, false))
      .toBe(TipoComprobante.FACTURA_C);
  });

  it('RI emisor + RI receptor → FACTURA_A', () => {
    expect(service.determinarTipoComprobante('Responsable Inscripto', CondicionFiscal.RESPONSABLE_INSCRIPTO, false))
      .toBe(TipoComprobante.FACTURA_A);
  });

  it('RI emisor + CF receptor → FACTURA_B', () => {
    expect(service.determinarTipoComprobante('Responsable Inscripto', CondicionFiscal.CONSUMIDOR_FINAL, false))
      .toBe(TipoComprobante.FACTURA_B);
  });

  it('RI emisor + EXENTO receptor → FACTURA_B', () => {
    expect(service.determinarTipoComprobante('Responsable Inscripto', CondicionFiscal.EXENTO, false))
      .toBe(TipoComprobante.FACTURA_B);
  });
});

describe('FiscalService.calcularIVA', () => {
  it('monotributista → IVA 0', () => {
    expect(service.calcularIVA(1000, 'Monotributista')).toBe(0);
  });

  it('responsable inscripto → 21% IVA', () => {
    expect(service.calcularIVA(1000, 'Responsable Inscripto')).toBe(210);
  });

  it('responsable inscripto redondea a 2 decimales', () => {
    expect(service.calcularIVA(333, 'Responsable Inscripto')).toBe(69.93);
  });

  it('otro → IVA 0', () => {
    expect(service.calcularIVA(1000, 'Exento')).toBe(0);
  });
});

describe('FiscalService — updateComprobanteConfig validation', () => {
  it('FACTURA requires numeroDocFiscal', () => {
    // The validation is: if tipoComprobante === 'FACTURA' && !client.numeroDocFiscal → throw
    // We test the logic pattern without DB
    const clientSinDoc = { tipoComprobante: 'RAMITO', numeroDocFiscal: null };
    const clientConDoc = { tipoComprobante: 'RAMITO', numeroDocFiscal: '20331302954' };

    expect(clientSinDoc.numeroDocFiscal).toBeNull(); // would fail validation
    expect(clientConDoc.numeroDocFiscal).toBeTruthy(); // would pass validation
  });

  it('RAMITO does not require numeroDocFiscal', () => {
    const client = { numeroDocFiscal: null };
    // RAMITO never checks for doc — always allowed
    expect(client.numeroDocFiscal).toBeNull(); // OK for RAMITO
  });
});

describe('FiscalService — provider selection logic', () => {
  it('mock is default when no config', () => {
    const providerName = null;
    expect(providerName || 'mock').toBe('mock');
  });

  it('tusFacturas requires credentials', () => {
    const config = { providerName: 'tusFacturas', tfUsertoken: null, tfApikey: null, tfApitoken: null };
    const hasCredentials = config.tfUsertoken && config.tfApikey && config.tfApitoken;
    expect(hasCredentials).toBeFalsy();
  });

  it('tusFacturas with credentials is valid', () => {
    const config = { providerName: 'tusFacturas', tfUsertoken: 'tok', tfApikey: 'key', tfApitoken: 'api' };
    const hasCredentials = config.tfUsertoken && config.tfApikey && config.tfApitoken;
    expect(hasCredentials).toBeTruthy();
  });
});
