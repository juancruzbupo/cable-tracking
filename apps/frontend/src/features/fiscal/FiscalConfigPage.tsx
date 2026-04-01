import { useEffect, useState } from 'react';
import { Card, Typography, Form, Input, InputNumber, Select, Button, Tag, Spin, Alert, Space, message } from 'antd';
import { SettingOutlined, ApiOutlined } from '@ant-design/icons';
import { fiscalApi, getErrorMessage } from '../../services/api';

export default function FiscalConfigPage() {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [testResult, setTestResult] = useState<{ ok: boolean; mensaje: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [form] = Form.useForm();
  const providerName = Form.useWatch('providerName', form);

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

  const handleTest = async () => {
    setTesting(true); setTestResult(null);
    try {
      setTestResult(await fiscalApi.testConnection());
    } catch { setTestResult({ ok: false, mensaje: 'Error al conectar' }); }
    finally { setTesting(false); }
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '60px auto' }} />;

  return (
    <div>
      <Typography.Title level={3}><SettingOutlined /> Configuración Fiscal</Typography.Title>
      <Tag color={config?.providerName === 'mock' ? 'orange' : 'green'} style={{ marginBottom: 16, fontSize: 13, padding: '4px 12px' }}>
        {config?.providerName === 'mock' ? 'Modo: INTERNO (sin valor fiscal)' : `Modo: ${config?.providerName} conectado`}
      </Tag>

      <Card title="Datos de la empresa" style={{ marginBottom: 16 }}>
        <Form form={form} onFinish={handleSave} layout="vertical" style={{ maxWidth: 500 }} initialValues={config}>
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
          <Button type="primary" htmlType="submit">Guardar</Button>
        </Form>
      </Card>

      <Card title="Proveedor fiscal">
        <Form form={form} onFinish={handleSave} layout="vertical" style={{ maxWidth: 500 }}>
          <Form.Item name="providerName" label="Proveedor">
            <Select options={[
              { value: 'mock', label: 'Interno (sin valor fiscal)' },
              { value: 'tusFacturas', label: 'TusFacturas — Factura electrónica ARCA' },
            ]} />
          </Form.Item>

          {providerName === 'tusFacturas' && (
            <>
              <Alert type="info" style={{ marginBottom: 16 }} message="Obtené las credenciales en tusfacturas.app → Mi espacio de trabajo → Puntos de venta" />
              <Form.Item name="tfUsertoken" label="User Token">
                <Input.Password placeholder={config?.tfUsertokenConfigured ? '••••••••' : 'Ingresá el usertoken'} />
              </Form.Item>
              <Form.Item name="tfApikey" label="API Key">
                <Input.Password placeholder={config?.tfApikeyConfigured ? '••••' : 'Ingresá el apikey'} />
              </Form.Item>
              <Form.Item name="tfApitoken" label="API Token">
                <Input.Password placeholder={config?.tfApitokenConfigured ? '••••••••' : 'Ingresá el apitoken'} />
              </Form.Item>
            </>
          )}

          <Space>
            <Button type="primary" htmlType="submit">Guardar</Button>
            <Button icon={<ApiOutlined />} loading={testing} onClick={handleTest}>Probar conexión</Button>
          </Space>

          {testResult && (
            <Alert type={testResult.ok ? 'success' : 'error'} message={testResult.mensaje} style={{ marginTop: 12 }} />
          )}
        </Form>
      </Card>
    </div>
  );
}
