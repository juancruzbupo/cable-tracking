import { useState } from 'react';
import {
  Card, Table, Input, Select, Tag, Space, Typography, Tooltip, Button,
  message, Drawer, Spin,
} from 'antd';
import {
  SearchOutlined, WarningOutlined, DownloadOutlined, EyeOutlined, PlusOutlined,
} from '@ant-design/icons';
import { exportApi } from '../../services/api';
import { useClients, useClientDetail } from './hooks/useClients';
import { useAuth } from '../../context/AuthContext';
import CreateClientModal from './components/CreateClientModal';
import ClientDetail from './components/ClientDrawer';
import type { ClientWithDebt, ClientStatus } from '../../types';

export default function ClientsPage() {
  const {
    clients, pagination, loading, search, setSearch,
    estado, setEstado, debtStatus, setDebtStatus, load,
  } = useClients();
  const detail = useClientDetail();
  const { hasRole } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const canExport = hasRole('ADMIN', 'OPERADOR');
  const canCreate = hasRole('ADMIN', 'OPERADOR');

  const handleExport = async () => {
    try {
      setExporting(true);
      await exportApi.downloadClients();
      message.success('Excel descargado');
    } catch {
      message.error('Error al exportar clientes');
    } finally {
      setExporting(false);
    }
  };

  const debtTag = (debt: number, corte: boolean) => {
    if (debt === 0) return <Tag color="green">Al día</Tag>;
    if (debt === 1) return <Tag color="orange">1 mes</Tag>;
    if (debt === 2) return <Tag color="volcano">2 meses</Tag>;
    return (
      <Tag color="red" icon={<WarningOutlined />}>
        {debt} meses{corte ? ' · CORTE' : ''}
      </Tag>
    );
  };

  return (
    <div>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 16,
      }}>
        <Typography.Title level={3} style={{ margin: 0 }}>Clientes</Typography.Title>
        <Space>
          {canCreate && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
              Nuevo cliente
            </Button>
          )}
          {canExport && (
            <Button icon={<DownloadOutlined />} onClick={handleExport} loading={exporting}>
              Exportar Excel
            </Button>
          )}
        </Space>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="Buscar por nombre o código..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 260 }}
            allowClear
          />
          <Select
            placeholder="Estado"
            value={estado}
            onChange={(v) => setEstado(v)}
            allowClear
            style={{ width: 130 }}
            options={[
              { value: 'ACTIVO', label: 'Activo' },
              { value: 'BAJA', label: 'Baja' },
            ]}
          />
          <Select
            placeholder="Deuda"
            value={debtStatus}
            onChange={(v) => setDebtStatus(v)}
            allowClear
            style={{ width: 160 }}
            options={[
              { value: 'AL_DIA', label: 'Al día' },
              { value: '1_MES', label: '1 mes' },
              { value: '2_MESES', label: '2 meses' },
              { value: 'MAS_2_MESES', label: '+2 meses' },
            ]}
          />
        </Space>
      </Card>

      <Card>
        <Table
          dataSource={clients}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1000 }}
          rowClassName={(r) => (r.debtInfo?.requiereCorte ? 'row-corte' : '')}
          pagination={{
            total: pagination.total,
            current: pagination.page,
            pageSize: pagination.limit,
            showSizeChanger: false,
            showTotal: (t) => `${t} clientes`,
            onChange: (p) => load(p),
          }}
          columns={[
            {
              title: 'Código',
              dataIndex: 'codCli',
              width: 80,
            },
            {
              title: 'Nombre',
              dataIndex: 'nombreNormalizado',
              ellipsis: true,
            },
            {
              title: 'Estado',
              dataIndex: 'estado',
              width: 100,
              render: (s: ClientStatus) => (
                <Tag color={s === 'ACTIVO' ? 'blue' : 'default'}>{s}</Tag>
              ),
            },
            {
              title: 'Alta',
              dataIndex: 'fechaAlta',
              width: 110,
              render: (d: string | null) =>
                d ? new Date(d).toLocaleDateString('es-AR') : '—',
            },
            {
              title: 'Calle',
              dataIndex: 'calle',
              ellipsis: true,
              render: (v: string | null) => v || '—',
            },
            {
              title: 'Servicios',
              width: 130,
              render: (_: unknown, r: ClientWithDebt) => (
                <Space size={2}>
                  {r.debtInfo?.subscriptions?.some((s) => s.tipo === 'CABLE') && <Tag color="blue">Cable</Tag>}
                  {r.debtInfo?.subscriptions?.some((s) => s.tipo === 'INTERNET') && <Tag color="green">Internet</Tag>}
                </Space>
              ),
            },
            {
              title: 'Deuda',
              width: 140,
              render: (_: unknown, r: ClientWithDebt) =>
                r.debtInfo
                  ? debtTag(r.debtInfo.cantidadDeuda, r.debtInfo.requiereCorte)
                  : '—',
            },
            {
              title: 'Meses adeudados',
              width: 200,
              render: (_: unknown, r: ClientWithDebt) => {
                const m = r.debtInfo?.mesesAdeudados || [];
                if (m.length === 0) return '—';
                return (
                  <Tooltip title={m.join(', ')}>
                    <span style={{ color: '#f5222d' }}>
                      {m.slice(0, 3).join(', ')}
                      {m.length > 3 && ` +${m.length - 3}`}
                    </span>
                  </Tooltip>
                );
              },
            },
            {
              title: '',
              width: 50,
              render: (_: unknown, r: ClientWithDebt) => (
                <Tooltip title="Ver detalle">
                  <Button
                    type="text"
                    size="small"
                    icon={<EyeOutlined />}
                    onClick={() => detail.openDetail(r.id)}
                  />
                </Tooltip>
              ),
            },
          ]}
        />
      </Card>

      {/* Detail Drawer */}
      <Drawer
        title={detail.detail?.nombreNormalizado || 'Detalle del cliente'}
        open={detail.open}
        onClose={detail.close}
        width={640}
        destroyOnClose
      >
        {detail.loading && (
          <Spin size="large" style={{ display: 'block', margin: '60px auto' }} />
        )}
        {detail.detail && <ClientDetail data={detail.detail} onRefresh={() => detail.openDetail(detail.detail!.clientId)} />}
      </Drawer>

      <CreateClientModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => load()} />
    </div>
  );
}

// ClientDetail is now in ./components/ClientDrawer/index.tsx
// This comment marks the end of ClientsPage

