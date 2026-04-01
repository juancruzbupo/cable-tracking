import { Injectable } from '@nestjs/common';
import { ClientStatus, Prisma } from '@prisma/client';
import dayjs from 'dayjs';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface ClientDebtInfo {
  clientId: string;
  codCli: string;
  nombreNormalizado: string;
  estado: ClientStatus;
  fechaAlta: Date | null;
  calle: string | null;
  mesesObligatorios: string[];
  mesesPagados: string[];
  mesesAdeudados: string[];
  cantidadDeuda: number;
  requiereCorte: boolean;
}

export interface ClientDetailResult extends ClientDebtInfo {
  nombreOriginal: string;
  documents: Array<{
    id: string;
    tipo: string;
    fechaDocumento: Date | null;
    numeroDocumento: string | null;
    descripcionOriginal: string | null;
    paymentPeriods: Array<{ year: number; month: number }>;
  }>;
  docPagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ClientListFilters {
  search?: string;
  estado?: ClientStatus;
  debtStatus?: 'AL_DIA' | '1_MES' | '2_MESES' | 'MAS_2_MESES';
  page?: number;
  limit?: number;
}

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lista clientes con filtros y paginación.
   *
   * FIX Fase 4: Cuando se filtra por debtStatus, la paginación se calcula
   * DESPUÉS del filtro en memoria, no antes. Esto corrige el bug donde
   * pagination.total no matcheaba con los resultados mostrados.
   */
  async findAll(filters: ClientListFilters) {
    const { search, estado, debtStatus, page = 1, limit = 20 } = filters;

    const where: Prisma.ClientWhereInput = {};
    if (search) {
      where.OR = [
        { nombreNormalizado: { contains: search.toUpperCase(), mode: 'insensitive' } },
        { codCli: { contains: search } },
      ];
    }
    if (estado) {
      where.estado = estado;
    }

    // ── Sin filtro de deuda: paginación normal en DB ──────────────
    if (!debtStatus) {
      const [clients, total] = await Promise.all([
        this.prisma.client.findMany({
          where,
          orderBy: { nombreNormalizado: 'asc' },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            paymentPeriods: { select: { year: true, month: true } },
          },
        }),
        this.prisma.client.count({ where }),
      ]);

      const data = clients.map((c) => ({
        ...c,
        debtInfo: this.calculateDebt(
          c.id, c.codCli, c.nombreNormalizado, c.estado, c.fechaAlta, c.calle,
          c.paymentPeriods,
        ),
      }));

      return {
        data,
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
      };
    }

    // ── Con filtro de deuda: cargar todos, filtrar, paginar en memoria ──
    const allClients = await this.prisma.client.findMany({
      where,
      orderBy: { nombreNormalizado: 'asc' },
      include: {
        paymentPeriods: { select: { year: true, month: true } },
      },
    });

    const withDebt = allClients.map((c) => ({
      ...c,
      debtInfo: this.calculateDebt(
        c.id, c.codCli, c.nombreNormalizado, c.estado, c.fechaAlta, c.calle,
        c.paymentPeriods,
      ),
    }));

    // Filtrar por debtStatus
    const filtered = withDebt.filter((c) => {
      const d = c.debtInfo.cantidadDeuda;
      switch (debtStatus) {
        case 'AL_DIA': return d === 0;
        case '1_MES': return d === 1;
        case '2_MESES': return d === 2;
        case 'MAS_2_MESES': return d > 2;
        default: return true;
      }
    });

    // Paginar en memoria
    const total = filtered.length;
    const start = (page - 1) * limit;
    const data = filtered.slice(start, start + limit);

    return {
      data,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Detalle completo de un cliente: deuda + documentos.
   *
   * FIX Fase 4: Ahora retorna documentos con sus períodos.
   */
  async findOneWithDebt(
    id: string,
    docPage = 1,
    docLimit = 20,
  ): Promise<ClientDetailResult | null> {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: {
        paymentPeriods: { select: { year: true, month: true } },
      },
    });
    if (!client) return null;

    const [documents, docTotal] = await Promise.all([
      this.prisma.document.findMany({
        where: { clientId: id },
        orderBy: { fechaDocumento: 'desc' },
        skip: (docPage - 1) * docLimit,
        take: docLimit,
        include: {
          paymentPeriods: { select: { year: true, month: true } },
        },
      }),
      this.prisma.document.count({ where: { clientId: id } }),
    ]);

    const debt = this.calculateDebt(
      client.id,
      client.codCli,
      client.nombreNormalizado,
      client.estado,
      client.fechaAlta,
      client.calle,
      client.paymentPeriods,
    );

