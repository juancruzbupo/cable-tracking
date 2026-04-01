import { useEffect, useState } from 'react';
import { Card, Typography, Form, Input, InputNumber, Select, Button, Tag, Spin, message } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import { fiscalApi, getErrorMessage } from '../../services/api';

export default function FiscalConfigPage() {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [form] = Form.useForm();

  useEffect(() => {
    fiscalApi.getConfig().then((d) => { setConfig(d); form.setFieldsValue(d); }).catch(console.error).finally(() => setLoading(false));
  }, [form]);

  const handleSave = async (values: any) => {
    try {
      const updated = await fiscalApi.updateConfig(values);
      setConfig(updated);
      message.success('Configuración actualizada');
    } catch (err) { message.error(getErrorMessage(err)); }
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '60px auto' }} />;

  return (
    <div>
      <Typography.Title level={3}><SettingOutlined /> Configuración Fiscal</Typography.Title>
      <Tag color={config?.providerName === 'mock' ? 'orange' : 'green'} style={{ marginBottom: 16, fontSize: 13, padding: '4px 12px' }}>
        {config?.providerName === 'mock' ? 'Modo: INTERNO (sin valor fiscal)' : `Modo: ${config?.providerName} conectado`}
      </Tag>

      <Card title="Datos de la empresa">
        <Form form={form} onFinish={handleSave} layout="vertical" style={{ maxWidth: 500 }}>
          <Form.Item name="cuit" label="CUIT"><Input /></Form.Item>
          <Form.Item name="razonSocial" label="Razón Social"><Input /></Form.Item>
          <Form.Item name="condicionFiscal" label="Condición Fiscal">
            <Select options={[
              { value: 'Responsable Inscripto', label: 'Responsable Inscripto' },
              { value: 'Monotributista', label: 'Monotributista' },
            ]} />
          </Form.Item>
          <Form.Item name="domicilioFiscal" label="Domicilio Fiscal"><Input /></Form.Item>
          <Form.Item name="ingresosBrutos" label="Ingresos Brutos"><Input /></Form.Item>
          <Form.Item name="puntoVenta" label="Punto de Venta"><InputNumber min={1} /></Form.Item>
          <Form.Item name="providerName" label="Proveedor Fiscal">
            <Select options={[
              { value: 'mock', label: 'Mock (interno)' },
              { value: 'tusFacturas', label: 'TusFacturas' },
              { value: 'facturapi', label: 'FacturAPI' },
            ]} />
          </Form.Item>
          <Button type="primary" htmlType="submit">Guardar</Button>
        </Form>
      </Card>
    </div>
  );
}
