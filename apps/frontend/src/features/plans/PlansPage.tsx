import { useEffect, useState, useCallback } from 'react';
import { Card, Table, Tag, Typography, Button, Modal, Form, Input, InputNumber, Select, Switch, message } from 'antd';
import { PlusOutlined, DollarOutlined } from '@ant-design/icons';
import { plansApi, getErrorMessage } from '../../services/api';
import type { ServicePlan } from '../../types';

export default function PlansPage() {
  const [plans, setPlans] = useState<ServicePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    try { setLoading(true); setPlans(await plansApi.getAll()); }
    catch (err) { message.error(getErrorMessage(err)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (values: any) => {
    try {
      await plansApi.create(values);
      message.success('Plan creado');
      setModalOpen(false); form.resetFields(); load();
    } catch (err) { message.error(getErrorMessage(err)); }
  };

  const handleUpdate = async (id: string, data: Partial<ServicePlan>) => {
    try { await plansApi.update(id, data); message.success('Plan actualizado'); load(); }
    catch (err) { message.error(getErrorMessage(err)); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}><DollarOutlined /> Planes de Servicio</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>Nuevo plan</Button>
      </div>

      <Card>
        <Table dataSource={plans} rowKey="id" loading={loading} pagination={false} scroll={{ x: 700 }} columns={[
          { title: 'Nombre', dataIndex: 'nombre', ellipsis: true },
          { title: 'Tipo', dataIndex: 'tipo', width: 100, render: (t: string) => <Tag color={t === 'CABLE' ? 'blue' : 'green'}>{t}</Tag> },
          { title: 'Precio', dataIndex: 'precio', width: 120, render: (p: number) => p > 0 ? `$${Number(p).toLocaleString()}` : <Tag color="orange">Sin precio</Tag> },
          { title: 'Suscripciones', width: 120, render: (_: unknown, r: ServicePlan) => r._count?.subscriptions ?? 0 },
          { title: 'Activo', dataIndex: 'activo', width: 80, render: (v: boolean, r: ServicePlan) => (
            <Switch checked={v} size="small" onChange={(checked) => handleUpdate(r.id, { activo: checked })} />
          )},
          { title: 'Editar precio', width: 140, render: (_: unknown, r: ServicePlan) => (
            <InputNumber size="small" value={Number(r.precio)} min={0} step={1000} style={{ width: 120 }}
              onBlur={(e) => { const v = Number(e.target.value); if (!isNaN(v) && v !== Number(r.precio)) { message.loading('Guardando...', 1); handleUpdate(r.id, { precio: v }); } }} />
          )},
        ]} />
      </Card>

      <Modal title="Nuevo plan" open={modalOpen} onCancel={() => { setModalOpen(false); form.resetFields(); }} footer={null} destroyOnClose>
        <Form form={form} onFinish={handleCreate} layout="vertical">
          <Form.Item name="nombre" label="Nombre" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="tipo" label="Tipo" rules={[{ required: true }]}>
            <Select options={[{ value: 'CABLE', label: 'Cable' }, { value: 'INTERNET', label: 'Internet' }]} />
          </Form.Item>
          <Form.Item name="precio" label="Precio" rules={[{ required: true }]}><InputNumber min={0} step={1000} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="descripcion" label="Descripción"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item><Button type="primary" htmlType="submit">Crear</Button></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
