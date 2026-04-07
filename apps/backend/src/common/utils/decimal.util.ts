import { Decimal } from '@prisma/client/runtime/library';

/**
 * Safely convert a Prisma Decimal to a JS number.
 * For monetary amounts in this system (cable subscriptions),
 * JS Number precision (15 significant digits) is more than sufficient.
 * Returns 0 for null/undefined values.
 */
export function toNumber(value: Decimal | number | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  return value.toNumber();
}

/**
 * Convert a Prisma Decimal to a fixed-precision string (2 decimal places).
 * Useful for display/serialization of monetary amounts.
 */
export function toMoney(value: Decimal | number | null | undefined): number {
  return Math.round(toNumber(value) * 100) / 100;
}
