import { useEffect, useState, useCallback } from 'react';
import { Card, Table, Tag, Typography, Button, Modal, Form, Input, Select, Row, Col, Statistic, message } from 'antd';
import { PlusOutlined, ToolOutlined } from '@ant-design/icons';
import { equipmentApi, getErrorMessage } from '../../services/api';

const STATUS_COLORS: Record<string, string> = { EN_DEPOSITO: 'green', ASIGNADO: 'blue', EN_REPARACION: 'orange', DE_BAJA: 'default' };
const TIPO_OPTIONS = ['MODEM', 'DECODIFICADOR', 'ROUTER', 'MATERIAL'];

export default function EquipmentPage() {
  const [equipment, setEquipment] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    try { setLoading(true); const [eq, st] = await Promise.all([equipmentApi.getAll(), equipmentApi.getStats()]); setEquipment(eq); setStats(st); }
    catch (err) { message.error(getErrorMessage(err)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (values: any) => {
    try { await equipmentApi.create(values); message.success('Equipo creado'); setModalOpen(false); form.resetFields(); load(); }
    catch (err) { message.error(getErrorMessage(err)); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}><ToolOutlined /> Equipos</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>Nuevo equipo</Button>
      </div>

      {stats && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={6}><Card size="small"><Statistic title="Total" value={stats.totalEquipos} /></Card></Col>
          <Col xs={12} sm={6}><Card size="small"><Statistic title="En depósito" value={stats.porEstado.enDeposito} valueStyle={{ color: '#52c41a' }} /></Card></Col>
          <Col xs={12} sm={6}><Card size="small"><Statistic title="Asignados" value={stats.porEstado.asignados} valueStyle={{ color: '#1677ff' }} /></Card></Col>
          <Col xs={12} sm={6}><Card size="small"><Statistic title="En reparación" value={stats.porEstado.enReparacion} valueStyle={{ color: '#faad14' }} /></Card></Col>
        </Row>
      )}

      <Card>
        <Table dataSource={equipment} rowKey="id" loading={loading} pagination={{ pageSize: 20 }} columns={[
          { title: 'N° Serie', dataIndex: 'numeroSerie', render: (v: string) => v || '—' },
          { title: 'Tipo', dataIndex: 'tipo', width: 130, render: (t: string) => <Tag>{t}</Tag> },
          { title: 'Marca/Modelo', render: (_: any, r: any) => `${r.marca || ''} ${r.modelo || ''}`.trim() || '—' },
          { title: 'Estado', dataIndex: 'estado', width: 130, render: (e: string) => <Tag color={STATUS_COLORS[e]}>{e.replace('_', ' ')}</Tag> },
          { title: 'Cliente', render: (_: any, r: any) => r.assignments?.[0]?.client?.nombreNormalizado || '—' },
        ]} />
      </Card>

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
    </div>
  );
}
