import { Injectable } from '@nestjs/common';
import { ClientStatus } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import dayjs from 'dayjs';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ClientsService, ClientDebtInfo } from '../clients/clients.service';

@Injectable()
export class ExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clientsService: ClientsService,
  ) {}

  /**
   * Genera Excel de clientes para corte (deuda > 2 meses).
   */
  async exportCorteToExcel(): Promise<ExcelJS.Buffer> {
    const clients = await this.getClientsWithDebt();
    const corte = clients
      .filter((c) => c.requiereCorte)
      .sort((a, b) => b.cantidadDeuda - a.cantidadDeuda);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Cable Tracking';
    wb.created = new Date();

    const ws = wb.addWorksheet('Para Corte', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    // ── Header ──
    ws.columns = [
      { header: 'Cliente', key: 'nombre', width: 40 },
      { header: 'Calle', key: 'calle', width: 35 },
      { header: 'Fecha Alta', key: 'fechaAlta', width: 14 },
      { header: 'Meses Deuda', key: 'cantidadDeuda', width: 14 },
      { header: 'Meses Adeudados', key: 'mesesAdeudados', width: 50 },
    ];

    // Style header row
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD32F2F' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 25;

    // ── Data ──
    for (const c of corte) {
      const row = ws.addRow({
        nombre: c.nombreNormalizado,
        calle: c.calle || '',
        fechaAlta: c.fechaAlta
          ? dayjs(c.fechaAlta).format('DD/MM/YYYY')
          : '',
        cantidadDeuda: c.cantidadDeuda,
        mesesAdeudados: c.mesesAdeudados.join(', '),
      });

      // Highlight severely delinquent
      if (c.cantidadDeuda > 6) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFEBEE' },
        };
      }
    }

    // ── Summary row ──
    ws.addRow([]);
    const summaryRow = ws.addRow([
      `Total: ${corte.length} clientes para corte`,
      '',
      '',
      `Generado: ${dayjs().format('DD/MM/YYYY HH:mm')}`,
    ]);
    summaryRow.font = { bold: true, italic: true };

    // Auto-filter
    ws.autoFilter = { from: 'A1', to: 'E1' };

    return await wb.xlsx.writeBuffer();
  }

  /**
   * Genera Excel de todos los clientes con su estado de deuda.
   */
  async exportClientsToExcel(): Promise<ExcelJS.Buffer> {
    const clients = await this.getClientsWithDebt();

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Cable Tracking';
    wb.created = new Date();

    const ws = wb.addWorksheet('Clientes', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    ws.columns = [
      { header: 'Cliente', key: 'nombre', width: 40 },
      { header: 'Estado', key: 'estado', width: 12 },
      { header: 'Calle', key: 'calle', width: 35 },
      { header: 'Fecha Alta', key: 'fechaAlta', width: 14 },
      { header: 'Deuda (meses)', key: 'cantidadDeuda', width: 15 },
      { header: 'Situación', key: 'situacion', width: 16 },
      { header: 'Meses Adeudados', key: 'mesesAdeudados', width: 50 },
    ];

    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1565C0' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 25;

    const getSituacion = (d: ClientDebtInfo): string => {
      if (d.estado !== 'ACTIVO') return 'BAJA';
      if (d.cantidadDeuda === 0) return 'AL DÍA';
      if (d.cantidadDeuda <= 2) return `${d.cantidadDeuda} MES(ES)`;
      return 'CORTE';
    };

    const getRowColor = (d: ClientDebtInfo): string | null => {
      if (d.estado !== 'ACTIVO') return 'FFE0E0E0'; // grey
      if (d.cantidadDeuda === 0) return null;
      if (d.cantidadDeuda === 1) return 'FFFFF8E1'; // light yellow
      if (d.cantidadDeuda === 2) return 'FFFFF3E0'; // light orange
      return 'FFFFEBEE'; // light red
    };

    for (const c of clients) {
      const row = ws.addRow({
        nombre: c.nombreNormalizado,
        estado: c.estado,
        calle: c.calle || '',
        fechaAlta: c.fechaAlta
          ? dayjs(c.fechaAlta).format('DD/MM/YYYY')
          : '',
        cantidadDeuda: c.cantidadDeuda,
        situacion: getSituacion(c),
        mesesAdeudados: c.mesesAdeudados.join(', '),
      });

      const color = getRowColor(c);
      if (color) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: color },
        };
      }
    }

    // Summary
    ws.addRow([]);
    const activos = clients.filter((c) => c.estado === 'ACTIVO');
    const alDia = activos.filter((c) => c.cantidadDeuda === 0).length;
    const conDeuda = activos.filter((c) => c.cantidadDeuda > 0).length;
    const paraCorte = activos.filter((c) => c.requiereCorte).length;

    const s1 = ws.addRow([
      `Total: ${clients.length} | Activos: ${activos.length} | Al día: ${alDia} | Con deuda: ${conDeuda} | Para corte: ${paraCorte}`,
    ]);
    s1.font = { bold: true };
    const s2 = ws.addRow([
      `Generado: ${dayjs().format('DD/MM/YYYY HH:mm')}`,
    ]);
    s2.font = { italic: true };

    ws.autoFilter = { from: 'A1', to: 'G1' };

    return await wb.xlsx.writeBuffer();
  }

  /**
   * Exporta resumen de deuda (para el dueño).
   */
  async exportResumenToExcel(): Promise<ExcelJS.Buffer> {
    const clients = await this.getClientsWithDebt();
    const activos = clients.filter((c) => c.estado === 'ACTIVO');

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Cable Tracking';

    // ── Hoja 1: Resumen ──
    const wsRes = wb.addWorksheet('Resumen');
    wsRes.columns = [
      { header: 'Indicador', key: 'label', width: 30 },
      { header: 'Valor', key: 'value', width: 15 },
    ];

    const h = wsRes.getRow(1);
    h.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    h.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2E7D32' },
    };

    const alDia = activos.filter((c) => c.cantidadDeuda === 0).length;
    const unMes = activos.filter((c) => c.cantidadDeuda === 1).length;
    const dosMeses = activos.filter((c) => c.cantidadDeuda === 2).length;
    const masDosMeses = activos.filter((c) => c.cantidadDeuda > 2).length;
    const tasaMoro =
      activos.length > 0
        ? (((unMes + dosMeses + masDosMeses) / activos.length) * 100).toFixed(1)
        : '0';

    wsRes.addRow({ label: 'Total clientes', value: clients.length });
    wsRes.addRow({ label: 'Activos', value: activos.length });
    wsRes.addRow({
      label: 'De baja',
      value: clients.length - activos.length,
    });
    wsRes.addRow({ label: '', value: '' });
    wsRes.addRow({ label: 'Al día', value: alDia });
    wsRes.addRow({ label: '1 mes de deuda', value: unMes });
    wsRes.addRow({ label: '2 meses de deuda', value: dosMeses });
    wsRes.addRow({ label: '+2 meses (para corte)', value: masDosMeses });
    wsRes.addRow({ label: '', value: '' });
    wsRes.addRow({ label: 'Tasa de morosidad', value: `${tasaMoro}%` });
    wsRes.addRow({
      label: 'Fecha de reporte',
      value: dayjs().format('DD/MM/YYYY HH:mm'),
    });

    // ── Hoja 2: Para corte ──
    const wsCorte = wb.addWorksheet('Para Corte');
    const corte = activos
      .filter((c) => c.requiereCorte)
      .sort((a, b) => b.cantidadDeuda - a.cantidadDeuda);

    wsCorte.columns = [
      { header: 'Cliente', key: 'nombre', width: 40 },
      { header: 'Calle', key: 'calle', width: 35 },
      { header: 'Meses Deuda', key: 'deuda', width: 14 },
      { header: 'Desde', key: 'desde', width: 12 },
    ];

    const hCorte = wsCorte.getRow(1);
    hCorte.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    hCorte.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD32F2F' },
    };

    for (const c of corte) {
      wsCorte.addRow({
        nombre: c.nombreNormalizado,
        calle: c.calle || '',
        deuda: c.cantidadDeuda,
        desde: c.mesesAdeudados[0] || '',
      });
    }

    return await wb.xlsx.writeBuffer();
  }

  // ── Private ──

  private async getClientsWithDebt(): Promise<ClientDebtInfo[]> {
    const clients = await this.prisma.client.findMany({
      include: {
        subscriptions: {
          include: { paymentPeriods: { select: { year: true, month: true } } },
        },
      },
      orderBy: { nombreNormalizado: 'asc' },
    });

    return clients.map((c) =>
      this.clientsService.calculateDebt(
        c.id,
        c.codCli,
        c.nombreNormalizado,
        c.estado,
        c.fechaAlta,
        c.calle,
        c.subscriptions,
      ),
    );
  }
}
