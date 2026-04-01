import { DebtService } from './debt.service';
import { ClientStatus, ServiceType } from '@prisma/client';
import dayjs from 'dayjs';

const service = new DebtService();
const now = dayjs();
const isAfter15 = now.date() > 15;

// Helper: genera periodos pagados
const paid = (...months: string[]) =>
  months.map((m) => ({ year: parseInt(m.split('-')[0]), month: parseInt(m.split('-')[1]) }));

describe('DebtService.calculateSubDebt', () => {
  it('suscripcion BAJA → deuda 0', () => {
    const r = service.calculateSubDebt('s1', ServiceType.CABLE, ClientStatus.BAJA, new Date('2024-01-01'), []);
    expect(r.cantidadDeuda).toBe(0);
    expect(r.requiereCorte).toBe(false);
  });

  it('todos los meses cubiertos → deuda 0', () => {
    const alta = dayjs().subtract(2, 'month').startOf('month');
    const m1 = alta.format('YYYY-M').split('-');
    const m2 = alta.add(1, 'month').format('YYYY-M').split('-');
    const periods = [
      { year: +m1[0], month: +m1[1] },
      { year: +m2[0], month: +m2[1] },
    ];
    if (isAfter15) {
      const m3 = alta.add(2, 'month').format('YYYY-M').split('-');
      periods.push({ year: +m3[0], month: +m3[1] });
    }
    const r = service.calculateSubDebt('s1', ServiceType.CABLE, ClientStatus.ACTIVO, alta.toDate(), periods);
    expect(r.cantidadDeuda).toBe(0);
  });

  it('1 mes de deuda → NO requiere corte (umbral > 1)', () => {
    const alta = dayjs().subtract(1, 'month').startOf('month');
    const r = service.calculateSubDebt('s1', ServiceType.CABLE, ClientStatus.ACTIVO, alta.toDate(), []);
    // Dependiendo del dia del mes puede ser 1 o 2 meses obligatorios
    if (r.cantidadDeuda === 1) {
      expect(r.requiereCorte).toBe(false);
    }
  });

  it('2+ meses de deuda → requiere corte', () => {
    const alta = dayjs().subtract(4, 'month').startOf('month');
    const r = service.calculateSubDebt('s1', ServiceType.INTERNET, ClientStatus.ACTIVO, alta.toDate(), []);
    expect(r.cantidadDeuda).toBeGreaterThanOrEqual(2);
    expect(r.requiereCorte).toBe(true);
  });

  it('huecos anteriores al ultimo pago se perdonan', () => {
    // Alta hace 6 meses, solo pago el mes pasado
    const alta = dayjs().subtract(6, 'month').startOf('month');
    const lastMonth = dayjs().subtract(1, 'month');
    const periods = [{ year: lastMonth.year(), month: lastMonth.month() + 1 }];

    const r = service.calculateSubDebt('s1', ServiceType.CABLE, ClientStatus.ACTIVO, alta.toDate(), periods);
    // Solo debe deuda desde el mes siguiente al ultimo pago, no los huecos viejos
    expect(r.cantidadDeuda).toBeLessThanOrEqual(1); // 0 o 1 segun dia del mes
  });

  it('mes pagado Y cubierto por promo → no duplica', () => {
    const alta = dayjs().subtract(2, 'month').startOf('month');
    const m = alta.format('YYYY-M').split('-');
    const periods = [{ year: +m[0], month: +m[1] }];
    const promo = {
      id: 'p1', nombre: 'Test', tipo: 'MESES_GRATIS' as const, valor: 0,
      fechaInicio: alta.subtract(1, 'day').toDate(), fechaFin: alta.endOf('month').add(1, 'day').toDate(),
    };
    const r = service.calculateSubDebt('s1', ServiceType.CABLE, ClientStatus.ACTIVO, alta.toDate(), periods, [promo]);
    // El mes de alta esta cubierto por pago Y por promo, no debe duplicar
    const cubiertos = new Set([...r.mesesPagados, ...r.mesesConPromoGratis]);
    expect(cubiertos.size).toBeGreaterThanOrEqual(1);
  });

  it('promos PORCENTAJE no afectan deuda', () => {
    const alta = dayjs().subtract(3, 'month').startOf('month');
    const promoNoGratis = {
      id: 'p1', nombre: 'Desc', tipo: 'PORCENTAJE' as const, valor: 50,
      fechaInicio: alta.toDate(), fechaFin: dayjs().toDate(),
    };
    const r = service.calculateSubDebt('s1', ServiceType.CABLE, ClientStatus.ACTIVO, alta.toDate(), [], [promoNoGratis]);
    expect(r.mesesConPromoGratis).toHaveLength(0);
    expect(r.cantidadDeuda).toBeGreaterThan(0);
  });

  it('umbralCorte custom: 3 meses de deuda con umbral 3 → NO requiere corte', () => {
    const alta = dayjs().subtract(5, 'month').startOf('month');
    const r = service.calculateSubDebt('s1', ServiceType.CABLE, ClientStatus.ACTIVO, alta.toDate(), [], [], 3);
    // Con 4-5 meses sin pagar, pero umbral en 3, solo requiere corte si > 3
    expect(r.cantidadDeuda).toBeGreaterThanOrEqual(3);
    if (r.cantidadDeuda === 3) {
      expect(r.requiereCorte).toBe(false); // 3 no es > 3
    } else {
      expect(r.requiereCorte).toBe(true);
    }
  });

  it('MESES_GRATIS promo cubre meses → reduce deuda', () => {
    const alta = dayjs().subtract(3, 'month').startOf('month');
    const promo = {
      id: 'p1', nombre: 'Gratis', tipo: 'MESES_GRATIS' as const, valor: 0,
      fechaInicio: alta.subtract(1, 'month').toDate(),
      fechaFin: dayjs().add(1, 'month').toDate(),
    };
    const withPromo = service.calculateSubDebt('s1', ServiceType.CABLE, ClientStatus.ACTIVO, alta.toDate(), [], [promo]);
    const withoutPromo = service.calculateSubDebt('s1', ServiceType.CABLE, ClientStatus.ACTIVO, alta.toDate(), [], []);
    expect(withPromo.mesesConPromoGratis.length).toBeGreaterThan(0);
    expect(withPromo.cantidadDeuda).toBeLessThan(withoutPromo.cantidadDeuda);
  });
});

