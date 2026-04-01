import { Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { TipoComprobante } from '@prisma/client';
import type { IFiscalProvider, ComprobanteInput, ComprobanteOutput } from './fiscal-provider.interface';

export class TusFacturasProvider implements IFiscalProvider {
  readonly name = 'tusFacturas';
  private readonly logger = new Logger(TusFacturasProvider.name);
  private client: AxiosInstance;

  constructor(
    private readonly usertoken: string,
    private readonly apikey: string,
    private readonly apitoken: string,
    private readonly puntoVenta: number,
  ) {
    this.client = axios.create({
      baseURL: 'https://www.tusfacturas.app/app/api/v2',
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
    });
  }

  async emitirComprobante(input: ComprobanteInput): Promise<ComprobanteOutput> {
    const tipoTF = this.mapTipoComprobante(input.tipo);
    const condicionIva = this.mapCondicionFiscal(input.receptor.condicionFiscal);

    const subtotal = input.detalle.reduce((s, d) => s + d.precioUnitario * d.cantidad - (d.descuento || 0), 0);
    const esRI = input.emisor.condicionFiscal.includes('Responsable');
    const precioSinIva = esRI ? Math.round((subtotal / 1.21) * 100) / 100 : subtotal;
    const alicuota = esRI ? 21 : 0;

    const payload = {
      usertoken: this.usertoken,
      apikey: parseInt(this.apikey),
      apitoken: this.apitoken,
      cliente: {
        documento_tipo: input.receptor.tipoDoc === 'CUIT' ? 'CUIT' : 'DNI',
        documento_nro: (input.receptor.numeroDoc || '0').replace(/[-\s]/g, ''),
        razon_social: input.receptor.nombre,
        domicilio: input.receptor.domicilio || 'Sin domicilio',
        provincia: '8', // Entre Ríos
        condicion_iva: condicionIva,
        condicion_pago: '201',
        envia_por_mail: 'N',
        reclama_deuda: 'N',
        rg5329: 'N',
        codigo: (input.receptor.numeroDoc || '0').replace(/[-\s]/g, ''),
      },
      comprobante: {
        fecha: this.formatDate(input.fecha),
        tipo: tipoTF,
        operacion: 'V',
        idioma: '1',
        punto_venta: this.puntoVenta,
        moneda: 'PES',
        cotizacion: 1,
        periodo_facturado_desde: this.formatDate(input.fecha),
        periodo_facturado_hasta: this.formatDate(input.fecha),
        vencimiento: this.formatDate(new Date(input.fecha.getFullYear(), input.fecha.getMonth() + 1, 10)),
        rubro: 'Servicios de telecomunicaciones',
        rubro_grupo_contable: 'Servicios',
        detalle: [{
          cantidad: 1,
          afecta_stock: 'N',
          bonificacion_porcentaje: input.descuentoGlobal && subtotal > 0 ? Math.round((input.descuentoGlobal / subtotal) * 100) : 0,
          producto: {
            descripcion: input.detalle[0]?.descripcion || 'Servicio mensual',
            unidad_bulto: 1,
            lista_precios: 'Servicios Cable',
            codigo: 'SVC-001',
            precio_unitario_sin_iva: precioSinIva,
            alicuota,
            unidad_medida: 7,
            actualiza_precio: 'S',
            rg5329: 'N',
          },
        }],
        total: Math.round(subtotal * 100) / 100,
        tributos: [],
      },
    };

    try {
      const response = await this.client.post('/facturacion/nuevo', payload);
      const data = response.data;

      if (data.error === 'S') {
        const errores = Array.isArray(data.errores) ? data.errores.join(', ') : String(data.errores);
        throw new Error(`TusFacturas: ${errores}`);
      }

      const numero = data.comprobante_nro || data.numero || 0;

      let pdfBuffer: Buffer;
      if (data.url_pdf) {
        const pdfResponse = await axios.get(data.url_pdf, { responseType: 'arraybuffer', timeout: 15000 });
        pdfBuffer = Buffer.from(pdfResponse.data);
      } else {
        pdfBuffer = Buffer.from('PDF no disponible');
      }

      return {
        numero,
        cae: data.cae?.trim(),
        caeFechaVto: data.vencimiento_cae ? this.parseDate(data.vencimiento_cae) : undefined,
        pdfBuffer,
        providerResponse: data,
      };
    } catch (error: any) {
      this.logger.error('Error TusFacturas', error.message);
      throw error;
    }
  }

  async anularComprobante(cae: string): Promise<boolean> {
    this.logger.warn(`Anulación CAE ${cae}: emitir Nota de Crédito manualmente en TusFacturas`);
    return true;
  }

  async getUltimoNumero(): Promise<number> {
    return 0; // TusFacturas maneja numeración automática
  }

  private mapTipoComprobante(tipo: TipoComprobante): string {
    const m: Record<string, string> = { FACTURA_A: 'FACTURA A', FACTURA_B: 'FACTURA B', FACTURA_C: 'FACTURA C', RECIBO_X: 'FACTURA B' };
    return m[tipo] || 'FACTURA B';
  }

  private mapCondicionFiscal(condicion: string): string {
    const m: Record<string, string> = { RESPONSABLE_INSCRIPTO: 'RI', MONOTRIBUTISTA: 'M', CONSUMIDOR_FINAL: 'CF', EXENTO: 'E' };
    return m[condicion] || 'CF';
  }

  private formatDate(date: Date): string {
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
  }

  private parseDate(s: string): Date {
    const [d, m, y] = s.split('/');
    return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  }
}
