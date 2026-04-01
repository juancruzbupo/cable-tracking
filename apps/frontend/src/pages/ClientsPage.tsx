import { useState } from 'react';
import {
  Card, Table, Input, Select, Tag, Space, Typography, Tooltip, Button,
  message, Drawer, Descriptions, Spin, Timeline, Badge, Divider,
} from 'antd';
import {
  SearchOutlined, WarningOutlined, DownloadOutlined, EyeOutlined,
  CheckCircleFilled, CloseCircleFilled, FileTextOutlined,
} from '@ant-design/icons';
import { exportApi } from '../services/api';
import { useClients, useClientDetail } from '../hooks/useClients';
import type { ClientWithDebt, ClientDetailResult, ClientStatus } from '../types';

export default function ClientsPage() {
  const {
    clients, pagination, loading, search, setSearch,
    estado, setEstado, debtStatus, setDebtStatus, load,
  } = useClients();
  const detail = useClientDetail();
  const [exporting, setExporting] = useState(false);

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
        <Button
          icon={<DownloadOutlined />}
          onClick={handleExport}
          loading={exporting}
        >
          Exportar Excel
        </Button>
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
                <Button
                  type="text"
                  size="small"
                  icon={<EyeOutlined />}
                  onClick={() => detail.openDetail(r.id)}
                />
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
        width={620}
        destroyOnClose
      >
        {detail.loading && (
          <Spin size="large" style={{ display: 'block', margin: '60px auto' }} />
        )}
        {detail.detail && <ClientDetail data={detail.detail} />}
      </Drawer>
    </div>
  );
}

// ── Client Detail Component ──────────────────────────────────

function ClientDetail({ data }: { data: ClientDetailResult }) {
  const {
    nombreNormalizado, nombreOriginal, codCli, estado,
    fechaAlta, calle, cantidadDeuda, requiereCorte,
    mesesObligatorios, mesesPagados, documents,
  } = data;

  return (
    <div>
      <Descriptions bordered size="small" column={1}>
        <Descriptions.Item label="Código">{codCli}</Descriptions.Item>
        <Descriptions.Item label="Nombre">{nombreNormalizado}</Descriptions.Item>
        {nombreOriginal !== nombreNormalizado && (
          <Descriptions.Item label="Nombre original">
            <Typography.Text type="secondary">{nombreOriginal}</Typography.Text>
          </Descriptions.Item>
        )}
        <Descriptions.Item label="Estado">
          <Tag color={estado === 'ACTIVO' ? 'blue' : 'default'}>{estado}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Fecha de alta">
          {fechaAlta ? new Date(fechaAlta).toLocaleDateString('es-AR') : '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Calle">{calle || '—'}</Descriptions.Item>
      </Descriptions>

      <Divider orientation="left">Situación de deuda</Divider>

      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <Card size="small" style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: cantidadDeuda > 0 ? '#f5222d' : '#52c41a' }}>
            {cantidadDeuda}
          </div>
          <div style={{ color: '#888' }}>meses deuda</div>
        </Card>
        <Card size="small" style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#52c41a' }}>
            {mesesPagados.length}
          </div>
          <div style={{ color: '#888' }}>meses pagados</div>
        </Card>
        <Card size="small" style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#1677ff' }}>
            {mesesObligatorios.length}
          </div>
          <div style={{ color: '#888' }}>meses obligatorios</div>
        </Card>
      </div>

      {requiereCorte && (
        <Tag color="red" icon={<WarningOutlined />} style={{ marginBottom: 16, fontSize: 14, padding: '4px 12px' }}>
          REQUIERE CORTE — {cantidadDeuda} meses de deuda
        </Tag>
      )}

      {mesesObligatorios.length > 0 && (
        <>
          <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
            Cobertura mensual (últimos 12):
          </Typography.Text>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
            {mesesObligatorios.slice(-12).map((m) => {
              const pagado = mesesPagados.includes(m);
              return (
                <Badge
                  key={m}
                  count={pagado ? <CheckCircleFilled style={{ color: '#52c41a', fontSize: 10 }} /> : <CloseCircleFilled style={{ color: '#f5222d', fontSize: 10 }} />}
                  offset={[-4, 0]}
                >
                  <Tag color={pagado ? 'green' : 'red'} style={{ margin: 0 }}>
                    {m}
                  </Tag>
                </Badge>
              );
            })}
          </div>
          {mesesObligatorios.length > 12 && (
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
              Mostrando últimos 12 de {mesesObligatorios.length} meses obligatorios.
            </Typography.Text>
          )}
        </>
      )}

      {documents.length > 0 && (
        <>
          <Divider orientation="left">
            <FileTextOutlined /> Documentos ({data.docPagination.total})
          </Divider>
          <Timeline
            items={documents.map((doc) => ({
              key: doc.id,
              color: doc.tipo === 'FACTURA' ? 'green' : 'blue',
              children: (
                <div>
                  <Space>
                    <Tag color={doc.tipo === 'FACTURA' ? 'green' : 'blue'}>{doc.tipo}</Tag>
                    {doc.numeroDocumento && (
                      <Typography.Text code>{doc.numeroDocumento}</Typography.Text>
                    )}
                    {doc.fechaDocumento && (
                      <Typography.Text type="secondary">
                        {new Date(doc.fechaDocumento).toLocaleDateString('es-AR')}
                      </Typography.Text>
                    )}
                  </Space>
                  {doc.descripcionOriginal && (
                    <div style={{ marginTop: 2 }}>
                      <Typography.Text ellipsis style={{ maxWidth: 400 }}>
                        {doc.descripcionOriginal}
                      </Typography.Text>
                    </div>
                  )}
                  {doc.paymentPeriods.length > 0 && (
                    <div style={{ marginTop: 4 }}>
                      {doc.paymentPeriods.map((pp) => (
                        <Tag key={`${pp.year}-${pp.month}`} color="cyan" style={{ fontSize: 11 }}>
                          {pp.year}-{String(pp.month).padStart(2, '0')}
                        </Tag>
                      ))}
                    </div>
                  )}
                </div>
              ),
            }))}
          />
          {data.docPagination.totalPages > 1 && (
            <Typography.Text type="secondary">
              Mostrando página {data.docPagination.page} de {data.docPagination.totalPages} ({data.docPagination.total} documentos).
            </Typography.Text>
          )}
        </>
      )}
    </div>
  );
}
