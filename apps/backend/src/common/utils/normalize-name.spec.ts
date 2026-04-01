import { normalizeName } from './normalize-name.util';

describe('normalizeName', () => {
  it('nombre limpio sin ruido → retorna igual en mayusculas', () => {
    const r = normalizeName('PEREZ JUAN');
    expect(r.nombreNormalizado).toBe('PEREZ JUAN');
    expect(r.indicaBaja).toBe(false);
  });

  it('"PEREZ JUAN DE BAJA" → nombreNormalizado sin "DE BAJA", indicaBaja true', () => {
    const r = normalizeName('PEREZ JUAN DE BAJA');
    expect(r.nombreNormalizado).toBe('PEREZ JUAN');
    expect(r.indicaBaja).toBe(true);
  });

  it('"GONZALEZ ANA SOLO INTERNET" → limpia "SOLO INTERNET"', () => {
    const r = normalizeName('GONZALEZ ANA SOLO INTERNET');
    expect(r.nombreNormalizado).not.toContain('INTERNET');
  });

  it('"ZAPATA ROSENDO 6megas" → limpia megas', () => {
    const r = normalizeName('ZAPATA ROSENDO 6megas');
    expect(r.nombreNormalizado).toBe('ZAPATA ROSENDO');
  });

  it('"RODRIGUEZ CARLOS DADO DE BAJA" → indicaBaja true', () => {
    const r = normalizeName('RODRIGUEZ CARLOS DADO DE BAJA');
    expect(r.indicaBaja).toBe(true);
  });

  it('nombre vacio → retorna string vacio', () => {
    const r = normalizeName('');
    expect(r.nombreNormalizado).toBe('');
    expect(r.indicaBaja).toBe(false);
  });

  it('nombre con espacios multiples → colapsa', () => {
    const r = normalizeName('GARCIA   ANA    MARIA');
    expect(r.nombreNormalizado).toBe('GARCIA ANA MARIA');
  });
});
