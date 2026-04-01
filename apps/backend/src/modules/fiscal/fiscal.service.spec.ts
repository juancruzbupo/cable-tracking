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
