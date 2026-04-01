import { calcularPrecioConPromo, esMesCubiertoXPromo, type PromoData } from './promotion-calculator.util';

const makePromo = (tipo: PromoData['tipo'], valor: number, inicio = '2026-01-01', fin = '2026-03-31'): PromoData => ({
  id: '1', nombre: 'Test', tipo, valor, fechaInicio: new Date(inicio), fechaFin: new Date(fin),
});

describe('calcularPrecioConPromo', () => {
  it('sin promos → precio = precioBase', () => {
    const r = calcularPrecioConPromo(10000, []);
    expect(r.precioFinal).toBe(10000);
    expect(r.promoAplicada).toBeNull();
  });

  it('MESES_GRATIS → precio 0, gana sobre todo', () => {
    const promos = [makePromo('MESES_GRATIS', 0), makePromo('PORCENTAJE', 50)];
    const r = calcularPrecioConPromo(10000, promos);
    expect(r.precioFinal).toBe(0);
    expect(r.esMesesGratis).toBe(true);
  });

  it('PRECIO_FIJO → usa ese precio', () => {
    const r = calcularPrecioConPromo(10000, [makePromo('PRECIO_FIJO', 7000)]);
    expect(r.precioFinal).toBe(7000);
    expect(r.descuento).toBe(3000);
  });

  it('PORCENTAJE 20% sobre $10000 → $8000', () => {
    const r = calcularPrecioConPromo(10000, [makePromo('PORCENTAJE', 20)]);
    expect(r.precioFinal).toBe(8000);
  });

  it('MONTO_FIJO $3000 sobre $10000 → $7000', () => {
    const r = calcularPrecioConPromo(10000, [makePromo('MONTO_FIJO', 3000)]);
    expect(r.precioFinal).toBe(7000);
  });

  it('PORCENTAJE vs MONTO_FIJO → aplica mayor descuento', () => {
    const promos = [makePromo('PORCENTAJE', 10), makePromo('MONTO_FIJO', 3000)];
    const r = calcularPrecioConPromo(10000, promos);
    // 10% = 1000 desc, MONTO_FIJO = 3000 desc → MONTO_FIJO gana
    expect(r.precioFinal).toBe(7000);
    expect(r.promoAplicada?.tipo).toBe('MONTO_FIJO');
  });
});

describe('esMesCubiertoXPromo', () => {
  it('mes completo dentro del periodo → cubierto', () => {
    const promos = [makePromo('MESES_GRATIS', 0, '2025-12-31', '2026-02-01')];
    expect(esMesCubiertoXPromo(2026, 1, promos)).toBe(true);
  });

  it('mes fuera del periodo → no cubierto', () => {
    const promos = [makePromo('MESES_GRATIS', 0, '2026-01-01', '2026-01-31')];
    expect(esMesCubiertoXPromo(2026, 2, promos)).toBe(false);
  });

  it('promo PORCENTAJE → no cubre mes', () => {
    const promos = [makePromo('PORCENTAJE', 50, '2026-01-01', '2026-12-31')];
    expect(esMesCubiertoXPromo(2026, 1, promos)).toBe(false);
  });

  it('sin promos → no cubierto', () => {
    expect(esMesCubiertoXPromo(2026, 1, [])).toBe(false);
  });
});
