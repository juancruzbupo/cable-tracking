import { useEffect, useState, useCallback } from 'react';
import { Card, Table, Tag, Typography, Button, Modal, Input, Row, Col, Statistic, Tabs, message, Form, Select, Spin } from 'antd';
import { ExclamationCircleOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/es';
import { useNavigate } from 'react-router-dom';
import { ticketsApi, clientsApi, getErrorMessage } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

dayjs.extend(relativeTime);
dayjs.locale('es');

const TIPO_COLORS: Record<string, string> = { SIN_SENIAL: 'red', LENTITUD_INTERNET: 'orange', RECONEXION: 'blue', INSTALACION: 'green', CAMBIO_EQUIPO: 'purple', OTRO: 'default' };
const TIPO_LABELS: Record<string, string> = { SIN_SENIAL: 'Sin señal', LENTITUD_INTERNET: 'Lentitud internet', RECONEXION: 'Reconexión', INSTALACION: 'Instalación', CAMBIO_EQUIPO: 'Cambio equipo', OTRO: 'Otro' };

export default function TicketsPage() {
  const { hasRole } = useAuth();
  const canOperate = hasRole('ADMIN', 'OPERADOR');
  const navigate = useNavigate();

  const [data, setData] = useState<any>({ data: [], pagination: { total: 0 } });
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('ABIERTO');
  const [tipoFilter, setTipoFilter] = useState<string | undefined>();
  const [resolveId, setResolveId] = useState<string | null>(null);
  const [resolveNotas, setResolveNotas] = useState('');

  // Modal crear ticket
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [clientesOptions, setClientesOptions] = useState<any[]>([]);
  const [buscandoClientes, setBuscandoClientes] = useState(false);
  const [creando, setCreando] = useState(false);

  const load = useCallback(async () => {
    const params: Record<string, string> = {};
    if (tab !== 'TODOS') params.estado = tab;
    if (tipoFilter) params.tipo = tipoFilter;
    try { setLoading(true); const [d, s] = await Promise.all([ticketsApi.getAll(params), ticketsApi.getStats()]); setData(d); setStats(s); }
    catch (err) { message.error(getErrorMessage(err)); }
    finally { setLoading(false); }
  }, [tab, tipoFilter]);

  useEffect(() => { load(); }, [load]);

  const handleResolve = async () => {
    if (!resolveId) return;
    try { await ticketsApi.resolve(resolveId, resolveNotas || undefined); message.success('Ticket resuelto'); setResolveId(null); setResolveNotas(''); load(); }
    catch (err) { message.error(getErrorMessage(err)); }
  };

  const buscarClientes = async (search: string) => {
    if (!search || search.length < 2) return;
    setBuscandoClientes(true);
    try {
      const res = await clientsApi.getAll({ search, estado: 'ACTIVO' as any, limit: 20 });
      setClientesOptions(res.data || []);
    } catch { /* ignore */ }
    finally { setBuscandoClientes(false); }
  };

  const handleCrear = async () => {
    try {
      const values = await form.validateFields();
      setCreando(true);
      await ticketsApi.create(values.clientId, values.tipo, values.descripcion);
      message.success('Ticket creado');
      form.resetFields();
      setClientesOptions([]);
      setModalVisible(false);
      load();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(getErrorMessage(err));
    } finally { setCreando(false); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}><ExclamationCircleOutlined /> Tickets de Soporte</Typography.Title>
        {canOperate && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>Nuevo Ticket</Button>
        )}
      </div>

      {stats && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={8}><Card size="small"><Statistic title="Abiertos" value={stats.abiertos} valueStyle={{ color: '#ff4d4f' }} /></Card></Col>
          <Col xs={12} sm={8}><Card size="small"><Statistic title="Resueltos" value={stats.resueltos} valueStyle={{ color: '#52c41a' }} /></Card></Col>
          <Col xs={12} sm={8}><Card size="small"><Statistic title="Tiempo prom. resolución" value={stats.tiempoPromedioResolucion} suffix="hs" /></Card></Col>
        </Row>
      )}

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
          <Tabs activeKey={tab} onChange={setTab} style={{ marginBottom: 0 }} items={[
            { key: 'ABIERTO', label: `Abiertos (${stats?.abiertos ?? 0})` },
            { key: 'TODOS', label: 'Todos' },
          ]} />
          <Select placeholder="Tipo de problema" value={tipoFilter} onChange={setTipoFilter} allowClear style={{ width: 200, marginBottom: 8 }}
            options={Object.entries(TIPO_LABELS).map(([k, v]) => ({ value: k, label: v }))} />
        </div>
        <Table dataSource={data.data} rowKey="id" loading={loading} pagination={{ total: data.pagination?.total, pageSize: 20 }} scroll={{ x: 800 }} columns={[
          { title: 'Cliente', width: 200, ellipsis: true, render: (_: any, r: any) => {
            if (!r.client) return '—';
            return <a href={`/clients?clientId=${r.client.id}`} onClick={(e) => { e.preventDefault(); navigate(`/clients?clientId=${r.client.id}`); }}>{r.client.nombreNormalizado}</a>;
          }},
          { title: 'Tipo', dataIndex: 'tipo', width: 140, render: (t: string) => <Tag color={TIPO_COLORS[t]}>{TIPO_LABELS[t] || t}</Tag> },
          { title: 'Descripción', dataIndex: 'descripcion', ellipsis: true, render: (v: string) => v || '—' },
          { title: 'Desde hace', dataIndex: 'createdAt', width: 120, render: (d: string) => dayjs(d).fromNow() },
          { title: 'Estado', dataIndex: 'estado', width: 100, render: (e: string) => <Tag color={e === 'ABIERTO' ? 'red' : 'green'}>{e}</Tag> },
          { title: '', width: 80, render: (_: any, r: any) => r.estado === 'ABIERTO' && canOperate && (
            <Button size="small" type="link" onClick={() => setResolveId(r.id)}>Resolver</Button>
          )},
        ]} />
      </Card>

      <Modal title="Resolver ticket" open={!!resolveId} onOk={handleResolve} onCancel={() => setResolveId(null)}>
        <Input.TextArea rows={3} value={resolveNotas} onChange={(e) => setResolveNotas(e.target.value)} placeholder="Notas de resolución (opcional)" />
      </Modal>

      <Modal title="Nuevo Ticket de Soporte" open={modalVisible} onOk={handleCrear} onCancel={() => { form.resetFields(); setClientesOptions([]); setModalVisible(false); }} okText="Crear Ticket" cancelText="Cancelar" confirmLoading={creando}>
        <Form form={form} layout="vertical">
          <Form.Item label="Cliente" name="clientId" rules={[{ required: true, message: 'Seleccioná un cliente' }]}>
            <Select showSearch placeholder="Buscar cliente por nombre..." filterOption={false} onSearch={buscarClientes} loading={buscandoClientes}
              notFoundContent={buscandoClientes ? <Spin size="small" /> : 'Escribí para buscar'}>
              {clientesOptions.map((c: any) => (
                <Select.Option key={c.id} value={c.id}>
                  {c.nombreNormalizado}{c.calle && <span style={{ color: '#8c8c8c', fontSize: 12 }}> — {c.calle}</span>}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="Tipo de problema" name="tipo" rules={[{ required: true, message: 'Seleccioná el tipo' }]}>
            <Select placeholder="Seleccioná el tipo de problema">
              {Object.entries(TIPO_LABELS).map(([k, v]) => <Select.Option key={k} value={k}>{v}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item label="Descripción" name="descripcion">
            <Input.TextArea rows={3} placeholder="Detalle opcional del problema..." maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
