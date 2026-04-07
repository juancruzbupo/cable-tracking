import { useEffect, useState, useCallback } from 'react';
import { Card, Table, Tag, Typography, Button, Modal, Form, Input, Select, Row, Col, Statistic, Spin, Space, message } from 'antd';
import { PlusOutlined, ToolOutlined, LinkOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { equipmentApi, clientsApi, getErrorMessage } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useDebouncedCallback } from '../../shared/hooks/useDebounce';
import type { Equipment, EquipmentStats, ClientWithDebt } from '../../types';

const STATUS_COLORS: Record<string, string> = { EN_DEPOSITO: 'green', ASIGNADO: 'blue', EN_REPARACION: 'orange', DE_BAJA: 'default' };
const TIPO_OPTIONS = ['MODEM', 'DECODIFICADOR', 'ROUTER', 'MATERIAL'];

export default function EquipmentPage() {
  const { hasRole } = useAuth();
  const navigate = useNavigate();
  const canOperate = hasRole('ADMIN', 'OPERADOR');
  const isAdmin = hasRole('ADMIN');

  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [stats, setStats] = useState<EquipmentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [filterTipo, setFilterTipo] = useState<string | undefined>();
  const [filterEstado, setFilterEstado] = useState<string | undefined>();
  const [filterSearch, setFilterSearch] = useState('');

  // Assign modal
  const [assignModal, setAssignModal] = useState<{ equipId: string; equipLabel: string } | null>(null);
  const [clientOptions, setClientOptions] = useState<ClientWithDebt[]>([]);
  const [clientSearching, setClientSearching] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');

  const load = useCallback(async () => {
    const params: Record<string, string> = {};
    if (filterTipo) params.tipo = filterTipo;
    if (filterEstado) params.estado = filterEstado;
    if (filterSearch) params.search = filterSearch;
    try { setLoading(true); const [eq, st] = await Promise.all([equipmentApi.getAll(params), equipmentApi.getStats()]); setEquipment(eq.data || eq); setStats(st); }
    catch (err) { message.error(getErrorMessage(err)); }
    finally { setLoading(false); }
  }, [filterTipo, filterEstado, filterSearch]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (values: any) => {
    try { await equipmentApi.create(values); message.success('Equipo creado'); setModalOpen(false); form.resetFields(); load(); }
    catch (err) { message.error(getErrorMessage(err)); }
  };

  const searchClients = useDebouncedCallback(async (search: string) => {
    if (!search || search.length < 2) return;
    setClientSearching(true);
    try {
      const res = await clientsApi.getAll({ search, estado: 'ACTIVO', limit: 20 });
      setClientOptions(res.data || []);
    } catch (err) { message.error(getErrorMessage(err)); }
    finally { setClientSearching(false); }
  }, 350);

  const handleAssign = async () => {
    if (!assignModal || !selectedClientId) return;
    try {
      await equipmentApi.assign(selectedClientId, assignModal.equipId);
      message.success('Equipo asignado');
      setAssignModal(null);
      setSelectedClientId('');
      setClientOptions([]);
      load();
    } catch (err) { message.error(getErrorMessage(err)); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}><ToolOutlined /> Equipos</Typography.Title>
        {isAdmin && <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>Nuevo equipo</Button>}
      </div>

      {stats && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={6}><Card size="small"><Statistic title="Total" value={stats.totalEquipos} /></Card></Col>
          <Col xs={12} sm={6}><Card size="small"><Statistic title="En depósito" value={stats.porEstado.enDeposito} valueStyle={{ color: '#52c41a' }} /></Card></Col>
          <Col xs={12} sm={6}><Card size="small"><Statistic title="Asignados" value={stats.porEstado.asignados} valueStyle={{ color: '#1677ff' }} /></Card></Col>
          <Col xs={12} sm={6}><Card size="small"><Statistic title="En reparación" value={stats.porEstado.enReparacion} valueStyle={{ color: '#faad14' }} /></Card></Col>
        </Row>
      )}

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input placeholder="Buscar serie, marca, modelo..." prefix={<SearchOutlined />} value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)} allowClear style={{ width: 240 }} />
          <Select placeholder="Tipo" value={filterTipo} onChange={setFilterTipo} allowClear style={{ width: 160 }}
            options={TIPO_OPTIONS.map((t) => ({ value: t, label: t }))} />
          <Select placeholder="Estado" value={filterEstado} onChange={setFilterEstado} allowClear style={{ width: 160 }}
            options={[{ value: 'EN_DEPOSITO', label: 'En depósito' }, { value: 'ASIGNADO', label: 'Asignado' }, { value: 'EN_REPARACION', label: 'En reparación' }, { value: 'DE_BAJA', label: 'De baja' }]} />
        </Space>
      </Card>

      <Card>
        <Table dataSource={equipment} rowKey="id" loading={loading} pagination={{ pageSize: 20 }} scroll={{ x: 800 }} columns={[
          { title: 'N° Serie', dataIndex: 'numeroSerie', width: 140, render: (v: string) => v || '—' },
          { title: 'Tipo', dataIndex: 'tipo', width: 130, render: (t: string) => <Tag>{t}</Tag> },
          { title: 'Marca/Modelo', width: 180, ellipsis: true, render: (_: any, r: any) => `${r.marca || ''} ${r.modelo || ''}`.trim() || '—' },
          { title: 'Estado', dataIndex: 'estado', width: 130, render: (e: string) => <Tag color={STATUS_COLORS[e]}>{e.replace(/_/g, ' ')}</Tag> },
          { title: 'Cliente', ellipsis: true, render: (_: any, r: any) => {
            const client = r.assignments?.[0]?.client;
            if (!client) return '—';
            return <a href={`/clients?clientId=${client.id}`} onClick={(e) => { e.preventDefault(); navigate(`/clients?clientId=${client.id}`); }}>{client.nombreNormalizado}</a>;
          }},
          ...(canOperate ? [{
            title: '', width: 100,
            render: (_: any, r: any) => r.estado === 'EN_DEPOSITO' ? (
              <Button size="small" type="link" icon={<LinkOutlined />} onClick={() => {
                setAssignModal({ equipId: r.id, equipLabel: `${r.tipo} ${r.marca || ''} ${r.numeroSerie || ''}`.trim() });
              }}>Asignar</Button>
            ) : null,
          }] : []),
        ]} />
      </Card>

      {/* Modal crear equipo */}
      <Modal title="Nuevo equipo" open={modalOpen} onCancel={() => { setModalOpen(false); form.resetFields(); }} footer={null} destroyOnClose>
        <Form form={form} onFinish={handleCreate} layout="vertical">
          <Form.Item name="tipo" label="Tipo" rules={[{ required: true }]}>
            <Select options={TIPO_OPTIONS.map(t => ({ value: t, label: t }))} />
          </Form.Item>
          <Form.Item name="marca" label="Marca"><Input /></Form.Item>
          <Form.Item name="modelo" label="Modelo"><Input /></Form.Item>
          <Form.Item name="numeroSerie" label="Número de serie"><Input /></Form.Item>
          <Form.Item><Button type="primary" htmlType="submit">Crear</Button></Form.Item>
        </Form>
      </Modal>

      {/* Modal asignar equipo a cliente */}
      <Modal title={`Asignar: ${assignModal?.equipLabel || ''}`} open={!!assignModal} onOk={handleAssign} onCancel={() => { setAssignModal(null); setSelectedClientId(''); setClientOptions([]); }}
        okText="Asignar" cancelText="Cancelar" okButtonProps={{ disabled: !selectedClientId }}>
        <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>Buscá el cliente al que querés asignar este equipo:</Typography.Text>
        <Select showSearch placeholder="Buscar cliente por nombre..." filterOption={false}
          onSearch={searchClients} loading={clientSearching} style={{ width: '100%' }}
          value={selectedClientId || undefined} onChange={setSelectedClientId}
          notFoundContent={clientSearching ? <Spin size="small" /> : 'Escribí para buscar'}>
          {clientOptions.map((c: any) => (
            <Select.Option key={c.id} value={c.id}>
              {c.nombreNormalizado}{c.calle && <span style={{ color: '#8c8c8c', fontSize: 12 }}> — {c.calle}</span>}
            </Select.Option>
          ))}
        </Select>
      </Modal>
    </div>
  );
}
