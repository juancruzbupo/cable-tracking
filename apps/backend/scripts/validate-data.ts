/**
 * ============================================================================
 * Script de validación offline
 * ============================================================================
 * Ejecutar: npx ts-node scripts/validate-data.ts
 *
 * Valida los 3 parsers contra los archivos Excel reales SIN necesitar DB.
 * Útil para verificar que la lógica funciona antes de importar.
 */

import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';
import { normalizeName } from '../src/common/utils/normalize-name.util';
import { parsePeriodsFromDescription } from '../src/common/utils/parse-periods.util';

// ── Colors for console ──────────────────────────────────────────
const R = '\x1b[31m';
const G = '\x1b[32m';
const Y = '\x1b[33m';
const B = '\x1b[34m';
const X = '\x1b[0m';

function readExcel(filePath: string): Record<string, unknown>[] {
  if (!fs.existsSync(filePath)) {
    console.log(`${Y}⚠ Archivo no encontrado: ${filePath}${X}`);
    return [];
  }
  const wb = XLSX.read(fs.readFileSync(filePath), { type: 'buffer', cellDates: true });
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null, raw: false });
}

function main() {
  console.log('\n' + '═'.repeat(70));
  console.log(`${B} 🧪 VALIDACIÓN DE DATOS - Cable Tracking${X}`);
  console.log('═'.repeat(70));

  // Buscar archivos en varias ubicaciones posibles
  const searchPaths = [
    path.resolve(__dirname, '../data'),
    path.resolve(__dirname, '../../data'),
    '/mnt/user-data/uploads',
    path.resolve(__dirname, '../'),
  ];

  let clientesPath = '';
  let pedidosPath = '';
  let ventasPath = '';

  for (const dir of searchPaths) {
    if (!clientesPath) {
      const p = path.join(dir, 'clientes.xlsx');
      if (fs.existsSync(p)) clientesPath = p;
    }
    if (!pedidosPath) {
      const p = path.join(dir, 'pedidos.xlsx');
      if (fs.existsSync(p)) pedidosPath = p;
    }
    if (!ventasPath) {
      for (const name of ['ventas_.xlsx', 'ventas.xlsx']) {
        const p = path.join(dir, name);
        if (fs.existsSync(p)) { ventasPath = p; break; }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 1. VALIDAR NORMALIZACIÓN DE NOMBRES
  // ═══════════════════════════════════════════════════════════════

  console.log(`\n${B}── 1. Normalización de nombres ──${X}`);

  if (!clientesPath) {
    console.log(`${Y}⚠ clientes.xlsx no encontrado, usando tests hardcodeados${X}`);
  }

  // Tests hardcodeados (siempre corren)
  const tests: Array<[string, string, boolean]> = [
    ['CANTERO JUAN CRUZ DE BAJA', 'CANTERO JUAN CRUZ', true],
    ['HECHENLEITNER CRISTINA  pendiente el equipo', 'HECHENLEITNER CRISTINA', false],
    ['ARIAS IRIS SOLO INTERNET', 'ARIAS IRIS', false],
    ['ORTIS ALAN GABRIEL  6megas', 'ORTIS ALAN GABRIEL', false],
    ['. DE BAJA', '', true],
    ['GUZMAN HUGO - NO  USAR DE BAJA', 'GUZMAN HUGO', true],
    ['ZAPATA ROSENDO subio velocidad 6 megas a partir de dia 25/4/25', 'ZAPATA ROSENDO', false],
    ['ALARCON MULLER ANA BETTY  cortado  21-02-24 DE  BAJA', 'ALARCON MULLER ANA BETTY', true],
    ['SOSA LIDIA ESTHER JUBILADA', 'SOSA LIDIA ESTHER', false],
    ['RODRIGUEZ FLORENCIA  CABLE +INTERNET', 'RODRIGUEZ FLORENCIA', false],
    ['marquez sarita', 'MARQUEZ SARITA', false],
    ['RANGUILEO MARIA DE CARMEN  de baja', 'RANGUILEO MARIA DE CARMEN', true],
    ['CLODOMIRO SANDRA queda 500 a favor febrero26', 'CLODOMIRO SANDRA', false],
  ];

  let pass = 0;
  let fail = 0;

  for (const [input, expected, expectedBaja] of tests) {
    const result = normalizeName(input);
    const nameOk = result.nombreNormalizado === expected;
    const bajaOk = result.indicaBaja === expectedBaja;

    if (nameOk && bajaOk) {
      pass++;
    } else {
      fail++;
      console.log(`  ${R}✗${X} "${input}"`);
      if (!nameOk) console.log(`    nombre: "${result.nombreNormalizado}" ≠ "${expected}"`);
      if (!bajaOk) console.log(`    baja: ${result.indicaBaja} ≠ ${expectedBaja}`);
    }
  }

  console.log(`  ${pass > 0 ? G : ''}✓ ${pass} tests OK${X}${fail > 0 ? `, ${R}✗ ${fail} FAILED${X}` : ''}`);

  // Stats del archivo real
  if (clientesPath) {
    const rows = readExcel(clientesPath);
    const names = rows.map((r) => normalizeName(String(r['nombre'] || '')));
    const valid = names.filter((n) => n.nombreNormalizado);
    const unique = new Set(valid.map((n) => n.nombreNormalizado));
    const bajas = names.filter((n) => n.indicaBaja);

    console.log(`\n  ${B}Archivo:${X} ${clientesPath}`);
    console.log(`  Total filas: ${rows.length}`);
    console.log(`  Nombres válidos: ${valid.length}`);
    console.log(`  Nombres vacíos: ${names.length - valid.length}`);
    console.log(`  Únicos: ${unique.size}`);
    console.log(`  Duplicados: ${valid.length - unique.size}`);
    console.log(`  Con baja: ${bajas.length}`);
  }

  // ═══════════════════════════════════════════════════════════════
  // 2. VALIDAR PARSER DE PERÍODOS
  // ═══════════════════════════════════════════════════════════════

  console.log(`\n${B}── 2. Parser de períodos ──${X}`);

  const periodTests: Array<[string, string[]]> = [
    ['TvCable enero26 del 1 al 15', ['2026-01']],
    ['6Megas Diciembre25', ['2025-12']],
    ['Promo 3Megas Enero25 del 1 al 15 27000 - 5 dias de', ['2025-01']],
    ['5megas noviembre24', ['2024-11']],
    ['100Megas Enero26', ['2026-01']],
    ['SUSCRIPCION DE TV CABLE', []],
    ['RECONEXION INTERNET', []],
    ['Punto adicional', []],
  ];

  let pPass = 0;
  let pFail = 0;

  for (const [input, expected] of periodTests) {
    const result = parsePeriodsFromDescription(input);
    const got = result.map((p) => `${p.year}-${String(p.month).padStart(2, '0')}`);
    const ok = JSON.stringify(got) === JSON.stringify(expected);
    if (ok) {
      pPass++;
    } else {
      pFail++;
      console.log(`  ${R}✗${X} "${input}" → [${got}] ≠ [${expected}]`);
    }
  }

  console.log(`  ${pPass > 0 ? G : ''}✓ ${pPass} tests OK${X}${pFail > 0 ? `, ${R}✗ ${pFail} FAILED${X}` : ''}`);

  // Stats de archivos reales
  for (const [label, filePath] of [
    ['Pedidos', pedidosPath],
    ['Ventas', ventasPath],
  ] as const) {
    if (!filePath) continue;
    const rows = readExcel(filePath);
    let withPeriod = 0;
    let withoutPeriod = 0;
    let totalPeriods = 0;

    for (const row of rows) {
      const desc = String(row['descrip'] || '');
      const periods = parsePeriodsFromDescription(desc);
      if (periods.length > 0) {
        withPeriod++;
        totalPeriods += periods.length;
      } else {
        withoutPeriod++;
      }
    }

    console.log(`\n  ${B}${label}:${X} ${filePath}`);
    console.log(`  Total filas: ${rows.length}`);
    console.log(`  Con período: ${withPeriod} (${((withPeriod / rows.length) * 100).toFixed(1)}%)`);
    console.log(`  Sin período: ${withoutPeriod}`);
    console.log(`  Total períodos extraídos: ${totalPeriods}`);
  }

  // ═══════════════════════════════════════════════════════════════
  // 3. VALIDAR CROSS-MATCH
  // ═══════════════════════════════════════════════════════════════

  if (clientesPath && (pedidosPath || ventasPath)) {
    console.log(`\n${B}── 3. Cross-match nombres ──${X}`);

    const cliRows = readExcel(clientesPath);
    const cliNames = new Set(
      cliRows
        .map((r) => normalizeName(String(r['nombre'] || '')).nombreNormalizado)
        .filter(Boolean),
    );

    for (const [label, filePath] of [
      ['Pedidos', pedidosPath],
      ['Ventas', ventasPath],
    ] as const) {
      if (!filePath) continue;
      const rows = readExcel(filePath);
      let matched = 0;
      let unmatched = 0;
      const unmatchedNames: string[] = [];

      for (const row of rows) {
        const { nombreNormalizado } = normalizeName(String(row['nombre'] || ''));
        if (!nombreNormalizado) { unmatched++; continue; }
        if (cliNames.has(nombreNormalizado)) {
          matched++;
        } else {
          unmatched++;
          if (!unmatchedNames.includes(nombreNormalizado)) {
            unmatchedNames.push(nombreNormalizado);
          }
        }
      }

      const rate = ((matched / rows.length) * 100).toFixed(1);
      console.log(`\n  ${label}: ${G}${matched}${X}/${rows.length} match (${rate}%)`);
      if (unmatchedNames.length > 0) {
        console.log(`  ${Y}Sin match (${unmatchedNames.length}):${X}`);
        for (const n of unmatchedNames.slice(0, 10)) {
          console.log(`    - "${n}"`);
        }
      }
    }
  }

  console.log('\n' + '═'.repeat(70));
  console.log(
    fail + pFail === 0
      ? `${G} ✅ Validación completada sin errores${X}`
      : `${R} ❌ ${fail + pFail} tests fallidos${X}`,
  );
  console.log('═'.repeat(70) + '\n');

  process.exit(fail + pFail > 0 ? 1 : 0);
}

main();
