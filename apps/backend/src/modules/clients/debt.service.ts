import { Injectable } from '@nestjs/common';
import { ClientStatus, ServiceType } from '@prisma/client';
import dayjs from 'dayjs';
import { esMesCubiertoXPromo, type PromoData } from '../../common/utils/promotion-calculator.util';

export interface SubscriptionDebt {
  subscriptionId: string;
  tipo: ServiceType;
  fechaAlta: Date;
  mesesObligatorios: string[];
  mesesPagados: string[];
  mesesAdeudados: string[];
  mesesConPromoGratis: string[];
  cantidadDeuda: number;
  requiereCorte: boolean;
}

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
  subscriptions: SubscriptionDebt[];
  requiereCorteCable: boolean;
  requiereCorteInternet: boolean;
  deudaCable: number;
  deudaInternet: number;
}

@Injectable()
export class DebtService {
  /**
   * Calcula deuda de una suscripción individual.
   * Algoritmo: ver docs/REGLAS-NEGOCIO.md
   */
  calculateSubDebt(
    subId: string,
    tipo: ServiceType,
    estado: ClientStatus,
    fechaAlta: Date,
    paidPeriods: Array<{ year: number; month: number }>,
    promosGratis: PromoData[] = [],
  ): SubscriptionDebt {
    const result: SubscriptionDebt = {
      subscriptionId: subId, tipo, fechaAlta,
      mesesObligatorios: [], mesesPagados: [], mesesAdeudados: [], mesesConPromoGratis: [],
      cantidadDeuda: 0, requiereCorte: false,
    };

    if (estado !== ClientStatus.ACTIVO) return result;

    const now = dayjs();
    const alta = dayjs(fechaAlta).startOf('month');
    let endMonth = now.startOf('month');
    if (now.date() <= 15) endMonth = endMonth.subtract(1, 'month');

    const paidSet = new Set(
      paidPeriods.map((p) => `${p.year}-${String(p.month).padStart(2, '0')}`),
    );

    let current = alta;
    while (current.isBefore(endMonth, 'month') || current.isSame(endMonth, 'month')) {
      const m = current.format('YYYY-MM');
      result.mesesObligatorios.push(m);
      if (esMesCubiertoXPromo(current.year(), current.month() + 1, promosGratis)) {
        result.mesesConPromoGratis.push(m);
      }
      current = current.add(1, 'month');
    }

    const cubiertosSet = new Set([
      ...paidPeriods.map((p) => `${p.year}-${String(p.month).padStart(2, '0')}`),
      ...result.mesesConPromoGratis,
    ]);

    result.mesesPagados = result.mesesObligatorios.filter((m) => paidSet.has(m));

    let debtStartMonth: dayjs.Dayjs;
    const allCubiertos = result.mesesObligatorios.filter((m) => cubiertosSet.has(m));
    if (allCubiertos.length > 0) {
      debtStartMonth = dayjs(allCubiertos[allCubiertos.length - 1] + '-01').add(1, 'month');
    } else {
      debtStartMonth = alta;
    }

    result.mesesAdeudados = result.mesesObligatorios.filter((m) => {
      const monthDate = dayjs(m + '-01');
      return !cubiertosSet.has(m) && (monthDate.isAfter(debtStartMonth, 'month') || monthDate.isSame(debtStartMonth, 'month'));
    });

    result.cantidadDeuda = result.mesesAdeudados.length;
    result.requiereCorte = result.cantidadDeuda > 1;
    return result;
  }

  /**
   * Calcula deuda agregada de un cliente con todas sus suscripciones.
   */
  calculateClientDebt(
    clientId: string,
    codCli: string,
    nombreNormalizado: string,
    estado: ClientStatus,
    fechaAlta: Date | null,
    calle: string | null,
    subscriptions: Array<{
      id: string;
      tipo: ServiceType;
      fechaAlta: Date;
      estado: ClientStatus;
      paymentPeriods: Array<{ year: number; month: number }>;
      plan?: { promotions?: Array<{ id: string; nombre: string; tipo: string; valor: any; fechaInicio: Date; fechaFin: Date }> } | null;
      clientPromotions?: Array<{ promotion: { id: string; nombre: string; tipo: string; valor: any; fechaInicio: Date; fechaFin: Date } }>;
    }>,
  ): ClientDebtInfo {
    const subDebts: SubscriptionDebt[] = subscriptions.map((sub) => {
      const promosGratis: PromoData[] = [
        ...(sub.plan?.promotions || [])
          .filter((p) => p.tipo === 'MESES_GRATIS')
          .map((p) => ({ id: p.id, nombre: p.nombre, tipo: p.tipo as any, valor: Number(p.valor), fechaInicio: p.fechaInicio, fechaFin: p.fechaFin })),
        ...(sub.clientPromotions || [])
          .filter((cp) => cp.promotion.tipo === 'MESES_GRATIS')
          .map((cp) => ({ id: cp.promotion.id, nombre: cp.promotion.nombre, tipo: cp.promotion.tipo as any, valor: Number(cp.promotion.valor), fechaInicio: cp.promotion.fechaInicio, fechaFin: cp.promotion.fechaFin })),
      ];
      return this.calculateSubDebt(sub.id, sub.tipo, sub.estado, sub.fechaAlta, sub.paymentPeriods, promosGratis);
    });

    const cableDebt = subDebts.find((s) => s.tipo === ServiceType.CABLE);
    const internetDebt = subDebts.find((s) => s.tipo === ServiceType.INTERNET);

    const allObligatorios = [...new Set(subDebts.flatMap((s) => s.mesesObligatorios))].sort();
    const allPagados = [...new Set(subDebts.flatMap((s) => s.mesesPagados))].sort();
    const allAdeudados = [...new Set(subDebts.flatMap((s) => s.mesesAdeudados))].sort();
    const maxDeuda = Math.max(0, ...subDebts.map((s) => s.cantidadDeuda));

    return {
      clientId, codCli, nombreNormalizado, estado, fechaAlta, calle,
      mesesObligatorios: allObligatorios,
      mesesPagados: allPagados,
      mesesAdeudados: allAdeudados,
      cantidadDeuda: maxDeuda,
      requiereCorte: subDebts.some((s) => s.requiereCorte),
      subscriptions: subDebts,
      requiereCorteCable: cableDebt?.requiereCorte ?? false,
      requiereCorteInternet: internetDebt?.requiereCorte ?? false,
      deudaCable: cableDebt?.cantidadDeuda ?? 0,
      deudaInternet: internetDebt?.cantidadDeuda ?? 0,
    };
  }
}
