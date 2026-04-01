import { useEffect, useState, useCallback } from 'react';
import {
  Card, Table, Typography, Button, Modal, Form, Input, Select, Switch, Space, message,
} from 'antd';
import { PlusOutlined, UserOutlined } from '@ant-design/icons';
import { usersApi, getErrorMessage } from '../services/api';
import type { User, UserRole } from '../types';

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setUsers(await usersApi.getAll());
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (values: { name: string; email: string; password: string; role: UserRole }) => {
    try {
      setCreating(true);
      await usersApi.create(values);
      message.success('Usuario creado');
      setModalOpen(false);
      form.resetFields();
      load();
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async (id: string, data: { name?: string; role?: UserRole; isActive?: boolean }) => {
    try {
      await usersApi.update(id, data);
      message.success('Usuario actualizado');
      load();
    } catch (err) {
      message.error(getErrorMessage(err));
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          <UserOutlined /> Usuarios
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          Nuevo usuario
        </Button>
      </div>

      <Card>
        <Table
          dataSource={users}
          rowKey="id"
          loading={loading}
          pagination={false}
          columns={[
            { title: 'Nombre', dataIndex: 'name' },
            { title: 'Email', dataIndex: 'email' },
            {
              title: 'Rol', dataIndex: 'role', width: 160,
              render: (role: UserRole, record: User) => (
                <Select
                  value={role} size="small" style={{ width: 140 }}
                  onChange={(v) => handleUpdate(record.id, { role: v })}
                  options={[
                    { value: 'ADMIN', label: 'Admin' },
                    { value: 'OPERADOR', label: 'Operador' },
                    { value: 'VISOR', label: 'Visor' },
                  ]}
                />
              ),
            },
            {
              title: 'Activo', dataIndex: 'isActive', width: 80,
              render: (isActive: boolean, record: User) => (
                <Switch checked={isActive} size="small" onChange={() => handleUpdate(record.id, { isActive: !isActive })} />
              ),
            },
            {
              title: 'Creado', dataIndex: 'createdAt', width: 120,
              render: (d: string) => d ? new Date(d).toLocaleDateString('es-AR') : '',
            },
          ]}
        />
      </Card>

      <Modal
        title="Nuevo usuario" open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
        footer={null} destroyOnClose
      >
        <Form form={form} onFinish={handleCreate} layout="vertical">
          <Form.Item name="name" label="Nombre" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true }, { type: 'email' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true, min: 4 }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="role" label="Rol" initialValue="OPERADOR">
            <Select options={[
              { value: 'ADMIN', label: 'Admin' },
              { value: 'OPERADOR', label: 'Operador' },
              { value: 'VISOR', label: 'Visor' },
            ]} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={creating}>Crear</Button>
              <Button onClick={() => { setModalOpen(false); form.resetFields(); }}>Cancelar</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
