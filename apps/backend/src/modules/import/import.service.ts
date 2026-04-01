import { Injectable, Logger } from '@nestjs/common';
import { DocumentType, ClientStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  parseExcelBuffer,
  ExcelParseError,
} from '../../common/utils/excel-parser.util';
import { normalizeName } from '../../common/utils/normalize-name.util';
import { parsePeriodsFromDescription, detectServiceType } from '../../common/utils/parse-periods.util';
import { DashboardService } from '../dashboard/dashboard.service';

// ── Types ──────────────────────────────────────────────────────

export interface ImportPreviewResult {
  headers: string[];
  totalRows: number;
  sampleRows: Record<string, unknown>[];
  validRows: number;
  invalidRows: number;
  errors: ExcelParseError[];
}

export interface ImportResult {
  success: boolean;
  tipo: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  newClients: number;
  updatedClients: number;
  documentsCreated: number;
  periodsCreated: number;
  errors: ExcelParseError[];
}

/**
 * Mapeo de columnas reales:
 *   clientes.xlsx:  cod_cli | nombre | fecalta | calle
 *   pedidos.xlsx:   fecha | nro_comp | nombre | descrip
 *   ventas_.xlsx:   fecha | comprob  | nombre | descrip
 */
const COL = {
  CODIGO: ['cod_cli', 'codigo', 'cod', 'id', 'codigo_cliente'],
  NOMBRE: ['nombre', 'nombre_cliente', 'cliente', 'name'],
  FECHA_ALTA: ['fecalta', 'fecha_alta', 'alta', 'fecha_ingreso'],
  CALLE: ['calle', 'direccion', 'domicilio', 'dir'],
  FECHA_DOC: ['fecha', 'fecha_documento', 'date'],
  NUMERO_DOC: [
    'nro_comp',
    'comprob',
    'comprobante',
    'numero',
    'nro',
    'numero_documento',
  ],
  DESCRIPCION: [
    'descrip',
    'descripcion',
    'desc',
    'detalle',
    'concepto',
    'observacion',
  ],
};

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboardService: DashboardService,
  ) {}

  // ══════════════════════════════════════════════════════════════
  // PREVIEW
  // ══════════════════════════════════════════════════════════════

  async previewFile(
    buffer: Buffer,
    tipo: 'CLIENTES' | 'RAMITOS' | 'FACTURAS',
  ): Promise<ImportPreviewResult> {
    const parsed = parseExcelBuffer<Record<string, unknown>>(buffer);
    const errors: ExcelParseError[] = [...parsed.errors];
    let validRows = 0;
    let invalidRows = 0;

    for (let i = 0; i < parsed.data.length; i++) {
      const row = parsed.data[i];
      const codCli = this.findCol(row, COL.CODIGO);
      const nombre = this.findCol(row, COL.NOMBRE);

      if (!codCli || String(codCli).trim() === '') {
        errors.push({
          row: i + 2,
          column: 'cod_cli',
          message: 'Código de cliente requerido',
        });
        invalidRows++;
      } else if (!nombre || String(nombre).trim() === '') {
        errors.push({
          row: i + 2,
          column: 'nombre',
          message: 'Nombre requerido',
        });
        invalidRows++;
      } else {
        validRows++;
      }
    }

    return {
      headers: parsed.headers,
      totalRows: parsed.totalRows,
      sampleRows: parsed.data.slice(0, 10),
      validRows,
      invalidRows,
      errors: errors.slice(0, 100),
    };
  }

  // ══════════════════════════════════════════════════════════════
  // IMPORTAR CLIENTES (NO pisa)
  // ══════════════════════════════════════════════════════════════

  async importClients(
    buffer: Buffer,
    fileName: string,
  ): Promise<ImportResult> {
    const parsed = parseExcelBuffer<Record<string, unknown>>(buffer);
    const errors: ExcelParseError[] = [];
    let newClients = 0;
    let updatedClients = 0;
    let validRows = 0;
    let invalidRows = 0;

    await this.prisma.executeInTransaction(
      async (tx) => {
        for (let i = 0; i < parsed.data.length; i++) {
          const row = parsed.data[i];
          const rowNum = i + 2;

          // cod_cli es obligatorio
          const codCliRaw = this.findCol(row, COL.CODIGO);
          if (!codCliRaw || String(codCliRaw).trim() === '') {
            errors.push({ row: rowNum, message: 'Código de cliente vacío' });
            invalidRows++;
            continue;
          }
          const codCli = String(codCliRaw).trim();

          const nombreRaw = this.findCol(row, COL.NOMBRE);
          if (!nombreRaw || String(nombreRaw).trim() === '') {
            errors.push({ row: rowNum, message: 'Nombre vacío' });
            invalidRows++;
            continue;
          }

          const { nombreNormalizado, indicaBaja, nombreOriginal } =
            normalizeName(String(nombreRaw));

          if (!nombreNormalizado) {
            errors.push({
              row: rowNum,
              message: `Nombre vacío después de normalizar: "${nombreRaw}"`,
            });
            invalidRows++;
            continue;
          }

          // ¿Ya existe por código?
          const existing = await tx.client.findUnique({
            where: { codCli },
          });

          if (existing) {
            if (indicaBaja && existing.estado !== ClientStatus.BAJA) {
              await tx.client.update({
                where: { id: existing.id },
                data: { estado: ClientStatus.BAJA },
              });
              updatedClients++;
            }
            validRows++;
            continue;
          }

          // Crear nuevo
          const fechaAltaRaw = this.findCol(row, COL.FECHA_ALTA);
          const calleRaw = this.findCol(row, COL.CALLE);

          let fechaAlta: Date | null = null;
          if (fechaAltaRaw) {
            fechaAlta = this.parseDate(fechaAltaRaw);
          }

          await tx.client.create({
            data: {
              codCli,
              nombreOriginal: nombreOriginal,
              nombreNormalizado,
              fechaAlta,
              estado: indicaBaja ? ClientStatus.BAJA : ClientStatus.ACTIVO,
              calle: calleRaw ? String(calleRaw).trim() : null,
            },
          });

          newClients++;
          validRows++;
        }
      },
      { timeout: 120000 },
    );

    try { this.dashboardService.invalidateCache(); } catch (e) { this.logger.error('Error invalidando cache', e); }

    await this.logImport({
      tipo: 'CLIENTES',
      fileName,
      totalRows: parsed.totalRows,
      validRows,
      invalidRows,
      newClients,
      updatedClients,
      errors,
    });

    return {
      success: true,
      tipo: 'CLIENTES',
      totalRows: parsed.totalRows,
      validRows,
      invalidRows,
      newClients,
      updatedClients,
      documentsCreated: 0,
      periodsCreated: 0,
      errors,
    };
  }

  // ══════════════════════════════════════════════════════════════
  // IMPORTAR RAMITOS / FACTURAS (SÍ pisa)
  // ══════════════════════════════════════════════════════════════

  async importDocuments(
    buffer: Buffer,
    fileName: string,
    tipo: 'RAMITOS' | 'FACTURAS',
  ): Promise<ImportResult> {
    const docType =
      tipo === 'RAMITOS' ? DocumentType.RAMITO : DocumentType.FACTURA;
    const parsed = parseExcelBuffer<Record<string, unknown>>(buffer);
    const errors: ExcelParseError[] = [];
    let validRows = 0;
    let invalidRows = 0;
    let documentsCreated = 0;
    let periodsCreated = 0;

    await this.prisma.executeInTransaction(
      async (tx) => {
        // ── PASO 1: PISAR → borrar todo del tipo (excepto manuales) ──
        await tx.paymentPeriod.deleteMany({
          where: {
            document: {
              tipo: docType,
              NOT: { numeroDocumento: { startsWith: 'MANUAL-' } },
            },
          },
        });
        const deleted = await tx.document.deleteMany({
          where: {
            tipo: docType,
            NOT: { numeroDocumento: { startsWith: 'MANUAL-' } },
          },
        });
        this.logger.log(
          `Eliminados ${deleted.count} documentos tipo ${tipo} (manuales preservados)`,
        );

        // ── PASO 2: Cargar mapas (clientes + suscripciones) ─
        const allClients = await tx.client.findMany({
          select: { id: true, codCli: true, fechaAlta: true },
        });
        const clientMap = new Map(
          allClients.map((c) => [c.codCli, c]),
        );
        const allSubs = await tx.subscription.findMany({
          select: { id: true, clientId: true, tipo: true },
        });
        const subMap = new Map(
          allSubs.map((s) => [`${s.clientId}:${s.tipo}`, s]),
        );

        // Helper: buscar o crear suscripción
        const getOrCreateSub = async (
          clientId: string,
          serviceType: 'CABLE' | 'INTERNET',
          fechaAlta: Date | null,
        ) => {
          const key = `${clientId}:${serviceType}`;
          let sub = subMap.get(key);
          if (!sub) {
            sub = await tx.subscription.create({
              data: {
                clientId,
                tipo: serviceType,
                fechaAlta: fechaAlta || new Date(),
              },
              select: { id: true, clientId: true, tipo: true },
            });
            subMap.set(key, sub);
          }
          return sub;
        };

        // ── PASO 3: Validar y recolectar datos ──────────────
        interface DocData {
          clientId: string;
          codCli: string;
          subscriptionId: string | null;
          tipo: DocumentType;
          fechaDocumento: Date | null;
          numeroDocumento: string | null;
          descripcionOriginal: string | null;
          serviceType: 'CABLE' | 'INTERNET' | null;
        }
        const docBatch: DocData[] = [];

        for (let i = 0; i < parsed.data.length; i++) {
          const row = parsed.data[i];
          const rowNum = i + 2;

          const codCliRaw = this.findCol(row, COL.CODIGO);
          if (!codCliRaw || String(codCliRaw).trim() === '') {
            errors.push({ row: rowNum, message: 'Código de cliente vacío' });
            invalidRows++;
            continue;
          }
          const codCli = String(codCliRaw).trim();

          const client = clientMap.get(codCli);
          if (!client) {
            errors.push({
              row: rowNum,
              message: `Cliente no encontrado con código: "${codCli}"`,
              value: codCli,
            });
            invalidRows++;
            continue;
          }

          const fechaRaw = this.findCol(row, COL.FECHA_DOC);
          const numeroRaw = this.findCol(row, COL.NUMERO_DOC);
          const descripcionRaw = this.findCol(row, COL.DESCRIPCION);

          const descripcionOriginal = descripcionRaw
            ? String(descripcionRaw).trim()
            : null;

          // Detectar tipo de servicio
          const serviceType = detectServiceType(descripcionOriginal);

          // Advertir si no hay períodos (excepto servicios)
          if (descripcionOriginal) {
            const periods = parsePeriodsFromDescription(descripcionOriginal);
            if (
              periods.length === 0 &&
              !/SUSCRIPCION|RECONEXION|PUNTO\s+ADICIONAL|TRASLADO|CAMBIO\s+DE\s+MODEM|INSTALACION/i.test(
                descripcionOriginal,
              )
            ) {
              errors.push({
                row: rowNum,
                column: 'descrip',
                message: `Sin períodos: "${descripcionOriginal}"`,
              });
            }
          }

          // Buscar/crear suscripción
          let subscriptionId: string | null = null;
          if (serviceType) {
            const sub = await getOrCreateSub(client.id, serviceType, client.fechaAlta);
            subscriptionId = sub.id;
          }

          docBatch.push({
            clientId: client.id,
            codCli: client.codCli,
            subscriptionId,
            tipo: docType,
            fechaDocumento: fechaRaw ? this.parseDate(fechaRaw) : null,
            numeroDocumento: numeroRaw ? String(numeroRaw).trim() : null,
            descripcionOriginal,
            serviceType,
          });
          validRows++;
        }

        // ── PASO 4: Batch insert documentos ─────────────────
        if (docBatch.length > 0) {
          const CHUNK = 500;
          for (let i = 0; i < docBatch.length; i += CHUNK) {
            const chunk = docBatch.slice(i, i + CHUNK).map(({ serviceType: _st, ...d }) => d);
            const result = await tx.document.createMany({ data: chunk });
            documentsCreated += result.count;
          }

          // ── PASO 5: Recuperar IDs y crear períodos ────────
          const createdDocs = await tx.document.findMany({
            where: { tipo: docType },
            select: { id: true, clientId: true, codCli: true, subscriptionId: true, descripcionOriginal: true },
          });

          const periodBatch: Array<{
            clientId: string;
            codCli: string;
            documentId: string;
            subscriptionId: string | null;
            periodo: Date;
            year: number;
            month: number;
          }> = [];

          for (const doc of createdDocs) {
            if (!doc.descripcionOriginal) continue;
            const periods = parsePeriodsFromDescription(doc.descripcionOriginal);
            for (const p of periods) {
              periodBatch.push({
                clientId: doc.clientId,
                codCli: doc.codCli,
                documentId: doc.id,
                subscriptionId: doc.subscriptionId,
                periodo: p.periodo,
                year: p.year,
                month: p.month,
              });
            }
          }

          // Batch insert períodos con skipDuplicates
          for (let i = 0; i < periodBatch.length; i += CHUNK) {
            const chunk = periodBatch.slice(i, i + CHUNK);
            const result = await tx.paymentPeriod.createMany({
              data: chunk,
              skipDuplicates: true,
            });
            periodsCreated += result.count;
          }
        }
      },
      { timeout: 180000 },
    );

    try { this.dashboardService.invalidateCache(); } catch (e) { this.logger.error('Error invalidando cache', e); }

    await this.logImport({
      tipo,
      fileName,
      totalRows: parsed.totalRows,
      validRows,
      invalidRows,
      newClients: 0,
      updatedClients: 0,
      errors,
    });

    return {
      success: true,
      tipo,
      totalRows: parsed.totalRows,
      validRows,
      invalidRows,
      newClients: 0,
      updatedClients: 0,
      documentsCreated,
      periodsCreated,
      errors,
    };
  }

  // ══════════════════════════════════════════════════════════════
  // LOGS
  // ══════════════════════════════════════════════════════════════

  async getImportLogs(limit = 20) {
    return this.prisma.importLog.findMany({
      orderBy: { executedAt: 'desc' },
      take: limit,
    });
  }

  // ══════════════════════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════════════════════

  /**
   * Busca un valor en un row probando múltiples nombres de columna.
   * Case-insensitive, trimmed.
   */
  private findCol(
    row: Record<string, unknown>,
    possibleKeys: string[],
  ): unknown {
    for (const key of possibleKeys) {
      if (row[key] !== undefined && row[key] !== null) return row[key];
    }
    // Case-insensitive fallback
    for (const key of possibleKeys) {
      const entry = Object.entries(row).find(
        ([k]) => k.toLowerCase().replace(/[\s_]+/g, '_').trim() === key,
      );
      if (entry && entry[1] !== undefined && entry[1] !== null)
        return entry[1];
    }
    return null;
  }

  /**
   * Parsea un valor a Date de forma robusta.
   * Maneja: Date objects (de raw:true), strings ISO, strings formateados.
   */
  private parseDate(value: unknown): Date | null {
    if (!value) return null;
    if (value instanceof Date) {
      return isNaN(value.getTime()) ? null : value;
    }
    const str = String(value).trim();
    if (!str) return null;
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }

  private async logImport(data: {
    tipo: string;
    fileName: string;
    totalRows: number;
    validRows: number;
    invalidRows: number;
    newClients: number;
    updatedClients: number;
    errors: ExcelParseError[];
  }) {
    await this.prisma.importLog.create({
      data: {
        tipo: data.tipo,
        fileName: data.fileName,
        totalRows: data.totalRows,
        validRows: data.validRows,
        invalidRows: data.invalidRows,
        newClients: data.newClients,
        updatedClients: data.updatedClients,
        errors: data.errors.length > 0 ? (data.errors as unknown as Prisma.InputJsonValue) : undefined,
        status:
          data.validRows === 0 && data.invalidRows > 0
            ? 'FAILED'
            : data.invalidRows > 0
              ? 'PARTIAL'
              : 'SUCCESS',
      },
    });
  }
}
