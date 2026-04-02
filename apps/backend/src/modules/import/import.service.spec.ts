import { normalizeName } from '../../common/utils/normalize-name.util';
import { detectServiceType } from '../../common/utils/parse-periods.util';

/**
 * Import service tests — testing the pure logic functions used during import.
 * Full integration tests require Excel files + DB which are covered by e2e.
 */

describe('Import Logic — normalizeName', () => {
  it('normalizes to uppercase without noise', () => {
    expect(normalizeName('  gomez  roberto  ').nombreNormalizado).toBe('GOMEZ ROBERTO');
  });

  it('detects BAJA in name', () => {
    expect(normalizeName('LOPEZ DE BAJA').indicaBaja).toBe(true);
    expect(normalizeName('LOPEZ ACTIVO').indicaBaja).toBe(false);
  });
});

describe('Import Logic — detectServiceType', () => {
  it('detects INTERNET from description with megas keyword', () => {
    expect(detectServiceType('6 Megas Enero26')).toBe('INTERNET');
    expect(detectServiceType('Internet 100MB Feb26')).toBe('INTERNET');
    expect(detectServiceType('Fibra optica 50mb')).toBe('INTERNET');
  });

  it('detects CABLE from tvcable keyword', () => {
    expect(detectServiceType('TvCable Marzo26')).toBe('CABLE');
    expect(detectServiceType('TV Cable Abril26')).toBe('CABLE');
  });

  it('returns null for unknown description', () => {
    expect(detectServiceType('Servicio mensual')).toBeNull();
    expect(detectServiceType(null)).toBeNull();
  });
});

describe('Import Logic — MANUAL- preservation', () => {
  it('MANUAL- prefix pattern matches correctly', () => {
    const isManual = (num: string) => num.startsWith('MANUAL-');
    expect(isManual('MANUAL-1234567890')).toBe(true);
    expect(isManual('R00000001')).toBe(false);
    expect(isManual('MANUAL-')).toBe(true);
    expect(isManual('manual-123')).toBe(false); // case sensitive
  });
});
