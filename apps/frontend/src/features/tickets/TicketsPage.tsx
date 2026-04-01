import { useEffect, useState, useCallback } from 'react';
import { Card, Table, Tag, Typography, Button, Modal, Input, Row, Col, Statistic, Tabs, message } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/es';
import { ticketsApi, getErrorMessage } from '../../services/api';

dayjs.extend(relativeTime);
dayjs.locale('es');

const TIPO_COLORS: Record<string, string> = { SIN_SENIAL: 'red', LENTITUD_INTERNET: 'orange', RECONEXION: 'blue', INSTALACION: 'green', CAMBIO_EQUIPO: 'purple', OTRO: 'default' };
const TIPO_LABELS: Record<string, string> = { SIN_SENIAL: 'Sin señal', LENTITUD_INTERNET: 'Lentitud internet', RECONEXION: 'Reconexión', INSTALACION: 'Instalación', CAMBIO_EQUIPO: 'Cambio equipo', OTRO: 'Otro' };

export default function TicketsPage() {
  const [data, setData] = useState<any>({ data: [], pagination: { total: 0 } });
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('ABIERTO');
  const [resolveId, setResolveId] = useState<string | null>(null);
  const [resolveNotas, setResolveNotas] = useState('');

  const load = useCallback(async () => {
    try { setLoading(true); const [d, s] = await Promise.all([ticketsApi.getAll(tab !== 'TODOS' ? { estado: tab } : {}), ticketsApi.getStats()]); setData(d); setStats(s); }
    catch (err) { message.error(getErrorMessage(err)); }
    finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const handleResolve = async () => {
    if (!resolveId) return;
    try { await ticketsApi.resolve(resolveId, resolveNotas || undefined); message.success('Ticket resuelto'); setResolveId(null); setResolveNotas(''); load(); }
    catch (err) { message.error(getErrorMessage(err)); }
  };

  return (
    <div>
      <Typography.Title level={3} style={{ marginBottom: 16 }}><ExclamationCircleOutlined /> Tickets de Soporte</Typography.Title>

      {stats && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={8}><Card size="small"><Statistic title="Abiertos" value={stats.abiertos} valueStyle={{ color: '#ff4d4f' }} /></Card></Col>
          <Col xs={12} sm={8}><Card size="small"><Statistic title="Resueltos" value={stats.resueltos} valueStyle={{ color: '#52c41a' }} /></Card></Col>
          <Col xs={12} sm={8}><Card size="small"><Statistic title="Tiempo prom. resolución" value={stats.tiempoPromedioResolucion} suffix="hs" /></Card></Col>
        </Row>
      )}

      <Card>
        <Tabs activeKey={tab} onChange={setTab} items={[
          { key: 'ABIERTO', label: `Abiertos (${stats?.abiertos ?? 0})` },
          { key: 'TODOS', label: 'Todos' },
        ]} />
        <Table dataSource={data.data} rowKey="id" loading={loading} pagination={{ total: data.pagination?.total, pageSize: 20 }} columns={[
          { title: 'Cliente', render: (_: any, r: any) => r.client?.nombreNormalizado || '—' },
          { title: 'Tipo', dataIndex: 'tipo', width: 140, render: (t: string) => <Tag color={TIPO_COLORS[t]}>{TIPO_LABELS[t] || t}</Tag> },
          { title: 'Descripción', dataIndex: 'descripcion', ellipsis: true, render: (v: string) => v || '—' },
          { title: 'Desde hace', dataIndex: 'createdAt', width: 130, render: (d: string) => dayjs(d).fromNow() },
          { title: 'Estado', dataIndex: 'estado', width: 100, render: (e: string) => <Tag color={e === 'ABIERTO' ? 'red' : 'green'}>{e}</Tag> },
          { title: '', width: 80, render: (_: any, r: any) => r.estado === 'ABIERTO' && (
            <Button size="small" type="link" onClick={() => setResolveId(r.id)}>Resolver</Button>
          )},
        ]} />
      </Card>

      <Modal title="Resolver ticket" open={!!resolveId} onOk={handleResolve} onCancel={() => setResolveId(null)}>
        <Input.TextArea rows={3} value={resolveNotas} onChange={(e) => setResolveNotas(e.target.value)} placeholder="Notas de resolución (opcional)" />
      </Modal>
    </div>
  );
}