    return {
      ...debt,
      nombreOriginal: client.nombreOriginal,
      documents: documents.map((d) => ({
        id: d.id,
        tipo: d.tipo,
        fechaDocumento: d.fechaDocumento,
        numeroDocumento: d.numeroDocumento,
        descripcionOriginal: d.descripcionOriginal,
        paymentPeriods: d.paymentPeriods.map((pp) => ({
          year: pp.year,
          month: pp.month,
        })),
      })),
      docPagination: {
        total: docTotal,
        page: docPage,
        limit: docLimit,
        totalPages: Math.ceil(docTotal / docLimit),
      },
    };
  }

  /**
   * ═══════════════════════════════════════════════════════════
   * REGLA CENTRAL DE DEUDA
   * ═══════════════════════════════════════════════════════════
   * La deuda se cuenta desde el último pago realizado:
   *   1. Solo aplica si estado = ACTIVO
   *   2. Si tiene pagos: deuda = meses desde últimoPago+1 hasta hoy
   *      (huecos anteriores al último pago se perdonan)
   *   3. Si NO tiene pagos: deuda = meses desde fechaAlta hasta hoy
   *   4. El mes actual solo cuenta si día > 15
   *
   * Corte = más de 2 meses de deuda
   */
  calculateDebt(
    clientId: string,
    codCli: string,
    nombreNormalizado: string,
    estado: ClientStatus,
    fechaAlta: Date | null,
    calle: string | null,
    paidPeriods: Array<{ year: number; month: number }>,
  ): ClientDebtInfo {
    const result: ClientDebtInfo = {
      clientId,
      codCli,
      nombreNormalizado,
      estado,
      fechaAlta,
      calle,
      mesesObligatorios: [],
      mesesPagados: [],
      mesesAdeudados: [],
      cantidadDeuda: 0,
      requiereCorte: false,
    };

    if (estado !== ClientStatus.ACTIVO || !fechaAlta) {
      return result;
    }

    const now = dayjs();
    const alta = dayjs(fechaAlta).startOf('month');

    // Mes actual solo cuenta si día > 15
    let endMonth = now.startOf('month');
    if (now.date() <= 15) {
      endMonth = endMonth.subtract(1, 'month');
    }

    // Set O(1) de meses pagados
    const paidSet = new Set(
      paidPeriods.map(
        (p) => `${p.year}-${String(p.month).padStart(2, '0')}`,
      ),
    );

    // Determinar inicio de deuda: último pago + 1 mes, o fechaAlta si nunca pagó
    let debtStartMonth: dayjs.Dayjs;

    if (paidPeriods.length > 0) {
      // Buscar el período más reciente pagado
      const lastPaid = paidPeriods.reduce((latest, p) => {
        if (p.year > latest.year || (p.year === latest.year && p.month > latest.month)) {
          return p;
        }
        return latest;
      }, paidPeriods[0]);

      debtStartMonth = dayjs(`${lastPaid.year}-${String(lastPaid.month).padStart(2, '0')}-01`)
        .add(1, 'month');
    } else {
      // Sin pagos: contar desde fecha de alta
      debtStartMonth = alta;
    }

    // Generar meses obligatorios (desde fechaAlta para tener el panorama completo)
    let current = alta;
    while (
      current.isBefore(endMonth, 'month') ||
      current.isSame(endMonth, 'month')
    ) {
      result.mesesObligatorios.push(current.format('YYYY-MM'));
      current = current.add(1, 'month');
    }

    // Meses pagados: todos los que están en el paidSet dentro de los obligatorios
    result.mesesPagados = result.mesesObligatorios.filter((m) =>
      paidSet.has(m),
    );

    // Meses adeudados: solo desde debtStartMonth en adelante (huecos anteriores se perdonan)
    result.mesesAdeudados = result.mesesObligatorios.filter((m) => {
      const monthDate = dayjs(m + '-01');
      return (
        !paidSet.has(m) &&
        (monthDate.isAfter(debtStartMonth, 'month') ||
          monthDate.isSame(debtStartMonth, 'month'))
      );
    });

    result.cantidadDeuda = result.mesesAdeudados.length;
    result.requiereCorte = result.cantidadDeuda > 1;

    return result;
  }

  async getDebtStats() {
    const clients = await this.prisma.client.findMany({
      where: { estado: ClientStatus.ACTIVO },
      include: {
        paymentPeriods: { select: { year: true, month: true } },
      },
    });

    let alDia = 0;
    let unMes = 0;
    let dosMeses = 0;
    let masDosMeses = 0;
    const clientesParaCorte: string[] = [];

    for (const client of clients) {
      const debt = this.calculateDebt(
        client.id,
        client.codCli,
        client.nombreNormalizado,
        client.estado,
        client.fechaAlta,
        client.calle,
        (client as { paymentPeriods: { year: number; month: number }[] }).paymentPeriods,
      );

      if (debt.cantidadDeuda === 0) alDia++;
      else if (debt.cantidadDeuda === 1) unMes++;
      else if (debt.cantidadDeuda === 2) dosMeses++;
      else {
        masDosMeses++;
        clientesParaCorte.push(client.nombreNormalizado);
      }
    }

    const total = clients.length;

    return {
      total,
      alDia,
      unMes,
      dosMeses,
      masDosMeses,
      requierenCorte: clientesParaCorte.length,
      tasaMorosidad:
        total > 0
          ? ((unMes + dosMeses + masDosMeses) / total) * 100
          : 0,
      clientesParaCorte,
    };
  }
}
