import { useState, useEffect } from 'react';
import { Space, Typography, Button, Spin, Select, Tag, List, Modal, message } from 'antd';
import { promotionsApi, getErrorMessage } from '../../../../../services/api';
import { useAuth } from '../../../../../context/AuthContext';
import type { Promotion, SubscriptionDebt } from '../../../../../types';

/** The API returns ClientPromotion join records with nested promotion data */
interface ClientPromoRecord {
  id: string;
  subscriptionId: string;
  promotion?: Promotion;
  tipo?: string;
  nombre?: string;
}

interface PromosTabProps {
  clientId: string;
  estado: string;
  activeSubs: SubscriptionDebt[];
}

export default function PromosTab({ clientId, estado, activeSubs }: PromosTabProps) {
  const { hasRole } = useAuth();
  const canOperate = hasRole('ADMIN', 'OPERADOR');
  const isAdmin = hasRole('ADMIN');

  const [promos, setPromos] = useState<ClientPromoRecord[]>([]);
  const [availablePromos, setAvailablePromos] = useState<Promotion[]>([]);
  const [promosLoading, setPromosLoading] = useState(false);
  const [selectedPromoId, setSelectedPromoId] = useState('');
  const [selectedPromoSubId, setSelectedPromoSubId] = useState('');

  const loadPromos = async () => {
    setPromosLoading(true);
    try {
      const [a, all] = await Promise.all([
        promotionsApi.getClientPromos(clientId) as unknown as Promise<ClientPromoRecord[]>,
        promotionsApi.getAll({ scope: 'CLIENTE', activa: 'true' }),
      ]);
      setPromos(a);
      setAvailablePromos(all);
    } catch { /* */ }
    finally { setPromosLoading(false); }
  };

  useEffect(() => { loadPromos(); }, [clientId]);

  return (
    <Spin spinning={promosLoading}>
      {canOperate && estado === 'ACTIVO' && activeSubs.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          {availablePromos.length > 0 ? (
            <Space wrap size={4}>
              <Select placeholder="Suscripción" size="small" style={{ width: 120 }} value={selectedPromoSubId || undefined} onChange={setSelectedPromoSubId}
                options={activeSubs.map((s) => ({ value: s.subscriptionId, label: s.tipo }))} />
              <Select placeholder="Promoción" size="small" style={{ width: 220 }} value={selectedPromoId || undefined} onChange={setSelectedPromoId}
                options={availablePromos.map((p) => ({ value: p.id, label: `${p.nombre} (${p.tipo}${p.tipo === 'PORCENTAJE' ? ' ' + p.valor + '%' : p.tipo === 'MESES_GRATIS' ? '' : ' $' + p.valor})` }))} />
              <Button type="primary" size="small" disabled={!selectedPromoId || !selectedPromoSubId} onClick={async () => {
                try { await promotionsApi.assignToSub(clientId, selectedPromoSubId, selectedPromoId); message.success('Asignada'); setSelectedPromoId(''); setSelectedPromoSubId(''); loadPromos(); }
                catch (err) { message.error(getErrorMessage(err)); }
              }}>Asignar</Button>
            </Space>
          ) : <Typography.Text type="secondary" style={{ fontSize: 12 }}>No hay promos CLIENTE activas.</Typography.Text>}
        </div>
      )}
      {promos.length > 0 ? (
        <List size="small" dataSource={promos} renderItem={(p) => (
          <List.Item actions={isAdmin ? [
            <Button key="remove" type="link" danger size="small" onClick={() => Modal.confirm({
              title: '¿Quitar esta promoción?', okText: 'Quitar', okType: 'danger',
              onOk: async () => {
                try { await promotionsApi.removeFromSub(clientId, p.subscriptionId, p.id); message.success('Removida'); loadPromos(); }
                catch (err) { message.error(getErrorMessage(err)); }
              },
            })}>Quitar</Button>,
          ] : undefined}>
            <Space size={4}>
              <Tag color="purple">{p.promotion?.tipo || p.tipo}</Tag>
              <span style={{ fontSize: 12 }}>{p.promotion?.nombre || p.nombre}</span>
            </Space>
          </List.Item>
        )} />
      ) : !promosLoading && <Typography.Text type="secondary">Sin promociones.</Typography.Text>}
    </Spin>
  );
}
