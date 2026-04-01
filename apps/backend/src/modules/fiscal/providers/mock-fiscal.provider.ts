import { Injectable } from '@nestjs/common';
import { TipoComprobante } from '@prisma/client';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../../../common/prisma/prisma.service';
import type { IFiscalProvider, ComprobanteInput, ComprobanteOutput } from './fiscal-provider.interface';

@Injectable()
export class MockFiscalProvider implements IFiscalProvider {
  readonly name = 'mock';

  constructor(private readonly prisma: PrismaService) {}

  async getUltimoNumero(puntoVenta: number, tipo: TipoComprobante): Promise<number> {
    const last = await this.prisma.comprobante.findFirst({
      where: { puntoVenta, tipo },
      orderBy: { numero: 'desc' },
      select: { numero: true },
    });
    return last?.numero || 0;
  }

  async emitirComprobante(input: ComprobanteInput): Promise<ComprobanteOutput> {
    const numero = (await this.getUltimoNumero(input.emisor.puntoVenta, input.tipo)) + 1;
    const pdfBuffer = await this.generatePdf(input, numero);
    return { numero, pdfBuffer, providerResponse: { mock: true, generatedAt: new Date() } };
  }

  async anularComprobante(): Promise<boolean> {
    return true;
  }

  private async generatePdf(input: ComprobanteInput, numero: number): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));

    const tipoLabel = input.tipo.replace('_', ' ');
    const pvStr = String(input.emisor.puntoVenta).padStart(4, '0');
    const numStr = String(numero).padStart(8, '0');

    // Header emisor
    doc.fontSize(14).font('Helvetica-Bold').text(input.emisor.razonSocial, { align: 'center' });
    doc.fontSize(9).font('Helvetica').text(`CUIT: ${input.emisor.cuit}`, { align: 'center' });
    doc.text(`${input.emisor.condicionFiscal}`, { align: 'center' });
    if (input.emisor.domicilio) doc.text(input.emisor.domicilio, { align: 'center' });
    doc.moveDown(0.5);

    // Tipo comprobante
    doc.fontSize(12).font('Helvetica-Bold').text(`${tipoLabel}`, { align: 'center' });
    doc.fontSize(10).fillColor('#cc0000').text('COMPROBANTE INTERNO — NO VÁLIDO FISCALMENTE', { align: 'center' });
    doc.fillColor('#000000');
    doc.fontSize(9).font('Helvetica').text(`Punto Venta: ${pvStr}  |  Número: ${numStr}  |  Fecha: ${input.fecha.toLocaleDateString('es-AR')}`, { align: 'center' });
    doc.moveDown(0.5);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke('#cccccc');
    doc.moveDown(0.3);

    // Receptor
    doc.fontSize(9).font('Helvetica-Bold').text('Receptor:');
    doc.font('Helvetica').text(`${input.receptor.nombre}`);
    doc.text(`${input.receptor.tipoDoc}: ${input.receptor.numeroDoc}`);
    doc.text(`Condición: ${input.receptor.condicionFiscal}`);
    if (input.receptor.domicilio) doc.text(`Domicilio: ${input.receptor.domicilio}`);
    doc.moveDown(0.5);

    // Detalle
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke('#cccccc');
    doc.moveDown(0.3);
    doc.fontSize(8).font('Helvetica-Bold');
    const y = doc.y;
    doc.text('Descripción', 40, y, { width: 280 });
    doc.text('Cant', 320, y, { width: 40 });
    doc.text('P.Unit', 360, y, { width: 80 });
    doc.text('Subtotal', 440, y, { width: 80, align: 'right' });
    doc.moveDown(0.3);

    let subtotal = 0;
    doc.font('Helvetica').fontSize(8);
    for (const item of input.detalle) {
      const lineSubtotal = item.cantidad * item.precioUnitario - (item.descuento || 0);
      subtotal += lineSubtotal;
      const iy = doc.y;
      doc.text(item.descripcion, 40, iy, { width: 280 });
      doc.text(String(item.cantidad), 320, iy, { width: 40 });
      doc.text(`$${item.precioUnitario.toLocaleString()}`, 360, iy, { width: 80 });
      doc.text(`$${lineSubtotal.toLocaleString()}`, 440, iy, { width: 80, align: 'right' });
      doc.moveDown(0.2);
    }

    doc.moveDown(0.5);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke('#cccccc');
    doc.moveDown(0.3);

    // Totales
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text(`Subtotal: $${subtotal.toLocaleString()}`, { align: 'right' });
    if (input.descuentoGlobal) doc.text(`Descuento: -$${input.descuentoGlobal.toLocaleString()}`, { align: 'right' });
    doc.text(`TOTAL: $${(subtotal - (input.descuentoGlobal || 0)).toLocaleString()}`, { align: 'right' });

    doc.moveDown(1);
    doc.fontSize(8).fillColor('#cc0000').text('*** COMPROBANTE INTERNO - NO VÁLIDO AFIP ***', { align: 'center' });
    doc.text('CAE: PENDIENTE DE EMISIÓN FISCAL', { align: 'center' });
    doc.fillColor('#000000');

    doc.end();
    return new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));
  }
}