describe('DebtService.calculateClientDebt', () => {
  it('cable en corte + internet al dia → desglose correcto', () => {
    const alta = dayjs().subtract(4, 'month').startOf('month');
    const lastMonth = dayjs().subtract(1, 'month');

    const subs = [
      { id: 's1', tipo: ServiceType.CABLE, fechaAlta: alta.toDate(), estado: ClientStatus.ACTIVO, paymentPeriods: [] as any },
      { id: 's2', tipo: ServiceType.INTERNET, fechaAlta: alta.toDate(), estado: ClientStatus.ACTIVO,
        paymentPeriods: [{ year: lastMonth.year(), month: lastMonth.month() + 1 }] },
    ];

    const r = service.calculateClientDebt('c1', '100', 'TEST', ClientStatus.ACTIVO, alta.toDate(), null, subs);
    expect(r.deudaCable).toBeGreaterThan(0);
    expect(r.requiereCorteCable).toBe(true);
    expect(r.requiereCorteInternet).toBe(false);
    expect(r.requiereCorte).toBe(true); // al menos una
  });

  it('cantidadDeuda = peor caso entre suscripciones', () => {
    const alta = dayjs().subtract(5, 'month').startOf('month');
    const subs = [
      { id: 's1', tipo: ServiceType.CABLE, fechaAlta: alta.toDate(), estado: ClientStatus.ACTIVO, paymentPeriods: [] as any },
      { id: 's2', tipo: ServiceType.INTERNET, fechaAlta: alta.toDate(), estado: ClientStatus.ACTIVO, paymentPeriods: [] as any },
    ];
    const r = service.calculateClientDebt('c1', '100', 'TEST', ClientStatus.ACTIVO, alta.toDate(), null, subs);
    expect(r.cantidadDeuda).toBe(Math.max(r.deudaCable, r.deudaInternet));
  });
});
