import { parsePeriodsFromDescription, detectServiceType } from './parse-periods.util';

describe('parsePeriodsFromDescription', () => {
  it('"TvCable Enero26" → año 2026, mes 1', () => {
    const r = parsePeriodsFromDescription('TvCable Enero26');
    expect(r).toHaveLength(1);
    expect(r[0].year).toBe(2026);
    expect(r[0].month).toBe(1);
  });

  it('"6Megas Diciembre25" → año 2025, mes 12', () => {
    const r = parsePeriodsFromDescription('6Megas Diciembre25');
    expect(r).toHaveLength(1);
    expect(r[0].year).toBe(2025);
    expect(r[0].month).toBe(12);
  });

  it('"SUSCRIPCION DE TV CABLE" → periodos vacios', () => {
    expect(parsePeriodsFromDescription('SUSCRIPCION DE TV CABLE')).toHaveLength(0);
  });

  it('"RECONEXION INTERNET" → periodos vacios', () => {
    expect(parsePeriodsFromDescription('RECONEXION INTERNET')).toHaveLength(0);
  });

  it('año fuera de rango (2019) → ignorado', () => {
    expect(parsePeriodsFromDescription('Cable Enero19')).toHaveLength(0);
  });

  it('"SEPTIEMBRE" se parsea correctamente', () => {
    const r = parsePeriodsFromDescription('Cable Septiembre25');
    expect(r).toHaveLength(1);
    expect(r[0].month).toBe(9);
  });

  it('multiples periodos en una descripcion', () => {
    const r = parsePeriodsFromDescription('TvCable Noviembre25 Diciembre25');
    expect(r).toHaveLength(2);
  });

  it('descripcion vacia → array vacio', () => {
    expect(parsePeriodsFromDescription('')).toHaveLength(0);
  });
});

describe('detectServiceType', () => {
  it('"TvCable" → CABLE', () => {
    expect(detectServiceType('TvCable enero26')).toBe('CABLE');
  });

  it('"6 Megas Diciembre25" → INTERNET', () => {
    expect(detectServiceType('6 Megas Diciembre25')).toBe('INTERNET');
  });

  it('"Internet fibra" → INTERNET', () => {
    expect(detectServiceType('Internet fibra')).toBe('INTERNET');
  });

  it('null → null', () => {
    expect(detectServiceType(null)).toBe(null);
  });
});
