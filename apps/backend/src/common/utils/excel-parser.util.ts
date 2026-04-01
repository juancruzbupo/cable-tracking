/**
 * ============================================================================
 * Parser de archivos Excel
 * ============================================================================
 *
 * FIX Fase 4: Cambiado a raw: true para que las fechas lleguen como
 * Date objects nativos y no como strings formateados impredecibles.
 *
 * Con raw: false, una fecha podía llegar como "1/29/2018", "29/01/2018"
 * o "2018-01-29" dependiendo del locale del Excel. Con raw: true, llega
 * como un JS Date directamente.
 */

import * as XLSX from 'xlsx';

export interface ExcelParseResult<T> {
  data: T[];
  headers: string[];
  totalRows: number;
  errors: ExcelParseError[];
}

export interface ExcelParseError {
  row: number;
  column?: string;
  message: string;
  value?: unknown;
}

/**
 * Lee un archivo Excel desde un buffer y retorna las filas como objetos.
 */
export function parseExcelBuffer<T extends Record<string, unknown>>(
  buffer: Buffer,
  sheetIndex = 0,
): ExcelParseResult<T> {
  try {
    const workbook = XLSX.read(buffer, {
      type: 'buffer',
      cellDates: true, // Parsea fechas como JS Date
      cellNF: true,
      cellText: false,
    });

    const sheetName = workbook.SheetNames[sheetIndex];
    if (!sheetName) {
      return {
        data: [],
        headers: [],
        totalRows: 0,
        errors: [
          { row: 0, message: `No se encontró la hoja en índice ${sheetIndex}` },
        ],
      };
    }

    const sheet = workbook.Sheets[sheetName];

    // Extraer headers de la primera fila
    const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: null,
    });
    const headerRow = (rawRows[0] || []) as unknown[];
    const headers = headerRow.map((h) =>
      h != null ? String(h).trim() : '',
    );

    // Extraer datos como objetos usando headers
    const jsonData = XLSX.utils.sheet_to_json<T>(sheet, {
      defval: null,
      raw: true, // FIX: raw: true para que fechas sean Date objects
    });

    return {
      data: jsonData,
      headers: headers.filter(Boolean),
      totalRows: jsonData.length,
      errors: [],
    };
  } catch (error) {
    return {
      data: [],
      headers: [],
      totalRows: 0,
      errors: [
        {
          row: 0,
          message: `Error al parsear el archivo: ${error instanceof Error ? error.message : 'desconocido'}`,
        },
      ],
    };
  }
}

/**
 * Normaliza un header para comparación.
 */
export function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_áéíóúñü]/g, '');
}
