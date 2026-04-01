import { TipoComprobante } from '@prisma/client';

export interface ComprobanteInput {
  tipo: TipoComprobante;
  fecha: Date;
  emisor: { cuit: string; razonSocial: string; condicionFiscal: string; domicilio?: string; puntoVenta: number };
  receptor: { tipoDoc: string; numeroDoc: string; nombre: string; condicionFiscal: string; domicilio?: string };
  detalle: Array<{ descripcion: string; cantidad: number; precioUnitario: number; descuento?: number }>;
  descuentoGlobal?: number;
}

export interface ComprobanteOutput {
  numero: number;
  cae?: string;
  caeFechaVto?: Date;
  pdfBuffer: Buffer;
  providerResponse?: any;
}

export interface IFiscalProvider {
  readonly name: string;
  emitirComprobante(input: ComprobanteInput): Promise<ComprobanteOutput>;
  anularComprobante(cae: string): Promise<boolean>;
  getUltimoNumero(puntoVenta: number, tipo: TipoComprobante): Promise<number>;
}
