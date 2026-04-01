import { useState } from 'react';
import { Modal, Form, Input, Checkbox, DatePicker, Space, message } from 'antd';
import dayjs from 'dayjs';
import { clientsApi, getErrorMessage } from '../../../services/api';
import type { ServiceType } from '../../../types';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateClientModal({ open, onClose, onCreated }: Props) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState<ServiceType[]>(['CABLE']);

  const handleFinish = async (values: any) => {
    if (services.length === 0) {
      message.error('Selecciona al menos un servicio');
      return;
    }
    try {
      setLoading(true);
      await clientsApi.create({
        nombreOriginal: values.nombreOriginal,
        codigoOriginal: values.codigoOriginal || undefined,
        calle: values.calle || undefined,
        subscriptions: services.map((tipo) => ({
          tipo,
          fechaAlta: (values[`fechaAlta_${tipo}`] as dayjs.Dayjs).format('YYYY-MM-DD'),
        })),
      });
      message.success('Cliente dado de alta correctamente');
      form.resetFields();
      setServices(['CABLE']);
      onCreated();
      onClose();
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Nuevo cliente" open={open} onCancel={onClose} footer={null} destroyOnClose>
      <Form form={form} onFinish={handleFinish} layout="vertical">
        <Form.Item name="nombreOriginal" label="Nombre completo" rules={[{ required: true }]}>
          <Input autoFocus />
        </Form.Item>
        <Form.Item name="codigoOriginal" label="Código (opcional)">
          <Input />
        </Form.Item>
        <Form.Item name="calle" label="Calle / Dirección">
          <Input />
        </Form.Item>

        <Form.Item label="Servicios" required>
          <Checkbox.Group
            value={services}
            onChange={(v) => setServices(v as ServiceType[])}
            options={[
              { label: 'Cable', value: 'CABLE' },
              { label: 'Internet', value: 'INTERNET' },
            ]}
          />
        </Form.Item>

        {services.map((tipo) => (
          <Form.Item
            key={tipo}
            name={`fechaAlta_${tipo}`}
            label={`Fecha de alta — ${tipo}`}
            rules={[{ required: true, message: 'Fecha requerida' }]}
          >
            <DatePicker
              style={{ width: '100%' }}
              disabledDate={(d) => d.isAfter(dayjs())}
              format="DD/MM/YYYY"
            />
          </Form.Item>
        ))}

        <Form.Item>
          <Space>
            <button type="submit" className="ant-btn ant-btn-primary" disabled={loading}>
              {loading ? 'Creando...' : 'Dar de alta'}
            </button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
}
