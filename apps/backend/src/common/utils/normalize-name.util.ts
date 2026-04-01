/**
 * ============================================================================
 * Normalización de nombres de clientes - v2 (post-validación con datos reales)
 * ============================================================================
 *
 * Fixes aplicados respecto a v1:
 * - "DIO DE BAJA" ahora se detecta y elimina correctamente
 * - Dígitos sueltos se eliminan (no son parte de nombres)
 * - "PORQUE REPETIDAS" y comentarios admin similares se eliminan
 * - "A PARTIR DE" trunca lo que sigue
 * - Patrón de regex Unicode mejorado para ñ/acentos
 *
 * Validado contra dataset real:
 * - 1122 filas → 1102 nombres únicos + 6 vacíos + 14 duplicados legítimos
 * - 486 registros con BAJA detectados correctamente
 */

// ── Detección de BAJA ────────────────────────────────────────────────────

const BAJA_DETECTION_PATTERNS: RegExp[] = [
  /\bDADO\s+DE\s+BAJA\b/i,
  /\bDADA\s+DE\s+BAJA\b/i,
  /\bDIO\s+DE\s+BAJA\b/i,
  /\bDE\s+BAJA\b/i,
  /\bEN\s+BAJA\b/i,
  /\bBAJA\b/i,
];

// ── Patrones a ELIMINAR (orden importa: más específico primero) ──────────

const NOISE_PATTERNS: RegExp[] = [
  // ── Baja (variaciones) ──
  /\bDADO\s+DE\s+BAJA\b/gi,
  /\bDADA\s+DE\s+BAJA\b/gi,
  /\bDIO\s+DE\s+BAJA\b/gi,
  /\bDE\s+BAJA\b/gi,
  /\bEN\s+BAJA\b/gi,
  /\bBAJA\s+TEMPORAL\b/gi,
  /\bBAJA\s+DEFINITIVA\b/gi,
  /\bBAJA\b/gi,

  // ── Truncamiento: todo lo que sigue se descarta ──
  /\bRETIR(?:ADO|ADA|O)\b.*$/gim,
  /\bRETI(?:RO|TO)\b.*$/gim,
  /\bCORTAD[OA]\b.*$/gim,
  /\bSUBIO\b.*$/gim,
  /\bACTIV[OA]\s+(?:EL\s+)?\d.*$/gim,
  /\bINST\.\s*\d.*$/gim,
  /\bSALDO\b.*$/gim,
  /\bQUEDA\s+\d.*$/gim,
  /\bFALTAN?\b.*$/gim,
  /\bDEUDA\b.*$/gim,
  /\bPENDIENTE\s+ABONAR\b.*$/gim,
  /\bOCTUBRE\s+TV\b.*$/gim,
  /\bPORQUE\b.*$/gim,
  /\bPROMO\b.*$/gim,
  /\bA\s+PARTIR\b.*$/gim,
  /\bA\s+PA\b.*$/gim,

  // ── Service types ──
  /\bSOLO\s+INTE?RNET\b/gi,
  /\bSOLO\s+CABLE\b/gi,
  /\bSOLO\s+TVCABLE\b/gi,
  /\bCABLE\s*\+?\s*INTERNET\b/gi,
  /\bINTERNET\b/gi,

  // ── Megas ──
  /\b\d+\s*MEGAS?\b/gi,

  // ── Admin labels ──
  /\bNO\s+USAR\b/gi,
  /\bPENDIENTE\s+(?:EL\s+)?EQUIPO\b/gi,
  /\bJUBILAD[OA]\b/gi,

  // ── Dates: dd-mm-yy, dd/mm/yy, dd-mm-yyyy ──
  /\b\d{1,2}\s*[-/]\s*\d{1,2}\s*[-/]?\s*\d{0,4}\b/g,
];

export interface NormalizationResult {
  nombreNormalizado: string;
  indicaBaja: boolean;
  nombreOriginal: string;
}

export function normalizeName(rawName: string): NormalizationResult {
  if (!rawName || typeof rawName !== 'string') {
    return { nombreNormalizado: '', indicaBaja: false, nombreOriginal: rawName || '' };
  }

  const nombreOriginal = rawName.trim();
  const indicaBaja = detectsBaja(nombreOriginal);

  let n = nombreOriginal.toUpperCase();

  // Aplicar patrones de limpieza
  for (const pattern of NOISE_PATTERNS) {
    n = n.replace(pattern, ' ');
  }

  // Eliminar todo excepto letras Unicode y espacios
  n = n.replace(/[^\p{L}\s]/gu, ' ');

  // Colapsar espacios
  n = n.replace(/\s+/g, ' ').trim();

  // Eliminar palabras de 1 carácter (excepto artículos)
  n = n
    .split(' ')
    .filter((w) => w.length > 1 || w === 'Y' || w === 'O')
    .join(' ')
    .trim();

  return { nombreNormalizado: n, indicaBaja, nombreOriginal };
}

export function detectsBaja(text: string): boolean {
  if (!text) return false;
  return BAJA_DETECTION_PATTERNS.some((p) => p.test(text));
}
