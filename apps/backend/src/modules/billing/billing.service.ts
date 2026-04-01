import { Injectable, NotFoundException } from '@nestjs/common';
import { ClientStatus, ServiceType } from '@prisma/client';
import dayjs from 'dayjs';
import * as archiver from 'archiver';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ClientsService } from '../clients/clients.service';
import { PdfGeneratorService } from './pdf-generator.service';

const MONTH_NAMES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MONTH_SHORT = ['', 'ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clientsService: ClientsService,
    private readonly pdf: PdfGeneratorService,
  ) {}

  async generateInvoice(clientId: string, month: number, year: number): Promise<Buffer> {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      include: {
        subscriptions: {
          include: {
            plan: { include: { promotions: { where: { activa: true, tipo: 'MESES_GRATIS' as const } } } },
            clientPromotions: { include: { promotion: { select: { id: true, nombre: true, tipo: true, valor: true, fechaInicio: true, fechaFin: true } } } },
            paymentPeriods: { select: { year: true, month: true } },
          },
        },
      },
    });
    if (!client) throw new NotFoundException('Cliente no encontrado');

    const doc = this.pdf.createDoc();
    this.pdf.addHeader(doc, 'Cable Tracking', `Factura Mensual — ${MONTH_NAMES[month]} ${year}`);

    this.pdf.addKeyValue(doc, 'Cliente', client.nombreNormalizado);
    this.pdf.addKeyValue(doc, 'Dirección', client.calle || '—');
    this.pdf.addKeyValue(doc, 'Estado', client.estado);
    doc.moveDown(0.5);

    this.pdf.addSection(doc, 'SERVICIOS');
    let totalMes = 0;
    let totalDeuda = 0;

    for (const sub of client.subscriptions) {
      const icon = sub.tipo === 'CABLE' ? 'Cable' : 'Internet';
      const planName = sub.plan?.nombre || 'Sin plan';
      const precio = sub.plan ? Number(sub.plan.precio) : 0;
      const pagado = sub.paymentPeriods.some((p) => p.year === year && p.month === month);
      const promosGratis = [
        ...(sub.plan?.promotions || []).filter((p) => p.tipo === 'MESES_GRATIS').map((p) => ({ id: p.id, nombre: p.nombre, tipo: p.tipo as any, valor: Number(p.valor), fechaInicio: p.fechaInicio, fechaFin: p.fechaFin })),
        ...(sub.clientPromotions || []).filter((cp) => cp.promotion.tipo === 'MESES_GRATIS').map((cp) => ({ id: cp.promotion.id, nombre: cp.promotion.nombre, tipo: cp.promotion.tipo as any, valor: Number(cp.promotion.valor), fechaInicio: cp.promotion.fechaInicio, fechaFin: cp.promotion.fechaFin })),
      ];
      const debt = this.clientsService.calculateSubDebt(sub.id, sub.tipo, sub.estado, sub.fechaAlta, sub.paymentPeriods, promosGratis);

      doc.fontSize(10).font('Helvetica-Bold').text(`${icon} — ${planName}`, { continued: true });
      doc.font('Helvetica').text(precio > 0 ? `  $${precio.toLocaleString()}` : '  $—');
      doc.fontSize(9).font('Helvetica').text(`  Período: ${MONTH_NAMES[month]} ${year} — ${pagado ? 'PAGADO ✓' : 'PENDIENTE ✗'}`);
      if (debt.cantidadDeuda > 0) {
        doc.text(`  Deuda acumulada: ${debt.cantidadDeuda} meses`);
      }
      doc.moveDown(0.3);

      if (!pagado) totalMes += precio;
      totalDeuda += precio * debt.cantidadDeuda;
    }

    doc.moveDown(0.5);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke('#cccccc');
    doc.moveDown(0.3);
    doc.fontSize(11).font('Helvetica-Bold').text(`Total del mes: $${totalMes.toLocaleString()}`);
    doc.text(`Deuda total estimada: $${totalDeuda.toLocaleString()}`);

    if (client.subscriptions.some((s) => !s.plan)) {
      doc.moveDown(0.5);
      doc.fontSize(8).fillColor('#ff0000').text('Nota: Algunas suscripciones no tienen plan configurado.').fillColor('#000000');
    }

    this.pdf.addFooter(doc, `Generado: ${dayjs().format('DD/MM/YYYY HH:mm')}`);
    return this.pdf.toBuffer(doc);
  }

  async generateBatchInvoices(month: number, year: number): Promise<Buffer> {
    const clients = await this.prisma.client.findMany({
      where: { estado: ClientStatus.ACTIVO },
      include: { subscriptions: { include: { plan: true, paymentPeriods: { select: { year: true, month: true } } } } },
      orderBy: { nombreNormalizado: 'asc' },
    });

    return new Promise((resolve, reject) => {
      const archive = archiver.default('zip', { zlib: { level: 5 } });
      const chunks: Buffer[] = [];
      archive.on('data', (c: Buffer) => chunks.push(c));
      archive.on('end', () => resolve(Buffer.concat(chunks)));
      archive.on('error', reject);

      const addClients = async () => {
        for (const client of clients) {
          try {
            const buf = await this.generateInvoiceForClient(client, month, year);
            const name = `${client.nombreNormalizado.replace(/[^a-zA-Z0-9 ]/g, '')}_${MONTH_SHORT[month]}${year}.pdf`;
            archive.append(buf, { name });
          } catch { /* skip */ }
        }
        archive.finalize();
      };
      addClients();
    });
  }

  private async generateInvoiceForClient(client: any, month: number, year: number): Promise<Buffer> {
    const doc = this.pdf.createDoc();
    this.pdf.addHeader(doc, 'Cable Tracking', `Factura — ${MONTH_NAMES[month]} ${year}`);
    this.pdf.addKeyValue(doc, 'Cliente', client.nombreNormalizado);
    this.pdf.addKeyValue(doc, 'Dirección', client.calle || '—');
    doc.moveDown(0.5);

    for (const sub of client.subscriptions) {
      const planName = sub.plan?.nombre || 'Sin plan';
      const precio = sub.plan ? Number(sub.plan.precio) : 0;
      const pagado = sub.paymentPeriods.some((p: any) => p.year === year && p.month === month);
      doc.fontSize(10).font('Helvetica-Bold').text(`${sub.tipo} — ${planName}`, { continued: true });
      doc.font('Helvetica').text(precio > 0 ? `  $${precio}` : '  $—');
      doc.fontSize(9).text(`  ${MONTH_NAMES[month]} ${year}: ${pagado ? 'PAGADO' : 'PENDIENTE'}`);
      doc.moveDown(0.2);
    }

    this.pdf.addFooter(doc, `Generado: ${dayjs().format('DD/MM/YYYY HH:mm')}`);
    return this.pdf.toBuffer(doc);
  }

  async getReport(month: number, year: number) {
    const subs = await this.prisma.subscription.findMany({
      where: { estado: ClientStatus.ACTIVO },
      include: {
        plan: true,
        paymentPeriods: { where: { year, month }, select: { id: true } },
        client: { select: { id: true, nombreNormalizado: true } },
      },
    });

    const cable = subs.filter((s) => s.tipo === ServiceType.CABLE);
    const internet = subs.filter((s) => s.tipo === ServiceType.INTERNET);
    const cablePaid = cable.filter((s) => s.paymentPeriods.length > 0);
    const internetPaid = internet.filter((s) => s.paymentPeriods.length > 0);

    const calcMonto = (arr: typeof subs) => arr.reduce((sum, s) => sum + (s.plan ? Number(s.plan.precio) : 0), 0);

    const clientIds = [...new Set(subs.map((s) => s.client.id))];
    const clientsConPago = new Set(subs.filter((s) => s.paymentPeriods.length > 0).map((s) => s.client.id));

    // Mes anterior
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prevPaid = await this.prisma.paymentPeriod.groupBy({
      by: ['clientId'],
      where: { year: prevYear, month: prevMonth },
    });
    const prevClients = await this.prisma.subscription.count({ where: { estado: ClientStatus.ACTIVO } });
    const prevPct = prevClients > 0 ? (prevPaid.length / prevClients) * 100 : 0;

    const pctCobrado = clientIds.length > 0 ? (clientsConPago.size / clientIds.length) * 100 : 0;

    // Top 20 sin pago
    const sinPago = subs
      .filter((s) => s.paymentPeriods.length === 0)
      .map((s) => s.client);
    const uniqueSinPago = [...new Map(sinPago.map((c) => [c.id, c])).values()].slice(0, 20);

    return {
      periodo: `${MONTH_NAMES[month]} ${year}`,
      resumen: {
        totalClientes: clientIds.length,
        clientesConPago: clientsConPago.size,
        clientesSinPago: clientIds.length - clientsConPago.size,
        porcentajeCobrado: Math.round(pctCobrado * 10) / 10,
      },
      porServicio: {
        cable: {
          suscripcionesActivas: cable.length,
          pagadas: cablePaid.length,
          pendientes: cable.length - cablePaid.length,
          montoEsperado: calcMonto(cable),
          montoRecaudado: calcMonto(cablePaid),
        },
        internet: {
          suscripcionesActivas: internet.length,
          pagadas: internetPaid.length,
          pendientes: internet.length - internetPaid.length,
          montoEsperado: calcMonto(internet),
          montoRecaudado: calcMonto(internetPaid),
        },
      },
      comparacionMesAnterior: {
        porcentajeCobradoAnterior: Math.round(prevPct * 10) / 10,
        variacion: Math.round((pctCobrado - prevPct) * 10) / 10,
      },
      clientesSinPago: uniqueSinPago.map((c) => ({ id: c.id, nombre: c.nombreNormalizado })),
    };
  }

  async generateCortePdf() {
    const clients = await this.prisma.client.findMany({
      where: { estado: ClientStatus.ACTIVO },
      include: {
        subscriptions: {
          where: { estado: ClientStatus.ACTIVO },
          include: { paymentPeriods: { select: { year: true, month: true } } },
        },
      },
      orderBy: { calle: 'asc' },
    });

    // Calcular deuda y filtrar
    const corte = clients
      .map((c) => {
        const debt = this.clientsService.calculateDebt(c.id, c.codCli, c.nombreNormalizado, c.estado, c.fechaAlta, c.calle, c.subscriptions);
        return debt;
      })
      .filter((d) => d.requiereCorte)
      .sort((a, b) => (a.calle || '').localeCompare(b.calle || ''));

    const doc = this.pdf.createDoc({ margin: 30 });
    const now = dayjs();

    this.pdf.addHeader(doc, 'LISTA DE CORTE', `${MONTH_NAMES[now.month() + 1]} ${now.year()} — Generada: ${now.format('DD/MM/YYYY HH:mm')}`);
    doc.fontSize(10).text(`Total clientes: ${corte.length}`);
    doc.moveDown(0.5);

    const widths = [30, 160, 140, 50, 60];
    this.pdf.addTableHeader(doc, ['N°', 'Cliente', 'Dirección', 'Cable', 'Internet'], widths);

    corte.forEach((c, i) => {
      if (doc.y > 750) { doc.addPage(); }
      this.pdf.addTableRow(doc, [
        String(i + 1),
        c.nombreNormalizado,
        c.calle || '—',
        c.deudaCable > 0 ? `${c.deudaCable}m` : '—',
        c.deudaInternet > 0 ? `${c.deudaInternet}m` : '—',
      ], widths);
    });

    this.pdf.addFooter(doc, `Cable Tracking — ${now.format('DD/MM/YYYY')}`);
    return this.pdf.toBuffer(doc);
  }
}
