import { useState, useEffect } from 'react';
import {
  Card, Table, Input, Select, Tag, Space, Typography, Tooltip, Button,
  message, Drawer, Spin,
} from 'antd';
import {
  SearchOutlined, WarningOutlined, DownloadOutlined, EyeOutlined, PlusOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import { exportApi } from '../../services/api';
import { useClients, useClientDetail } from './hooks/useClients';
import { useAuth } from '../../context/AuthContext';
import CreateClientModal from './components/CreateClientModal';
import ClientDetail from './components/ClientDrawer';
import type { ClientWithDebt, ClientStatus } from '../../types';

export default function ClientsPage() {
  const {
    clients, pagination, loading, search, setSearch,
    estado, setEstado, debtStatus, setDebtStatus, zona, setZona, load,
  } = useClients();
  const detail = useClientDetail();
  const { hasRole } = useAuth();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const cid = searchParams.get('clientId');
    if (cid) detail.openDetail(cid);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
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
          <Input
            placeholder="Zona..."
            value={zona}
            onChange={(e) => setZona(e.target.value || undefined)}
            style={{ width: 140 }}
            allowClear
          />
        </Space>
      </Card>

      <Card>
        <Table
          dataSource={clients}
          rowKey="id"
          loading={loading}
          size="small"
          scroll={{ x: 1100 }}
          tableLayout="fixed"
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
              title: 'Cód.',
              dataIndex: 'codCli',
              width: 65,
            },
            {
              title: 'Nombre',
              dataIndex: 'nombreNormalizado',
              width: 200,
              ellipsis: true,
              render: (name: string, r: ClientWithDebt) => (
                <span>
                  {name}
                  {(r.ticketsAbiertos ?? 0) > 0 && (
                    <Tooltip title={`${r.ticketsAbiertos} ticket(s) abierto(s)`}>
                      <ExclamationCircleOutlined style={{ color: '#faad14', marginLeft: 6 }} />
                    </Tooltip>
                  )}
                </span>
              ),
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
              width: 95,
              render: (d: string | null) =>
                d ? new Date(d).toLocaleDateString('es-AR') : '—',
            },
            {
              title: 'Calle',
              dataIndex: 'calle',
              width: 180,
              ellipsis: true,
              render: (v: string | null) => v || '—',
            },
            {
              title: 'Servicios',
              width: 120,
              render: (_: unknown, r: ClientWithDebt) => (
                <Space size={2}>
                  {r.debtInfo?.subscriptions?.some((s) => s.tipo === 'CABLE') && <Tag color="blue">Cable</Tag>}
                  {r.debtInfo?.subscriptions?.some((s) => s.tipo === 'INTERNET') && <Tag color="green">Internet</Tag>}
                </Space>
              ),
            },
            {
              title: 'Deuda',
              width: 110,
              render: (_: unknown, r: ClientWithDebt) =>
                r.debtInfo
                  ? debtTag(r.debtInfo.cantidadDeuda, r.debtInfo.requiereCorte)
                  : '—',
            },
            {
              title: 'Adeudados',
              width: 160,
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
        title={<Space>{detail.detail?.nombreNormalizado || 'Detalle'} {detail.detail?.estado === 'BAJA' && <Tag color="default">BAJA</Tag>}</Space>}
        open={detail.open}
        onClose={detail.close}
        width={Math.min(800, window.innerWidth * 0.85)}
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

