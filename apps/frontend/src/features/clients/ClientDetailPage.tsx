import { useEffect, useState } from 'react';
import {
  Card, Tag, Space, Typography, Button, Tabs, Spin, Alert,
  message, Descriptions, Timeline, Badge, Select,
  DatePicker, Modal, Input, List,
} from 'antd';
import {
  ArrowLeftOutlined, WarningOutlined, CheckCircleFilled, CloseCircleFilled,
  StopOutlined, PlayCircleOutlined, DeleteOutlined, WhatsAppOutlined,
  FileTextOutlined, MessageOutlined, HistoryOutlined, ThunderboltOutlined,
  IdcardOutlined, ToolOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/es';
import { clientsApi, promotionsApi, equipmentApi, ticketsApi, fiscalApi, getErrorMessage } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { generarMensajeDeuda, generarLinkWhatsApp } from '../../shared/utils/whatsapp';
import type { ClientDetailResult, ClientNote, AuditLogEntry } from '../../types';

dayjs.extend(relativeTime);
dayjs.locale('es');

const ACTION_LABELS: Record<string, string> = {
  CLIENT_CREATED: 'Cliente dado de alta', CLIENT_DEACTIVATED: 'Cliente dado de baja', CLIENT_REACTIVATED: 'Cliente reactivado',
  SUBSCRIPTION_DEACTIVATED: 'Servicio cancelado', SUBSCRIPTION_REACTIVATED: 'Servicio reactivado', SUBSCRIPTION_FECHA_ALTA_UPDATED: 'Fecha de alta modificada',
  PAYMENT_MANUAL_CREATED: 'Pago manual registrado', PAYMENT_MANUAL_DELETED: 'Pago manual eliminado',
  NOTE_CREATED: 'Nota agregada', NOTE_DELETED: 'Nota eliminada',
  PROMOTION_ASSIGNED: 'Promoción asignada', PROMOTION_REMOVED: 'Promoción removida',
  EQUIPMENT_ASSIGNED: 'Equipo asignado', EQUIPMENT_RETIRED: 'Equipo retirado',
  TICKET_CREATED: 'Ticket creado', TICKET_RESOLVED: 'Ticket resuelto',
};

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const canOperate = hasRole('ADMIN', 'OPERADOR');
  const isAdmin = hasRole('ADMIN');

  const [data, setData] = useState<ClientDetailResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Tab data
  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [history, setHistory] = useState<AuditLogEntry[]>([]);
  const [promos, setPromos] = useState<any[]>([]);
  const [clientEquipment, setClientEquipment] = useState<any[]>([]);
  const [clientTickets, setClientTickets] = useState<any[]>([]);

  // Form state
  const [noteText, setNoteText] = useState('');
  const [payMonth, setPayMonth] = useState<dayjs.Dayjs | null>(null);
  const [paySubId, setPaySubId] = useState('');
  const [newTicketTipo, setNewTicketTipo] = useState('');
  const [newTicketDesc, setNewTicketDesc] = useState('');
  const [lastWhatsApp, setLastWhatsApp] = useState<{ sentAt: string; sentBy: string } | null>(null);
  const [fiscalEditing, setFiscalEditing] = useState(false);
  const [fiscalSaving, setFiscalSaving] = useState(false);
  const [fiscalForm, setFiscalForm] = useState<Record<string, string>>({});
  const [equipOptions, setEquipOptions] = useState<any[]>([]);
  const [equipSearching, setEquipSearching] = useState(false);
  const [selectedEquipId, setSelectedEquipId] = useState<string>('');
  const [availablePromos, setAvailablePromos] = useState<any[]>([]);
  const [selectedPromoId, setSelectedPromoId] = useState('');
  const [selectedPromoSubId, setSelectedPromoSubId] = useState('');

  // Loading states
  const [notesLoading, setNotesLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [promosLoading, setPromosLoading] = useState(false);
  const [equipLoading, setEquipLoading] = useState(false);
  const [ticketsLoading, setTicketsLoading] = useState(false);

  const loadClient = async () => {
    if (!id) return;
    setLoading(true);
    try {
      setData(await clientsApi.getOne(id));
    } catch (err) { setError(getErrorMessage(err)); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadClient(); if (id) clientsApi.getLastWhatsApp(id).then(setLastWhatsApp).catch(() => {}); }, [id]);

  const loadNotes = async () => { if (!id) return; setNotesLoading(true); try { setNotes(await clientsApi.getNotes(id)); } catch { /* */ } finally { setNotesLoading(false); } };
  const loadHistory = async () => { if (!id) return; setHistoryLoading(true); try { setHistory(await clientsApi.getHistory(id)); } catch { /* */ } finally { setHistoryLoading(false); } };
  const loadPromos = async () => {
    if (!id) return; setPromosLoading(true);
    try {
      const [assigned, all] = await Promise.all([promotionsApi.getClientPromos(id), promotionsApi.getAll({ scope: 'CLIENTE', activa: 'true' })]);
      setPromos(assigned);
      setAvailablePromos(all);
    } catch { /* */ }
    finally { setPromosLoading(false); }
  };
  const loadEquipment = async () => { if (!id) return; setEquipLoading(true); try { setClientEquipment(await equipmentApi.getClientEquipment(id)); } catch { /* */ } finally { setEquipLoading(false); } };
  const loadTickets = async () => { if (!id) return; setTicketsLoading(true); try { setClientTickets(await ticketsApi.getClientTickets(id)); } catch { /* */ } finally { setTicketsLoading(false); } };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (error) return <Alert type="error" message={error} showIcon />;
  if (!data) return null;

  const { nombreNormalizado, codCli, estado, fechaAlta, calle, requiereCorte, subscriptions, documents } = data;
  const activeSubs = subscriptions.filter((s: any) => s.tipo);
  const d = data as any;

  const handleDeactivate = () => {
    Modal.confirm({
      title: `Confirmar baja de ${nombreNormalizado}`, content: 'Se darán de baja todos sus servicios activos.', okText: 'Dar de baja', okType: 'danger',
      onOk: async () => { await clientsApi.deactivate(data.clientId); message.success('Cliente dado de baja'); loadClient(); },
    });
  };

  const handlePayment = async () => {
    if (!payMonth || !paySubId) return;
    try { await clientsApi.createPayment(data.clientId, paySubId, payMonth.year(), payMonth.month() + 1); message.success('Pago registrado'); setPayMonth(null); loadClient(); }
    catch (err) { message.error(getErrorMessage(err)); }
  };

  // ── Tabs content ──────────────────────────────────────

  const tabServicios = (
    <div>
      {requiereCorte && <Tag color="red" icon={<WarningOutlined />} style={{ marginBottom: 12, fontSize: 14, padding: '4px 12px' }}>REQUIERE CORTE</Tag>}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        {subscriptions.map((sub: any) => (
          <Card key={sub.subscriptionId} size="small" style={{ flex: 1, minWidth: 280, border: sub.requiereCorte ? '2px solid #ff4d4f' : undefined }}
            title={<Space>{sub.tipo === 'CABLE' ? '📺' : '🌐'} {sub.tipo} {sub.requiereCorte && <Tag color="red" style={{ margin: 0 }}>CORTE</Tag>}</Space>}
            extra={canOperate && estado === 'ACTIVO' && (
              <Button type="link" danger size="small" onClick={() => Modal.confirm({
                title: `Cancelar ${sub.tipo}`, okText: 'Cancelar servicio', okType: 'danger',
                onOk: async () => { await clientsApi.deactivateSub(data.clientId, sub.subscriptionId); message.success('Servicio cancelado'); loadClient(); },
              })}>Cancelar</Button>
            )}>
            <div style={{ display: 'flex', gap: 24, marginBottom: 12 }}>
              <div style={{ textAlign: 'center' }}><div style={{ fontSize: 32, fontWeight: 700, color: sub.cantidadDeuda > 0 ? '#f5222d' : '#52c41a' }}>{sub.cantidadDeuda}</div><div style={{ color: '#888', fontSize: 12 }}>meses deuda</div></div>
              <div style={{ textAlign: 'center' }}><div style={{ fontSize: 32, fontWeight: 700, color: '#52c41a' }}>{sub.mesesPagados.length}</div><div style={{ color: '#888', fontSize: 12 }}>pagados</div></div>
            </div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>Últimos 12 meses:</Typography.Text>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
              {sub.mesesObligatorios.slice(-12).map((m: string) => {
                const pagado = sub.mesesPagados.includes(m);
                const promoGratis = sub.mesesConPromoGratis?.includes(m);
                const cubierto = pagado || promoGratis;
                const color = promoGratis && !pagado ? 'purple' : pagado ? 'green' : 'red';
                const icon = cubierto ? <CheckCircleFilled style={{ color: promoGratis && !pagado ? '#722ed1' : '#52c41a', fontSize: 8 }} /> : <CloseCircleFilled style={{ color: '#f5222d', fontSize: 8 }} />;
                return <Badge key={m} count={icon} offset={[-4, 0]}><Tag color={color} style={{ margin: 0, fontSize: 10 }}>{m}</Tag></Badge>;
              })}
            </div>
          </Card>
        ))}
      </div>
      {canOperate && activeSubs.length > 0 && estado === 'ACTIVO' && (
        <Card size="small" title="Registrar pago manual">
          <Space>
            <Select placeholder="Servicio" style={{ width: 160 }} value={paySubId || undefined} onChange={setPaySubId} options={activeSubs.map((s: any) => ({ value: s.subscriptionId, label: s.tipo }))} />
            <DatePicker picker="month" value={payMonth} onChange={setPayMonth} disabledDate={(dd) => dd.isAfter(dayjs())} format="MMM YYYY" placeholder="Mes" />
            <Button type="primary" onClick={handlePayment} disabled={!payMonth || !paySubId}>Registrar pago</Button>
          </Space>
        </Card>
      )}
    </div>
  );

  const startFiscalEdit = () => {
    setFiscalForm({
      tipoDocumento: d.tipoDocumento || '',
      numeroDocumento: d.numeroDocFiscal || '',
      condicionFiscal: d.condicionFiscal || 'CONSUMIDOR_FINAL',
      razonSocial: d.razonSocial || '',
      telefono: d.telefono || '',
      email: d.email || '',
    });
    setFiscalEditing(true);
  };

  const saveFiscal = async () => {
    setFiscalSaving(true);
    try {
      await fiscalApi.updateClientFiscal(data.clientId, fiscalForm);
      message.success('Datos fiscales actualizados');
      setFiscalEditing(false);
      loadClient();
    } catch (err) { message.error(getErrorMessage(err)); }
    finally { setFiscalSaving(false); }
  };

  const tabFiscal = (
    <Card extra={canOperate && !fiscalEditing && <Button size="small" onClick={startFiscalEdit}>Editar</Button>}>
      {!fiscalEditing ? (
        <Descriptions bordered column={{ xs: 1, sm: 2 }}>
          <Descriptions.Item label="Tipo Documento">{d.tipoDocumento || '—'}</Descriptions.Item>
          <Descriptions.Item label="Nro Documento">{d.numeroDocFiscal || '—'}</Descriptions.Item>
          <Descriptions.Item label="Condición Fiscal">{d.condicionFiscal || 'CONSUMIDOR_FINAL'}</Descriptions.Item>
          <Descriptions.Item label="Razón Social">{d.razonSocial || '—'}</Descriptions.Item>
          <Descriptions.Item label="Teléfono">{d.telefono || '—'}</Descriptions.Item>
          <Descriptions.Item label="Email">{d.email || '—'}</Descriptions.Item>
          <Descriptions.Item label="Zona">{d.zona || '—'}</Descriptions.Item>
          <Descriptions.Item label="Código Postal">{d.codigoPostal || '—'}</Descriptions.Item>
          <Descriptions.Item label="Localidad">{d.localidad || '—'}</Descriptions.Item>
          <Descriptions.Item label="Provincia">{d.provincia || '—'}</Descriptions.Item>
          <Descriptions.Item label="Tipo Comprobante">
            <Tag color={d.tipoComprobante === 'FACTURA' ? 'blue' : 'default'}>{d.tipoComprobante || 'RAMITO'}</Tag>
          </Descriptions.Item>
        </Descriptions>
      ) : (
        <div style={{ maxWidth: 600 }}>
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            <div>
              <Typography.Text strong style={{ display: 'block', marginBottom: 4 }}>Tipo Documento</Typography.Text>
              <Select style={{ width: '100%' }} value={fiscalForm.tipoDocumento || undefined} onChange={(v) => setFiscalForm({ ...fiscalForm, tipoDocumento: v })}
                placeholder="Seleccionar..." allowClear
                options={[{ value: 'CUIT', label: 'CUIT' }, { value: 'CUIL', label: 'CUIL' }, { value: 'DNI', label: 'DNI' }, { value: 'CONSUMIDOR_FINAL', label: 'Consumidor Final' }]} />
            </div>
            <div>
              <Typography.Text strong style={{ display: 'block', marginBottom: 4 }}>Nro Documento</Typography.Text>
              <Input value={fiscalForm.numeroDocumento} onChange={(e) => setFiscalForm({ ...fiscalForm, numeroDocumento: e.target.value })} placeholder="Sin guiones" />
            </div>
            <div>
              <Typography.Text strong style={{ display: 'block', marginBottom: 4 }}>Condición Fiscal</Typography.Text>
              <Select style={{ width: '100%' }} value={fiscalForm.condicionFiscal} onChange={(v) => setFiscalForm({ ...fiscalForm, condicionFiscal: v })}
                options={[{ value: 'CONSUMIDOR_FINAL', label: 'Consumidor Final' }, { value: 'MONOTRIBUTISTA', label: 'Monotributista' }, { value: 'RESPONSABLE_INSCRIPTO', label: 'Responsable Inscripto' }, { value: 'EXENTO', label: 'Exento' }]} />
            </div>
            <div>
              <Typography.Text strong style={{ display: 'block', marginBottom: 4 }}>Razón Social</Typography.Text>
              <Input value={fiscalForm.razonSocial} onChange={(e) => setFiscalForm({ ...fiscalForm, razonSocial: e.target.value })} placeholder="Opcional" />
            </div>
            <div>
              <Typography.Text strong style={{ display: 'block', marginBottom: 4 }}>Teléfono</Typography.Text>
              <Input value={fiscalForm.telefono} onChange={(e) => setFiscalForm({ ...fiscalForm, telefono: e.target.value })} placeholder="Ej: 2942412345" />
            </div>
            <div>
              <Typography.Text strong style={{ display: 'block', marginBottom: 4 }}>Email</Typography.Text>
              <Input value={fiscalForm.email} onChange={(e) => setFiscalForm({ ...fiscalForm, email: e.target.value })} placeholder="Opcional" type="email" />
            </div>
            <Space style={{ marginTop: 8 }}>
              <Button type="primary" onClick={saveFiscal} loading={fiscalSaving}>Guardar</Button>
              <Button onClick={() => setFiscalEditing(false)}>Cancelar</Button>
            </Space>
          </Space>
        </div>
      )}
    </Card>
  );

  const searchEquipment = async (search: string) => {
    if (!search || search.length < 2) return;
    setEquipSearching(true);
    try {
      const res = await equipmentApi.getAll({ estado: 'EN_DEPOSITO', search });
      setEquipOptions((res.data || res).slice(0, 20));
    } catch { /* */ }
    finally { setEquipSearching(false); }
  };

  const handleAssignEquip = async () => {
    if (!selectedEquipId) return;
    try {
      await equipmentApi.assign(data.clientId, selectedEquipId);
      message.success('Equipo asignado');
      setSelectedEquipId('');
      setEquipOptions([]);
      loadEquipment();
    } catch (err) { message.error(getErrorMessage(err)); }
  };

  const tabEquipos = (
    <Card>
      <Spin spinning={equipLoading}>
        {canOperate && estado === 'ACTIVO' && (
          <div style={{ marginBottom: 16 }}>
            <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>Asignar equipo disponible</Typography.Text>
            <Space.Compact style={{ width: '100%' }}>
              <Select showSearch placeholder="Buscar por serie, marca o modelo..." filterOption={false}
                onSearch={searchEquipment} loading={equipSearching} style={{ flex: 1 }}
                value={selectedEquipId || undefined} onChange={setSelectedEquipId}
                notFoundContent={equipSearching ? <Spin size="small" /> : 'Escribí para buscar equipos en depósito'}>
                {equipOptions.map((eq: any) => (
                  <Select.Option key={eq.id} value={eq.id}>
                    {eq.tipo} {eq.marca && `— ${eq.marca}`} {eq.modelo && eq.modelo} {eq.numeroSerie && <Typography.Text code>{eq.numeroSerie}</Typography.Text>}
                  </Select.Option>
                ))}
              </Select>
              <Button type="primary" disabled={!selectedEquipId} onClick={handleAssignEquip}>Asignar</Button>
            </Space.Compact>
          </div>
        )}
        {clientEquipment.length > 0 ? (
          <List dataSource={clientEquipment} renderItem={(eq: any) => (
            <List.Item actions={canOperate && !eq.fechaRetiro ? [
              <Button type="link" danger onClick={async () => { try { await equipmentApi.retire(data.clientId, eq.id); message.success('Equipo retirado'); loadEquipment(); } catch (err) { message.error(getErrorMessage(err)); } }}>Retirar</Button>
            ] : undefined}>
              <List.Item.Meta
                title={<Space>{eq.equipment?.tipo} <Tag color={eq.fechaRetiro ? 'default' : 'blue'}>{eq.fechaRetiro ? 'Retirado' : 'Instalado'}</Tag></Space>}
                description={<Space direction="vertical" size={0}>
                  <span>{[eq.equipment?.marca, eq.equipment?.modelo].filter(Boolean).join(' ') || '—'}</span>
                  {eq.equipment?.numeroSerie && <Typography.Text code>{eq.equipment.numeroSerie}</Typography.Text>}
                  <Typography.Text type="secondary" style={{ fontSize: 11 }}>Instalado: {dayjs(eq.fechaInstalacion).format('DD/MM/YYYY')}{eq.fechaRetiro && ` — Retirado: ${dayjs(eq.fechaRetiro).format('DD/MM/YYYY')}`}</Typography.Text>
                </Space>}
              />
            </List.Item>
          )} />
        ) : !equipLoading && <Typography.Text type="secondary">Sin equipos asignados.</Typography.Text>}
      </Spin>
    </Card>
  );

  const tabTickets = (
    <Card>
      <Spin spinning={ticketsLoading}>
        {canOperate && estado === 'ACTIVO' && (
          <Space.Compact style={{ width: '100%', marginBottom: 16 }}>
            <Select placeholder="Tipo de problema" style={{ width: 200 }} value={newTicketTipo || undefined} onChange={setNewTicketTipo}
              options={[{ value: 'SIN_SENIAL', label: 'Sin señal' }, { value: 'LENTITUD_INTERNET', label: 'Lentitud internet' }, { value: 'RECONEXION', label: 'Reconexión' }, { value: 'INSTALACION', label: 'Instalación' }, { value: 'CAMBIO_EQUIPO', label: 'Cambio equipo' }, { value: 'OTRO', label: 'Otro' }]} />
            <Input placeholder="Descripción (opcional)" value={newTicketDesc} onChange={(e) => setNewTicketDesc(e.target.value)} />
            <Button type="primary" disabled={!newTicketTipo} onClick={async () => {
              try { await ticketsApi.create(data.clientId, newTicketTipo, newTicketDesc || undefined); message.success('Ticket creado'); setNewTicketTipo(''); setNewTicketDesc(''); loadTickets(); } catch (err) { message.error(getErrorMessage(err)); }
            }}>Crear ticket</Button>
          </Space.Compact>
        )}
        {clientTickets.length > 0 ? (
          <List dataSource={clientTickets} renderItem={(t: any) => (
            <List.Item>
              <List.Item.Meta
                title={<Space><Tag color={t.estado === 'ABIERTO' ? 'red' : 'green'}>{t.estado}</Tag><Tag>{t.tipo.replace(/_/g, ' ')}</Tag></Space>}
                description={<><span>{t.descripcion || '—'}</span> <Typography.Text type="secondary"> — {dayjs(t.createdAt).fromNow()}</Typography.Text></>}
              />
            </List.Item>
          )} />
        ) : !ticketsLoading && <Typography.Text type="secondary">Sin tickets.</Typography.Text>}
      </Spin>
    </Card>
  );

  const tabNotas = (
    <Card>
      <Spin spinning={notesLoading}>
        {canOperate && (
          <Space.Compact style={{ width: '100%', marginBottom: 16 }}>
            <Input.TextArea rows={2} maxLength={1000} value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Agregar nota..." style={{ flex: 1 }} />
            <Button type="primary" onClick={async () => { if (!noteText.trim()) return; try { await clientsApi.createNote(data.clientId, noteText.trim()); setNoteText(''); message.success('Nota agregada'); loadNotes(); } catch (err) { message.error(getErrorMessage(err)); } }} disabled={!noteText.trim()}>Agregar</Button>
          </Space.Compact>
        )}
        {notes.length > 0 ? notes.map((n) => (
          <div key={n.id} style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
            <Space>
              <Typography.Text strong>{n.user.name}</Typography.Text>
              <Typography.Text type="secondary">{dayjs(n.createdAt).fromNow()}</Typography.Text>
              {isAdmin && <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={async () => { try { await clientsApi.deleteNote(data.clientId, n.id); loadNotes(); } catch { message.error('Error'); } }} />}
            </Space>
            <div style={{ marginTop: 4 }}>{n.content}</div>
          </div>
        )) : !notesLoading && <Typography.Text type="secondary">Sin notas.</Typography.Text>}
      </Spin>
    </Card>
  );

  const tabHistorial = (
    <Card>
      <Spin spinning={historyLoading}>
        <Timeline items={history.map((h) => ({
          key: h.id,
          children: (
            <div>
              <Typography.Text strong>{ACTION_LABELS[h.action] || h.action}</Typography.Text>
              <Typography.Text type="secondary" style={{ marginLeft: 8 }}>{h.user.name} — {dayjs(h.createdAt).fromNow()}</Typography.Text>
            </div>
          ),
        }))} />
        {history.length === 0 && !historyLoading && <Typography.Text type="secondary">Sin historial.</Typography.Text>}
      </Spin>
    </Card>
  );

  const tabDocumentos = (
    <Card>
      {documents.length > 0 ? (
        <>
          <Timeline items={documents.map((doc) => ({
            key: doc.id, color: doc.tipo === 'FACTURA' ? 'green' : 'blue',
            children: (
              <div>
                <Space>
                  <Tag color={doc.tipo === 'FACTURA' ? 'green' : 'blue'}>{doc.tipo}</Tag>
                  {doc.numeroDocumento && <Typography.Text code>{doc.numeroDocumento}</Typography.Text>}
                  {doc.fechaDocumento && <Typography.Text type="secondary">{new Date(doc.fechaDocumento).toLocaleDateString('es-AR')}</Typography.Text>}
                </Space>
                {doc.descripcionOriginal && <div style={{ marginTop: 2 }}><Typography.Text ellipsis style={{ maxWidth: 600 }}>{doc.descripcionOriginal}</Typography.Text></div>}
                {doc.paymentPeriods.length > 0 && <div style={{ marginTop: 4 }}>{doc.paymentPeriods.map((pp) => <Tag key={`${pp.year}-${pp.month}`} color="cyan" style={{ fontSize: 11 }}>{pp.year}-{String(pp.month).padStart(2, '0')}</Tag>)}</div>}
              </div>
            ),
          }))} />
          {data.docPagination.totalPages > 1 && <Typography.Text type="secondary">Página {data.docPagination.page} de {data.docPagination.totalPages} ({data.docPagination.total} docs)</Typography.Text>}
        </>
      ) : <Typography.Text type="secondary">Sin documentos.</Typography.Text>}
    </Card>
  );

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <Space style={{ marginBottom: 8 }}>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/clients')}>Volver</Button>
            <Tag color={estado === 'ACTIVO' ? 'blue' : 'default'} style={{ fontSize: 14, padding: '2px 12px' }}>{estado}</Tag>
            {requiereCorte && <Tag color="red" icon={<WarningOutlined />} style={{ fontSize: 14, padding: '2px 12px' }}>REQUIERE CORTE</Tag>}
          </Space>
          <Typography.Title level={3} style={{ margin: 0 }}>{nombreNormalizado}</Typography.Title>
          <Typography.Text type="secondary">
            Código: {codCli} · {calle || 'Sin dirección'}{d.zona ? ` · ${d.zona}` : ''} · Alta: {fechaAlta ? new Date(fechaAlta).toLocaleDateString('es-AR') : '—'}
          </Typography.Text>
        </div>
        <Space>
          {d.telefono && data.cantidadDeuda > 0 && (
            <Space direction="vertical" size={0} align="end">
              <Button icon={<WhatsAppOutlined />} style={{ color: '#25D366' }} onClick={async () => {
                const msg = generarMensajeDeuda({ nombre: nombreNormalizado, deudaCable: data.deudaCable, deudaInternet: data.deudaInternet, cantidadDeuda: data.cantidadDeuda });
                window.open(generarLinkWhatsApp(d.telefono, msg), '_blank');
                try { await clientsApi.logWhatsApp(data.clientId); setLastWhatsApp({ sentAt: new Date().toISOString(), sentBy: 'Vos' }); } catch { /* */ }
              }}>WhatsApp</Button>
              {lastWhatsApp && <Typography.Text type="secondary" style={{ fontSize: 10 }}>Último: {dayjs(lastWhatsApp.sentAt).fromNow()} por {lastWhatsApp.sentBy}</Typography.Text>}
            </Space>
          )}
          {canOperate && estado === 'ACTIVO' && <Button danger icon={<StopOutlined />} onClick={handleDeactivate}>Dar de baja</Button>}
          {isAdmin && estado === 'BAJA' && <Button type="primary" icon={<PlayCircleOutlined />} onClick={async () => { await clientsApi.reactivate(data.clientId); message.success('Reactivado'); loadClient(); }}>Reactivar</Button>}
        </Space>
      </div>

      {/* Tabs */}
      <Tabs defaultActiveKey="servicios" onChange={(key) => {
        if (key === 'notas' && notes.length === 0) loadNotes();
        if (key === 'historial' && history.length === 0) loadHistory();
        if (key === 'promos' && promos.length === 0) loadPromos();
        if (key === 'equipos' && clientEquipment.length === 0) loadEquipment();
        if (key === 'tickets' && clientTickets.length === 0) loadTickets();
      }} items={[
        { key: 'servicios', label: <><span>📊</span> Servicios y Deuda</>, children: tabServicios },
        { key: 'fiscal', label: <><IdcardOutlined /> Datos Fiscales</>, children: tabFiscal },
        { key: 'equipos', label: <><ToolOutlined /> Equipos</>, children: tabEquipos },
        { key: 'tickets', label: <><ExclamationCircleOutlined /> Tickets</>, children: tabTickets },
        { key: 'notas', label: <><MessageOutlined /> Notas</>, children: tabNotas },
        { key: 'historial', label: <><HistoryOutlined /> Historial</>, children: tabHistorial },
        { key: 'promos', label: <><ThunderboltOutlined /> Promociones</>, children: (
          <Card><Spin spinning={promosLoading}>
            {canOperate && estado === 'ACTIVO' && activeSubs.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>Asignar promoción</Typography.Text>
                {availablePromos.length > 0 ? (
                  <Space wrap>
                    <Select placeholder="Suscripción" style={{ width: 150 }} value={selectedPromoSubId || undefined} onChange={setSelectedPromoSubId}
                      options={activeSubs.map((s: any) => ({ value: s.subscriptionId, label: s.tipo }))} />
                    <Select placeholder="Promoción" style={{ width: 280 }} value={selectedPromoId || undefined} onChange={setSelectedPromoId}
                      options={availablePromos.map((p: any) => ({ value: p.id, label: `${p.nombre} (${p.tipo}${p.tipo === 'PORCENTAJE' ? ' ' + p.valor + '%' : p.tipo === 'MESES_GRATIS' ? '' : ' $' + p.valor})` }))} />
                    <Button type="primary" disabled={!selectedPromoId || !selectedPromoSubId} onClick={async () => {
                      try { await promotionsApi.assignToSub(data.clientId, selectedPromoSubId, selectedPromoId); message.success('Promoción asignada'); setSelectedPromoId(''); setSelectedPromoSubId(''); loadPromos(); }
                      catch (err) { message.error(getErrorMessage(err)); }
                    }}>Asignar</Button>
                  </Space>
                ) : <Typography.Text type="secondary">No hay promociones de tipo CLIENTE activas. Creá una desde la página de Promociones.</Typography.Text>}
              </div>
            )}
            {promos.length > 0 ? <List dataSource={promos} renderItem={(p: any) => (
              <List.Item actions={isAdmin ? [
                <Button type="link" danger size="small" onClick={async () => {
                  try { await promotionsApi.removeFromSub(data.clientId, p.subscriptionId, p.id); message.success('Promoción removida'); loadPromos(); }
                  catch (err) { message.error(getErrorMessage(err)); }
                }}>Quitar</Button>
              ] : undefined}>
                <List.Item.Meta
                  title={<Space><Tag color="purple">{p.promotion?.tipo || p.tipo}</Tag><span>{p.promotion?.nombre || p.nombre}</span></Space>}
                  description={p.promotion?.fechaFin ? `Hasta ${dayjs(p.promotion.fechaFin).format('DD/MM/YYYY')}` : undefined}
                />
              </List.Item>
            )} /> : !promosLoading && <Typography.Text type="secondary">Sin promociones asignadas.</Typography.Text>}
          </Spin></Card>
        )},
        { key: 'documentos', label: <><FileTextOutlined /> Documentos ({data.docPagination.total})</>, children: tabDocumentos },
      ]} />
    </div>
  );
}
