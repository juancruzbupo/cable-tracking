import { useState } from 'react';
import {
  Card, Table, Input, Select, Tag, Space, Typography, Tooltip, Button,
  message, Drawer, Descriptions, Spin, Timeline, Badge, Divider,
  DatePicker, Modal, Collapse,
} from 'antd';
import {
  SearchOutlined, WarningOutlined, DownloadOutlined, EyeOutlined,
  CheckCircleFilled, CloseCircleFilled, FileTextOutlined,
  PlusOutlined, StopOutlined, PlayCircleOutlined, DeleteOutlined,
  HistoryOutlined, MessageOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/es';
import { clientsApi, exportApi, getErrorMessage } from '../services/api';
import { useClients, useClientDetail } from '../hooks/useClients';
import { useAuth } from '../context/AuthContext';
import CreateClientModal from '../components/CreateClientModal';
import type { ClientWithDebt, ClientDetailResult, ClientStatus, ClientNote, AuditLogEntry } from '../types';

dayjs.extend(relativeTime);
dayjs.locale('es');

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

// ── Client Detail Component ──────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  CLIENT_CREATED: 'Cliente dado de alta',
  CLIENT_DEACTIVATED: 'Cliente dado de baja',
  CLIENT_REACTIVATED: 'Cliente reactivado',
  SUBSCRIPTION_DEACTIVATED: 'Servicio cancelado',
  SUBSCRIPTION_REACTIVATED: 'Servicio reactivado',
  SUBSCRIPTION_FECHA_ALTA_UPDATED: 'Fecha de alta modificada',
  PAYMENT_MANUAL_CREATED: 'Pago manual registrado',
  PAYMENT_MANUAL_DELETED: 'Pago manual eliminado',
  NOTE_CREATED: 'Nota agregada',
  NOTE_DELETED: 'Nota eliminada',
};

