/**
 * ============================================================================
 * Parser de períodos de pago desde descripciones
 * ============================================================================
 *
 * HALLAZGO REAL: Los períodos usan años de 2 dígitos SIN espacio
 * entre el nombre del mes y el año.
 *
 * Patrones reales encontrados en el dataset:
 *
 *   "TvCable enero26 del 1 al 15"        → Enero 2026
 *   "6Megas Diciembre25"                  → Diciembre 2025
 *   "Tv Cable Diciembre25 del 1 al 15"   → Diciembre 2025
 *   "Promo 3Megas Enero25 del 1 al 15"   → Enero 2025
 *   "TvCable Octubre25"                   → Octubre 2025
 *   "5megas noviembre24"                  → Noviembre 2024
 *   "2Megas Enero25 11000 -5 dias de"     → Enero 2025
 *   "TvCable Enero25 del1 al 15"          → Enero 2025 (note: "del1" sin espacio)
 *   "15 dias marzo 2 megas"               → Marzo (sin año explícito → skip)
 *
 * Descripciones SIN período (no son pagos de mes):
 *   "SUSCRIPCION DE TV CABLE"
 *   "SUSCRIPCION DE INTERNET CON WIFI"
 *   "RECONEXION INTERNET"
 *   "Punto adicional"
 *   "traslado"
 *   "Cambio de Modem a Fibra con Wifi"
 *
 * REGLA: "del 1 al 15" es un descriptor de medio mes, el período
 * sigue siendo el mes completo.
 */

import dayjs from 'dayjs';

const MONTH_MAP: Record<string, number> = {
  ENERO: 1,
  FEBRERO: 2,
  MARZO: 3,
  ABRIL: 4,
  MAYO: 5,
  JUNIO: 6,
  JULIO: 7,
  AGOSTO: 8,
  SEPTIEMBRE: 9,
  SETIEMBRE: 9,
  OCTUBRE: 10,
  NOVIEMBRE: 11,
  DICIEMBRE: 12,
};

// Todos los nombres de mes como alternancia regex
const MONTH_NAMES_REGEX =
  'ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPT?IEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE';

export interface ParsedPeriod {
  year: number;
  month: number;
  /** Siempre primer día del mes: YYYY-MM-01 */
  periodo: Date;
}

export interface ParsedPeriodResult {
  periods: ParsedPeriod[];
  serviceType: 'CABLE' | 'INTERNET' | null;
}

/**
 * Detecta el tipo de servicio por la descripcion del documento.
 */
export function detectServiceType(description: string | null): 'CABLE' | 'INTERNET' | null {
  if (!description) return null;
  const d = description.toUpperCase();
  const hasCable = /TVCABLE|TV\s*CABLE|TV\s*\+\s*CABLE|\bCABLE\b/.test(d);
  const hasInternet = /\bMEGAS?\b|\bINTERNET\b|\bMBPS?\b|\bMB\b|\bFIBRA\b/.test(d);
  if (hasInternet && !hasCable) return 'INTERNET';
  if (hasCable) return 'CABLE';
  if (hasInternet) return 'INTERNET';
  return null;
}

/**
 * Extrae períodos de pago y tipo de servicio de una descripción.
 */
export function parsePeriodsWithService(description: string): ParsedPeriodResult {
  return {
    periods: parsePeriodsFromDescription(description),
    serviceType: detectServiceType(description),
  };
}

/**
 * Extrae períodos de pago de una descripción de documento.
 */
export function parsePeriodsFromDescription(
  description: string,
): ParsedPeriod[] {
  if (!description || typeof description !== 'string') {
    return [];
  }

  const text = description.toUpperCase().trim();
  const periods: ParsedPeriod[] = [];

  // ── Patrón principal: MesNombre + Año2dígitos ────────────────────────
  // Captura: "Diciembre25", "enero26", "Noviembre24", "febrero25"
  // El mes y año pueden estar pegados o con espacio
  const mainPattern = new RegExp(
    `(${MONTH_NAMES_REGEX})\\s*(\\d{2})\\b`,
    'gi',
  );

  let match: RegExpExecArray | null;
  while ((match = mainPattern.exec(text)) !== null) {
    const monthName = match[1].toUpperCase();
    const yearShort = parseInt(match[2], 10);

    const month = resolveMonth(monthName);
    if (!month) continue;

    // Convertir año de 2 dígitos: 24→2024, 25→2025, 26→2026
    const year = yearShort >= 0 && yearShort <= 99 ? 2000 + yearShort : yearShort;

    // Validación básica
    if (year < 2020 || year > 2030) continue;

    addPeriod(periods, year, month);
  }

  // ── Patrón secundario: MesNombre + Año4dígitos (por si acaso) ────────
  const fourDigitPattern = new RegExp(
    `(${MONTH_NAMES_REGEX})\\s*(20\\d{2})\\b`,
    'gi',
  );

  while ((match = fourDigitPattern.exec(text)) !== null) {
    const monthName = match[1].toUpperCase();
    const year = parseInt(match[2], 10);
    const month = resolveMonth(monthName);
    if (!month) continue;
    addPeriod(periods, year, month);
  }

  // Deduplicar y ordenar
  return deduplicateAndSort(periods);
}

/**
 * Resuelve el número de mes desde un nombre.
 */
function resolveMonth(name: string): number | null {
  return MONTH_MAP[name] || null;
}

function addPeriod(periods: ParsedPeriod[], year: number, month: number): void {
  if (year < 2000 || year > 2100 || month < 1 || month > 12) return;

  periods.push({
    year,
    month,
    periodo: dayjs(`${year}-${String(month).padStart(2, '0')}-01`).toDate(),
  });
}

function deduplicateAndSort(periods: ParsedPeriod[]): ParsedPeriod[] {
  const seen = new Set<string>();
  return periods
    .filter((p) => {
      const key = `${p.year}-${p.month}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.periodo.getTime() - b.periodo.getTime());
}
