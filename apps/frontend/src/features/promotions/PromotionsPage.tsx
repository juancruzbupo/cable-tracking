import { useEffect, useState, useCallback } from 'react';
import {
  Card, Table, Tag, Typography, Button, Drawer, Form, Input, InputNumber,
  Select, DatePicker, Switch, message, Tabs,
} from 'antd';
import { PlusOutlined, ThunderboltOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { promotionsApi, plansApi, getErrorMessage } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import type { Promotion, ServicePlan, PromoType, PromoScope } from '../../types';

const TYPE_COLORS: Record<PromoType, string> = { MESES_GRATIS: 'green', PORCENTAJE: 'blue', MONTO_FIJO: 'orange', PRECIO_FIJO: 'purple' };
const SCOPE_LABELS: Record<PromoScope, string> = { PLAN: 'Plan', CLIENTE: 'Cliente' };

export default function PromotionsPage() {
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [plans, setPlans] = useState<ServicePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form] = Form.useForm();
  const [scope, setScope] = useState<PromoScope>('PLAN');
  const [tipo, setTipo] = useState<PromoType>('PORCENTAJE');
  const { hasRole } = useAuth();

  const load = useCallback(async () => {
    try { setLoading(true); const [p, pl] = await Promise.all([promotionsApi.getAll(), plansApi.getActive()]); setPromos(p); setPlans(pl); }
    catch (err) { message.error(getErrorMessage(err)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (values: any) => {
    try {
      const [inicio, fin] = values.rango;
      await promotionsApi.create({
        nombre: values.nombre, tipo, scope, valor: values.valor || 0,
        fechaInicio: inicio.format('YYYY-MM-DD'), fechaFin: fin.format('YYYY-MM-DD'),
        descripcion: values.descripcion, planId: values.planId,
      });
      message.success('Promoción creada');
      setDrawerOpen(false); form.resetFields(); load();
    } catch (err) { message.error(getErrorMessage(err)); }
  };

  const today = dayjs();
  const getStatus = (p: Promotion) => {
    if (!p.activa) return <Tag color="red">Inactiva</Tag>;
    if (dayjs(p.fechaFin).isBefore(today)) return <Tag>Vencida</Tag>;
    if (dayjs(p.fechaInicio).isAfter(today)) return <Tag color="blue">Futura</Tag>;
    return <Tag color="green">Vigente</Tag>;
  };

  const filterByTab = (tab: string) => {
    if (tab === 'vigentes') return promos.filter((p) => p.activa && !dayjs(p.fechaFin).isBefore(today) && !dayjs(p.fechaInicio).isAfter(today));
    if (tab === 'por_vencer') return promos.filter((p) => p.activa && dayjs(p.fechaFin).isBefore(today.add(7, 'day')) && !dayjs(p.fechaFin).isBefore(today));
    if (tab === 'vencidas') return promos.filter((p) => dayjs(p.fechaFin).isBefore(today));
    return promos;
  };

  const [tab, setTab] = useState('todas');

  const columns = [
    { title: 'Nombre', dataIndex: 'nombre', ellipsis: true },
    { title: 'Tipo', dataIndex: 'tipo', width: 120, render: (t: PromoType) => <Tag color={TYPE_COLORS[t]}>{t}</Tag> },
    { title: 'Scope', dataIndex: 'scope', width: 90, render: (s: PromoScope) => <Tag>{SCOPE_LABELS[s]}</Tag> },
    { title: 'Plan', width: 140, render: (_: unknown, r: Promotion) => r.plan?.nombre || '—' },
    { title: 'Período', width: 180, render: (_: unknown, r: Promotion) => `${dayjs(r.fechaInicio).format('DD/MM/YY')} → ${dayjs(r.fechaFin).format('DD/MM/YY')}` },
    { title: 'Estado', width: 90, render: (_: unknown, r: Promotion) => getStatus(r) },
    { title: 'Activa', width: 70, render: (_: unknown, r: Promotion) => hasRole('ADMIN') ? (
      <Switch size="small" checked={r.activa} onChange={(v) => promotionsApi.update(r.id, { activa: v }).then(load)} />
    ) : r.activa ? 'Sí' : 'No' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}><ThunderboltOutlined /> Promociones</Typography.Title>
        {hasRole('ADMIN') && <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawerOpen(true)}>Nueva promoción</Button>}
      </div>

      <Card>
        <Tabs activeKey={tab} onChange={setTab} items={[
          { key: 'todas', label: `Todas (${promos.length})` },
          { key: 'vigentes', label: 'Vigentes' },
          { key: 'por_vencer', label: 'Por vencer' },
          { key: 'vencidas', label: 'Vencidas' },
        ]} />
        <Table dataSource={filterByTab(tab)} columns={columns} rowKey="id" loading={loading} pagination={{ pageSize: 20 }} scroll={{ x: 900 }} />
      </Card>

      <Drawer title="Nueva promoción" open={drawerOpen} onClose={() => { setDrawerOpen(false); form.resetFields(); }} width={480} destroyOnClose>
        <Form form={form} onFinish={handleCreate} layout="vertical">
          <Form.Item name="nombre" label="Nombre" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item label="Tipo">
            <Select value={tipo} onChange={setTipo} options={[
              { value: 'PORCENTAJE', label: 'Porcentaje (%)' }, { value: 'MONTO_FIJO', label: 'Monto fijo ($)' },
              { value: 'PRECIO_FIJO', label: 'Precio especial ($)' }, { value: 'MESES_GRATIS', label: 'Meses gratis' },
            ]} />
          </Form.Item>
          {tipo !== 'MESES_GRATIS' && (
            <Form.Item name="valor" label={tipo === 'PORCENTAJE' ? 'Porcentaje (1-100)' : 'Monto ($)'} rules={[{ required: true }]}>
              <InputNumber min={tipo === 'PORCENTAJE' ? 1 : 0} max={tipo === 'PORCENTAJE' ? 100 : undefined} style={{ width: '100%' }} />
            </Form.Item>
          )}
          <Form.Item label="Alcance">
            <Select value={scope} onChange={setScope} options={[
              { value: 'PLAN', label: 'A un plan (automático)' }, { value: 'CLIENTE', label: 'A cliente específico' },
            ]} />
          </Form.Item>
          {scope === 'PLAN' && (
            <Form.Item name="planId" label="Plan" rules={[{ required: true }]}>
              <Select options={plans.map((p) => ({ value: p.id, label: `${p.nombre} (${p.tipo})` }))} />
            </Form.Item>
          )}
          <Form.Item name="rango" label="Período" rules={[{ required: true }]}>
            <DatePicker.RangePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="descripcion" label="Descripción"><Input.TextArea rows={2} /></Form.Item>
          <Button type="primary" htmlType="submit">Crear promoción</Button>
        </Form>
      </Drawer>
    </div>
  );
}