function ClientDetail({ data, onRefresh }: { data: ClientDetailResult; onRefresh: () => void }) {
  const { nombreNormalizado, nombreOriginal, codCli, estado, fechaAlta, calle, requiereCorte, subscriptions, documents } = data;
  const { hasRole } = useAuth();
  const canOperate = hasRole('ADMIN', 'OPERADOR');
  const isAdmin = hasRole('ADMIN');

  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [history, setHistory] = useState<AuditLogEntry[]>([]);
  const [noteText, setNoteText] = useState('');
  const [payMonth, setPayMonth] = useState<dayjs.Dayjs | null>(null);
  const [paySubId, setPaySubId] = useState<string>('');

  const loadNotes = async () => { try { setNotes(await clientsApi.getNotes(data.clientId)); } catch {} };
  const loadHistory = async () => { try { setHistory(await clientsApi.getHistory(data.clientId)); } catch {} };

  const handleDeactivate = () => {
    Modal.confirm({
      title: `Confirmar baja de ${nombreNormalizado}`,
      content: 'Se darán de baja todos sus servicios activos.',
      okText: 'Dar de baja', okType: 'danger',
      onOk: async () => { await clientsApi.deactivate(data.clientId); message.success('Cliente dado de baja'); onRefresh(); },
    });
  };

  const handleReactivate = async () => {
    await clientsApi.reactivate(data.clientId);
    message.success('Cliente reactivado');
    onRefresh();
  };

  const handleDeactivateSub = (subId: string, tipo: string) => {
    Modal.confirm({
      title: `Cancelar servicio de ${tipo}`,
      content: `¿Cancelar ${tipo} para ${nombreNormalizado}?`,
      okText: 'Cancelar servicio', okType: 'danger',
      onOk: async () => { await clientsApi.deactivateSub(data.clientId, subId); message.success('Servicio cancelado'); onRefresh(); },
    });
  };

  const handlePayment = async () => {
    if (!payMonth || !paySubId) return;
    try {
      await clientsApi.createPayment(data.clientId, paySubId, payMonth.year(), payMonth.month() + 1);
      message.success('Pago registrado');
      setPayMonth(null);
      onRefresh();
    } catch (err) { message.error(getErrorMessage(err)); }
  };

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    try {
      await clientsApi.createNote(data.clientId, noteText.trim());
      setNoteText('');
      message.success('Nota agregada');
      loadNotes();
    } catch (err) { message.error(getErrorMessage(err)); }
  };

  const activeSubs = subscriptions.filter((s) => s.tipo);

  return (
    <div>
      {/* Acciones de cliente */}
      <Space style={{ marginBottom: 12 }}>
        {canOperate && estado === 'ACTIVO' && (
          <Button danger icon={<StopOutlined />} size="small" onClick={handleDeactivate}>Dar de baja</Button>
        )}
        {isAdmin && estado === 'BAJA' && (
          <Button type="primary" icon={<PlayCircleOutlined />} size="small" onClick={handleReactivate}>Reactivar</Button>
        )}
      </Space>

      <Descriptions bordered size="small" column={1}>
        <Descriptions.Item label="Código">{codCli}</Descriptions.Item>
        <Descriptions.Item label="Nombre">{nombreNormalizado}</Descriptions.Item>
        {nombreOriginal !== nombreNormalizado && (
          <Descriptions.Item label="Nombre original"><Typography.Text type="secondary">{nombreOriginal}</Typography.Text></Descriptions.Item>
        )}
        <Descriptions.Item label="Estado"><Tag color={estado === 'ACTIVO' ? 'blue' : 'default'}>{estado}</Tag></Descriptions.Item>
        <Descriptions.Item label="Fecha de alta">{fechaAlta ? new Date(fechaAlta).toLocaleDateString('es-AR') : '—'}</Descriptions.Item>
        <Descriptions.Item label="Calle">{calle || '—'}</Descriptions.Item>
      </Descriptions>

      <Divider orientation="left">Servicios</Divider>

      {requiereCorte && (
        <Tag color="red" icon={<WarningOutlined />} style={{ marginBottom: 12, fontSize: 14, padding: '4px 12px' }}>REQUIERE CORTE</Tag>
      )}

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {subscriptions.map((sub) => (
          <Card key={sub.subscriptionId} size="small" style={{ flex: 1, minWidth: 240, border: sub.requiereCorte ? '1px solid #ff4d4f' : undefined }}
            title={<Space>{sub.tipo === 'CABLE' ? '📺' : '🌐'} {sub.tipo} {sub.requiereCorte && <Tag color="red" style={{ margin: 0 }}>CORTE</Tag>}</Space>}
            extra={canOperate && estado === 'ACTIVO' && (
              <Button type="link" danger size="small" onClick={() => handleDeactivateSub(sub.subscriptionId, sub.tipo)}>Cancelar</Button>
            )}
          >
            <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
              <div style={{ textAlign: 'center' }}><div style={{ fontSize: 24, fontWeight: 700, color: sub.cantidadDeuda > 0 ? '#f5222d' : '#52c41a' }}>{sub.cantidadDeuda}</div><div style={{ color: '#888', fontSize: 11 }}>deuda</div></div>
              <div style={{ textAlign: 'center' }}><div style={{ fontSize: 24, fontWeight: 700, color: '#52c41a' }}>{sub.mesesPagados.length}</div><div style={{ color: '#888', fontSize: 11 }}>pagados</div></div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {sub.mesesObligatorios.slice(-6).map((m) => {
                const pagado = sub.mesesPagados.includes(m);
                return (<Badge key={m} count={pagado ? <CheckCircleFilled style={{ color: '#52c41a', fontSize: 8 }} /> : <CloseCircleFilled style={{ color: '#f5222d', fontSize: 8 }} />} offset={[-4, 0]}><Tag color={pagado ? 'green' : 'red'} style={{ margin: 0, fontSize: 10 }}>{m}</Tag></Badge>);
              })}
            </div>
          </Card>
        ))}
      </div>

      {/* Pago manual */}
      {canOperate && activeSubs.length > 0 && estado === 'ACTIVO' && (
        <>
          <Divider orientation="left">Registrar pago manual</Divider>
          <Space>
            <Select placeholder="Servicio" style={{ width: 140 }} value={paySubId || undefined} onChange={setPaySubId}
              options={activeSubs.map((s) => ({ value: s.subscriptionId, label: s.tipo }))} />
            <DatePicker picker="month" value={payMonth} onChange={setPayMonth} disabledDate={(d) => d.isAfter(dayjs())} format="MMM YYYY" />
            <Button type="primary" size="small" onClick={handlePayment} disabled={!payMonth || !paySubId}>Registrar</Button>
          </Space>
        </>
      )}

      {/* Notas */}
      <Collapse style={{ marginTop: 16 }} items={[
        {
          key: 'notes', label: <><MessageOutlined /> Notas</>,
          children: (
            <div>
              {canOperate && (
                <Space.Compact style={{ width: '100%', marginBottom: 8 }}>
                  <Input.TextArea rows={2} maxLength={1000} value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Agregar nota..." />
                  <Button type="primary" onClick={handleAddNote} disabled={!noteText.trim()}>Agregar</Button>
                </Space.Compact>
              )}
              {notes.map((n) => (
                <div key={n.id} style={{ padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <Space>
                    <Typography.Text strong style={{ fontSize: 12 }}>{n.user.name}</Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: 11 }}>{dayjs(n.createdAt).fromNow()}</Typography.Text>
                    {isAdmin && <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={async () => { await clientsApi.deleteNote(data.clientId, n.id); loadNotes(); }} />}
                  </Space>
                  <div style={{ fontSize: 13 }}>{n.content}</div>
                </div>
              ))}
              {notes.length === 0 && <Typography.Text type="secondary">Sin notas.</Typography.Text>}
            </div>
          ),
          onExpand: (_e: any, expanded: boolean) => { if (expanded) loadNotes(); },
        } as any,
        {
          key: 'history', label: <><HistoryOutlined /> Historial</>,
          children: (
            <Timeline items={history.map((h) => ({
              key: h.id,
              children: (
                <div>
                  <Typography.Text strong style={{ fontSize: 12 }}>{ACTION_LABELS[h.action] || h.action}</Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>{h.user.name} — {dayjs(h.createdAt).fromNow()}</Typography.Text>
                </div>
              ),
            }))} />
          ),
          onExpand: (_e: any, expanded: boolean) => { if (expanded) loadHistory(); },
        } as any,
      ]} />

      {/* Documentos */}
      {documents.length > 0 && (
        <>
          <Divider orientation="left"><FileTextOutlined /> Documentos ({data.docPagination.total})</Divider>
          <Timeline items={documents.map((doc) => ({
            key: doc.id, color: doc.tipo === 'FACTURA' ? 'green' : 'blue',
            children: (
              <div>
                <Space>
                  <Tag color={doc.tipo === 'FACTURA' ? 'green' : 'blue'}>{doc.tipo}</Tag>
                  {doc.numeroDocumento && <Typography.Text code>{doc.numeroDocumento}</Typography.Text>}
                  {doc.fechaDocumento && <Typography.Text type="secondary">{new Date(doc.fechaDocumento).toLocaleDateString('es-AR')}</Typography.Text>}
                </Space>
                {doc.descripcionOriginal && <div style={{ marginTop: 2 }}><Typography.Text ellipsis style={{ maxWidth: 400 }}>{doc.descripcionOriginal}</Typography.Text></div>}
                {doc.paymentPeriods.length > 0 && <div style={{ marginTop: 4 }}>{doc.paymentPeriods.map((pp) => <Tag key={`${pp.year}-${pp.month}`} color="cyan" style={{ fontSize: 11 }}>{pp.year}-{String(pp.month).padStart(2, '0')}</Tag>)}</div>}
              </div>
            ),
          }))} />
          {data.docPagination.totalPages > 1 && (
            <Typography.Text type="secondary">Página {data.docPagination.page} de {data.docPagination.totalPages} ({data.docPagination.total} docs).</Typography.Text>
          )}
        </>
      )}
    </div>
  );
}
