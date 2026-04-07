import { useState, useEffect } from 'react';
import { Space, Typography, Button, Spin, Select, Input, Tag, List, message } from 'antd';
import dayjs from 'dayjs';
import { ticketsApi, getErrorMessage } from '../../../../../services/api';
import { useAuth } from '../../../../../context/AuthContext';
import type { Ticket } from '../../../../../types';

interface TicketsTabProps {
  clientId: string;
  estado: string;
}

export default function TicketsTab({ clientId, estado }: TicketsTabProps) {
  const { hasRole } = useAuth();
  const canOperate = hasRole('ADMIN', 'OPERADOR');

  const [clientTickets, setClientTickets] = useState<Ticket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [newTicketTipo, setNewTicketTipo] = useState('');
  const [newTicketDesc, setNewTicketDesc] = useState('');

  const loadTickets = async () => {
    setTicketsLoading(true);
    try { setClientTickets(await ticketsApi.getClientTickets(clientId)); }
    catch { /* */ }
    finally { setTicketsLoading(false); }
  };

  useEffect(() => { loadTickets(); }, [clientId]);

  return (
    <Spin spinning={ticketsLoading}>
      {canOperate && estado === 'ACTIVO' && (
        <Space.Compact style={{ width: '100%', marginBottom: 12 }}>
          <Select placeholder="Tipo" size="small" style={{ width: 150 }} value={newTicketTipo || undefined} onChange={setNewTicketTipo}
            options={[
              { value: 'SIN_SENIAL', label: 'Sin señal' },
              { value: 'LENTITUD_INTERNET', label: 'Lentitud' },
              { value: 'RECONEXION', label: 'Reconexión' },
              { value: 'INSTALACION', label: 'Instalación' },
              { value: 'CAMBIO_EQUIPO', label: 'Cambio equipo' },
              { value: 'OTRO', label: 'Otro' },
            ]} />
          <Input size="small" placeholder="Descripción" value={newTicketDesc} onChange={(e) => setNewTicketDesc(e.target.value)} />
          <Button type="primary" size="small" disabled={!newTicketTipo} onClick={async () => {
            try { await ticketsApi.create(clientId, newTicketTipo, newTicketDesc || undefined); message.success('Creado'); setNewTicketTipo(''); setNewTicketDesc(''); loadTickets(); }
            catch (err) { message.error(getErrorMessage(err)); }
          }}>Crear</Button>
        </Space.Compact>
      )}
      {clientTickets.length > 0 ? (
        <List size="small" dataSource={clientTickets} renderItem={(t) => (
          <List.Item>
            <Space size={4}>
              <Tag color={t.estado === 'ABIERTO' ? 'red' : 'green'}>{t.estado}</Tag>
              <Tag>{t.tipo.replace(/_/g, ' ')}</Tag>
              <span style={{ fontSize: 12 }}>{t.descripcion || '—'}</span>
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>{dayjs(t.createdAt).fromNow()}</Typography.Text>
            </Space>
          </List.Item>
        )} />
      ) : !ticketsLoading && <Typography.Text type="secondary">Sin tickets.</Typography.Text>}
    </Spin>
  );
}
