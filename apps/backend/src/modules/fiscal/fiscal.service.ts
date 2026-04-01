import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { TipoComprobante, CondicionFiscal, EstadoComprobante } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { MockFiscalProvider } from './providers/mock-fiscal.provider';
import { TusFacturasProvider } from './providers/tusFacturas.provider';
import type { IFiscalProvider, ComprobanteInput } from './providers/fiscal-provider.interface';

@Injectable()
export class FiscalService {
  private readonly logger = new Logger(FiscalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mockProvider: MockFiscalProvider,
  ) {}

  private async getProvider(): Promise<IFiscalProvider> {
    const config = await this.prisma.empresaConfig.findFirst();
    if (!config) return this.mockProvider;
    if (config.providerName === 'tusFacturas') {
      if (!config.tfUsertoken || !config.tfApikey || !config.tfApitoken) {
        throw new BadRequestException('Credenciales de TusFacturas incompletas');
      }
      return new TusFacturasProvider(config.tfUsertoken, config.tfApikey, config.tfApitoken, config.puntoVenta);
    }
    return this.mockProvider;
  }

  async getPaymentPeriod(id: string) {
    return this.prisma.paymentPeriod.findUniqueOrThrow({ where: { id } });
  }

  // ── Config ───────────────────────────────────────────────

  async testConnection(): Promise<{ ok: boolean; mensaje: string }> {
    try {
      const provider = await this.getProvider();
      if (provider.name === 'mock') return { ok: true, mensaje: 'Modo interno (mock) activo.' };
      await provider.getUltimoNumero(1, 'FACTURA_B' as any);
      return { ok: true, mensaje: 'Conexión con TusFacturas exitosa.' };
    } catch (error: any) {
      return { ok: false, mensaje: `Error: ${error.message}` };
    }
  }

  async updateComprobanteConfig(userId: string, clientId: string, tipoComprobante: string) {
    const client = await this.prisma.client.findUniqueOrThrow({ where: { id: clientId } });
    if (tipoComprobante === 'FACTURA') {
      if (!client.numeroDocFiscal) throw new BadRequestException('El cliente no tiene CUIT/DNI cargado. Completá los datos fiscales primero.');
    }
    const before = client.tipoComprobante;
    const updated = await this.prisma.client.update({
      where: { id: clientId },
      data: { tipoComprobante },
      select: { id: true, tipoComprobante: true },
    });
    await this.audit.log(userId, 'CLIENT_COMPROBANTE_CONFIG_UPDATED', 'CLIENT', clientId, { before, after: tipoComprobante });
    return updated;
  }

  async getConfig() {
    const config = await this.prisma.empresaConfig.findFirst();
    if (!config) return null;
    return {
      ...config,
      providerApiKey: config.providerApiKey ? '****' : null,
      tfUsertoken: undefined, tfApikey: undefined, tfApitoken: undefined,
      tfUsertokenConfigured: !!config.tfUsertoken,
      tfApikeyConfigured: !!config.tfApikey,
      tfApitokenConfigured: !!config.tfApitoken,
    };
  }

  async updateConfig(userId: string, data: any) {
    const existing = await this.prisma.empresaConfig.findFirst();
    if (!existing) throw new NotFoundException('Config no encontrada');
    const updated = await this.prisma.empresaConfig.update({
      where: { id: existing.id },
      data: { ...data, updatedBy: userId },
    });
    await this.audit.log(userId, 'EMPRESA_CONFIG_UPDATED', 'CONFIG', existing.id, data);
    return { ...updated, providerApiKey: updated.providerApiKey ? '****' : null };
  }

  // ── Tipo comprobante ─────────────────────────────────────

  determinarTipoComprobante(emisorCondicion: string, receptorCondicion: CondicionFiscal, esMock: boolean): TipoComprobante {
    if (esMock) return TipoComprobante.RECIBO_X;
    if (emisorCondicion.includes('Monotributista')) return TipoComprobante.FACTURA_C;
    if (receptorCondicion === CondicionFiscal.RESPONSABLE_INSCRIPTO) return TipoComprobante.FACTURA_A;
    return TipoComprobante.FACTURA_B;
  }

  calcularIVA(subtotal: number, emisorCondicion: string): number {
    if (emisorCondicion.includes('Monotributista')) return 0;
    if (emisorCondicion.includes('Responsable')) return Math.round(subtotal * 0.21 * 100) / 100;
    return 0;
  }

  // ── Emitir ───────────────────────────────────────────────

