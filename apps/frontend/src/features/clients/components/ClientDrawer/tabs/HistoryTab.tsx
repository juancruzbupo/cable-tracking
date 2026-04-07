import { useState, useEffect } from 'react';
import { Typography, Spin, Timeline } from 'antd';
import dayjs from 'dayjs';
import { clientsApi } from '../../../../../services/api';
import type { AuditLogEntry } from '../../../../../types';

const ACTION_LABELS: Record<string, string> = {
  CLIENT_CREATED: 'Alta', CLIENT_DEACTIVATED: 'Baja', CLIENT_REACTIVATED: 'Reactivado',
  SUBSCRIPTION_DEACTIVATED: 'Servicio cancelado', SUBSCRIPTION_REACTIVATED: 'Servicio reactivado',
  SUBSCRIPTION_FECHA_ALTA_UPDATED: 'Fecha alta modificada', SUBSCRIPTION_PLAN_UPDATED: 'Plan actualizado',
  PAYMENT_MANUAL_CREATED: 'Pago registrado', PAYMENT_MANUAL_DELETED: 'Pago eliminado',
  NOTE_CREATED: 'Nota agregada', NOTE_DELETED: 'Nota eliminada',
  PROMOTION_ASSIGNED: 'Promo asignada', PROMOTION_REMOVED: 'Promo removida',
  EQUIPMENT_ASSIGNED: 'Equipo asignado', EQUIPMENT_RETIRED: 'Equipo retirado',
  TICKET_CREATED: 'Ticket creado', TICKET_RESOLVED: 'Ticket resuelto',
  WHATSAPP_SENT: 'WhatsApp enviado', CLIENT_FISCAL_UPDATED: 'Datos fiscales actualizados',
};

interface HistoryTabProps {
  clientId: string;
}

export default function HistoryTab({ clientId }: HistoryTabProps) {
  const [history, setHistory] = useState<AuditLogEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try { setHistory(await clientsApi.getHistory(clientId)); }
    catch { /* */ }
    finally { setHistoryLoading(false); }
  };

  useEffect(() => { loadHistory(); }, [clientId]);

  return (
    <Spin spinning={historyLoading}>
      {history.length > 0 ? (
        <Timeline items={history.map((h) => ({
          key: h.id,
          children: (
            <div>
              <Typography.Text strong style={{ fontSize: 12 }}>{ACTION_LABELS[h.action] || h.action}</Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 11, marginLeft: 6 }}>{h.user.name} — {dayjs(h.createdAt).fromNow()}</Typography.Text>
            </div>
          ),
        }))} />
      ) : !historyLoading && <Typography.Text type="secondary">Sin historial.</Typography.Text>}
    </Spin>
  );
}
