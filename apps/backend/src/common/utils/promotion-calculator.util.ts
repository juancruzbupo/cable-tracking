import dayjs from 'dayjs';

export interface PromoData {
  id: string;
  nombre: string;
  tipo: 'PORCENTAJE' | 'MONTO_FIJO' | 'MESES_GRATIS' | 'PRECIO_FIJO';
  valor: number;
  fechaInicio: Date;
  fechaFin: Date;
}

export interface PrecioConPromo {
  precioBase: number;
  precioFinal: number;
  descuento: number;
  promoAplicada: PromoData | null;
  esMesesGratis: boolean;
}

/**
 * Calcula el precio final aplicando la promo más beneficiosa.
 * Reglas:
 * 1. MESES_GRATIS → precio = 0
 * 2. PRECIO_FIJO → usa ese precio
 * 3. PORCENTAJE o MONTO_FIJO → el mayor descuento
 * Solo se aplica UNA promo.
 */
export function calcularPrecioConPromo(
  precioBase: number,
  promosActivas: PromoData[],
): PrecioConPromo {
  if (promosActivas.length === 0 || precioBase <= 0) {
    return { precioBase, precioFinal: precioBase, descuento: 0, promoAplicada: null, esMesesGratis: false };
  }

  // 1. MESES_GRATIS gana sobre todo
  const gratis = promosActivas.find((p) => p.tipo === 'MESES_GRATIS');
  if (gratis) {
    return { precioBase, precioFinal: 0, descuento: precioBase, promoAplicada: gratis, esMesesGratis: true };
  }

  // 2. PRECIO_FIJO
  const fijo = promosActivas.find((p) => p.tipo === 'PRECIO_FIJO');
  if (fijo) {
    const pf = Number(fijo.valor);
    return { precioBase, precioFinal: pf, descuento: precioBase - pf, promoAplicada: fijo, esMesesGratis: false };
  }

  // 3. Mejor entre PORCENTAJE y MONTO_FIJO
  let best: PromoData | null = null;
  let bestDesc = 0;

  for (const p of promosActivas) {
    let desc = 0;
    if (p.tipo === 'PORCENTAJE') desc = precioBase * (Number(p.valor) / 100);
    else if (p.tipo === 'MONTO_FIJO') desc = Number(p.valor);
    if (desc > bestDesc) { bestDesc = desc; best = p; }
  }

  if (best) {
    return { precioBase, precioFinal: Math.max(0, precioBase - bestDesc), descuento: bestDesc, promoAplicada: best, esMesesGratis: false };
  }

  return { precioBase, precioFinal: precioBase, descuento: 0, promoAplicada: null, esMesesGratis: false };
}

/**
 * Verifica si un mes completo está cubierto por una promo MESES_GRATIS.
 * El mes completo debe caer dentro del período de la promo.
 */
export function esMesCubiertoXPromo(year: number, month: number, promos: PromoData[]): boolean {
  const primerDia = dayjs(`${year}-${String(month).padStart(2, '0')}-01`);
  const ultimoDia = primerDia.endOf('month');

  return promos.some((p) => {
    if (p.tipo !== 'MESES_GRATIS') return false;
    const inicio = dayjs(p.fechaInicio).startOf('day');
    const fin = dayjs(p.fechaFin).endOf('day');
    return primerDia.isSame(inicio, 'day') || primerDia.isAfter(inicio, 'day')
      ? ultimoDia.isSame(fin, 'day') || ultimoDia.isBefore(fin, 'day')
      : false;
  });
}