  async emitirComprobanteParaPago(clientId: string, subscriptionId: string, paymentPeriodId: string, userId: string) {
    const config = await this.prisma.empresaConfig.findFirst();
    if (!config) throw new BadRequestException('Empresa no configurada');

    const client = await this.prisma.client.findUniqueOrThrow({ where: { id: clientId } });

    // Check tipoComprobante — RAMITO clients don't get fiscal invoices
    if (client.tipoComprobante === 'RAMITO') {
      this.logger.log(`Cliente ${client.nombreNormalizado}: tipoComprobante=RAMITO, no se emite comprobante fiscal`);
      return null;
    }
    const sub = await this.prisma.subscription.findUnique({ where: { id: subscriptionId }, include: { plan: true } });

    const esMock = config.providerName === 'mock';
    const tipo = this.determinarTipoComprobante(config.condicionFiscal, client.condicionFiscal, esMock);
    const precio = sub?.plan ? Number(sub.plan.precio) : 0;
    const iva = this.calcularIVA(precio, config.condicionFiscal);

    const input: ComprobanteInput = {
      tipo,
      fecha: new Date(),
      emisor: { cuit: config.cuit, razonSocial: config.razonSocial, condicionFiscal: config.condicionFiscal, domicilio: config.domicilioFiscal || undefined, puntoVenta: config.puntoVenta },
      receptor: {
        tipoDoc: client.tipoDocumento || 'CONSUMIDOR_FINAL',
        numeroDoc: client.numeroDocFiscal || '0',
        nombre: client.razonSocial || client.nombreNormalizado,
        condicionFiscal: client.condicionFiscal,
        domicilio: client.calle || undefined,
      },
      detalle: [{ descripcion: `${sub?.tipo || 'Servicio'} — ${sub?.plan?.nombre || 'Sin plan'}`, cantidad: 1, precioUnitario: precio }],
    };

    const provider = await this.getProvider();
    const output = await provider.emitirComprobante(input);

    const comprobante = await this.prisma.comprobante.create({
      data: {
        clientId, subscriptionId, paymentPeriodId,
        tipo, numero: output.numero, puntoVenta: config.puntoVenta, fecha: new Date(),
        emisorCuit: config.cuit, emisorRazonSocial: config.razonSocial, emisorCondicion: config.condicionFiscal,
        receptorDoc: client.numeroDocFiscal || '0', receptorNombre: client.razonSocial || client.nombreNormalizado, receptorCondicion: client.condicionFiscal,
        subtotal: precio, iva, total: precio + iva,
        detalle: input.detalle,
        estado: output.cae ? EstadoComprobante.EMITIDO : EstadoComprobante.PENDIENTE,
        cae: output.cae, caeFechaVto: output.caeFechaVto, providerResponse: output.providerResponse,
      },
    });

    await this.audit.log(userId, 'COMPROBANTE_EMITIDO', 'COMPROBANTE', comprobante.id, { tipo, numero: output.numero });
    return comprobante;
  }

  // ── Consultas ────────────────────────────────────────────

  async findAll(filters: { clientId?: string; estado?: string; tipo?: string; month?: number; year?: number; page?: number; limit?: number }) {
    const where: any = {};
    if (filters.clientId) where.clientId = filters.clientId;
    if (filters.estado) where.estado = filters.estado;
    if (filters.tipo) where.tipo = filters.tipo;

    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 20, 100);

    const [data, total] = await Promise.all([
      this.prisma.comprobante.findMany({
        where, orderBy: { fecha: 'desc' }, skip: (page - 1) * limit, take: limit,
        include: { client: { select: { nombreNormalizado: true, codCli: true } } },
      }),
      this.prisma.comprobante.count({ where }),
    ]);
    return { data, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    return this.prisma.comprobante.findUniqueOrThrow({
      where: { id },
      include: { client: true, subscription: { include: { plan: true } } },
    });
  }

  async getPdf(id: string): Promise<Buffer> {
    const comp = await this.findOne(id);
    const config = await this.prisma.empresaConfig.findFirst();
    const input: ComprobanteInput = {
      tipo: comp.tipo,
      fecha: comp.fecha,
      emisor: { cuit: comp.emisorCuit, razonSocial: comp.emisorRazonSocial, condicionFiscal: comp.emisorCondicion, puntoVenta: comp.puntoVenta },
      receptor: { tipoDoc: 'DOC', numeroDoc: comp.receptorDoc, nombre: comp.receptorNombre, condicionFiscal: comp.receptorCondicion },
      detalle: comp.detalle as any[],
    };
    const provider = await this.getProvider();
    const output = await provider.emitirComprobante(input);
    return output.pdfBuffer;
  }

  async anular(id: string, userId: string) {
    const comp = await this.prisma.comprobante.findUniqueOrThrow({ where: { id } });
    if (comp.cae) { const p = await this.getProvider(); await p.anularComprobante(comp.cae); }
    const updated = await this.prisma.comprobante.update({ where: { id }, data: { estado: EstadoComprobante.ANULADO } });
    await this.audit.log(userId, 'COMPROBANTE_ANULADO', 'COMPROBANTE', id);
    return updated;
  }

  async emitirBatch(month: number, year: number, userId: string) {
    // Find payments without comprobantes for that month
    const payments = await this.prisma.paymentPeriod.findMany({
      where: { year, month },
      include: { client: true, subscription: true },
    });

    let exitosos = 0, errores = 0;
    const detalleErrores: any[] = [];

    for (const pp of payments) {
      const existing = await this.prisma.comprobante.findFirst({ where: { paymentPeriodId: pp.id } });
      if (existing) continue;
      try {
        await this.emitirComprobanteParaPago(pp.clientId, pp.subscriptionId || '', pp.id, userId);
        exitosos++;
      } catch (err: any) {
        errores++;
        detalleErrores.push({ paymentId: pp.id, error: err.message });
      }
    }
    return { procesados: exitosos + errores, exitosos, errores, detalleErrores };
  }

  // ── Datos fiscales cliente ───────────────────────────────

  async updateClientFiscal(userId: string, clientId: string, data: any) {
    const updated = await this.prisma.client.update({
      where: { id: clientId },
      data: {
        tipoDocumento: data.tipoDocumento,
        numeroDocFiscal: data.numeroDocumento,
        condicionFiscal: data.condicionFiscal,
        razonSocial: data.razonSocial,
        telefono: data.telefono,
        email: data.email,
      },
      select: { id: true, tipoDocumento: true, numeroDocFiscal: true, condicionFiscal: true, razonSocial: true, telefono: true, email: true },
    });
    await this.audit.log(userId, 'CLIENT_FISCAL_UPDATED', 'CLIENT', clientId, data);
    return updated;
  }
}
