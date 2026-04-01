import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';

@Injectable()
export class PdfGeneratorService {
  createDoc(options?: { size?: string; margin?: number }): PDFKit.PDFDocument {
    return new PDFDocument({ size: options?.size || 'A4', margin: options?.margin || 40 });
  }

  addHeader(doc: PDFKit.PDFDocument, title: string, subtitle?: string) {
    doc.fontSize(18).font('Helvetica-Bold').text(title, { align: 'center' });
    if (subtitle) doc.fontSize(11).font('Helvetica').text(subtitle, { align: 'center' });
    doc.moveDown(0.5);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke('#cccccc');
    doc.moveDown(0.5);
  }

  addSection(doc: PDFKit.PDFDocument, title: string) {
    doc.moveDown(0.3);
    doc.fontSize(12).font('Helvetica-Bold').text(title);
    doc.moveDown(0.2);
  }

  addKeyValue(doc: PDFKit.PDFDocument, key: string, value: string) {
    doc.fontSize(10).font('Helvetica-Bold').text(key + ': ', { continued: true });
    doc.font('Helvetica').text(value);
  }

  addTableHeader(doc: PDFKit.PDFDocument, headers: string[], widths: number[]) {
    const y = doc.y;
    doc.fontSize(9).font('Helvetica-Bold');
    let x = 40;
    for (let i = 0; i < headers.length; i++) {
      doc.text(headers[i], x, y, { width: widths[i] });
      x += widths[i];
    }
    doc.moveDown(0.3);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke('#cccccc');
    doc.moveDown(0.2);
  }

  addTableRow(doc: PDFKit.PDFDocument, cells: string[], widths: number[]) {
    const y = doc.y;
    doc.fontSize(8).font('Helvetica');
    let x = 40;
    for (let i = 0; i < cells.length; i++) {
      doc.text(cells[i], x, y, { width: widths[i] });
      x += widths[i];
    }
    doc.moveDown(0.2);
  }

  addFooter(doc: PDFKit.PDFDocument, text: string) {
    doc.moveDown(1);
    doc.fontSize(8).font('Helvetica').fillColor('#888888').text(text, { align: 'center' });
    doc.fillColor('#000000');
  }

  toBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.end();
    });
  }
}
