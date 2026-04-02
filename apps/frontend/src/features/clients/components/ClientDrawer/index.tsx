import { useState, useEffect } from 'react';
import {
  Card, Select, Tag, Space, Typography, Button, Tabs,
  message, Descriptions, Timeline, Badge, Divider, DatePicker,
  Modal, Input, Spin, List,
} from 'antd';
import {
  WarningOutlined, CheckCircleFilled, CloseCircleFilled,
  StopOutlined, PlayCircleOutlined, DeleteOutlined, WhatsAppOutlined,
  FileTextOutlined, MessageOutlined, HistoryOutlined, ThunderboltOutlined,
  IdcardOutlined, ToolOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/es';
import { clientsApi, promotionsApi, equipmentApi, ticketsApi, fiscalApi, getErrorMessage } from '../../../../services/api';
import { useAuth } from '../../../../context/AuthContext';
import { generarMensajeDeuda, generarLinkWhatsApp } from '../../../../shared/utils/whatsapp';
import type { ClientDetailResult, ClientNote, AuditLogEntry } from '../../../../types';

dayjs.extend(relativeTime);
dayjs.locale('es');

const ACTION_LABELS: Record<string, string> = {
  CLIENT_CREATED: 'Alta', CLIENT_DEACTIVATED: 'Baja', CLIENT_REACTIVATED: 'Reactivado',
  SUBSCRIPTION_DEACTIVATED: 'Servicio cancelado', SUBSCRIPTION_REACTIVATED: 'Servicio reactivado',
  SUBSCRIPTION_FECHA_ALTA_UPDATED: 'Fecha alta modificada', SUBSCRIPTION_PLAN_UPDATED: 'Plan actualizado',
  PAYMENT_MANUAL_CREATED: 'Pago registrado', PAYMENT_MANUAL_DELETED: 'Pago eliminado',
  NOTE_CREATED: 'Nota agregada', NOTE_DELETED: 'Nota eliminada',
  PROMOTION_ASSIGNED: 'Promo asignada', PROMOTION_REMOVED: 'Promo removida',
  EQUIPMENT_ASSIGNED: 'Equipo asignado', EQUIPMENT_RETIRED: 'Equipo retirado',
  TICKET_CREATED: 'Ticket creado', TICKET_RESOLVED: 'Ticket resuelto',
  WHATSAPP_SENT: 'WhatsApp enviado', CLIENT_FISCAL_UPDATED: 'Datos fiscales actualizados',
};

export default function ClientDetail({ data, onRefresh }: { data: ClientDetailResult; onRefresh: () => void }) {
  const { nombreNormalizado, nombreOriginal, codCli, estado, fechaAlta, calle, requiereCorte, subscriptions, documents } = data;
  const { hasRole } = useAuth();
  const canOperate = hasRole('ADMIN', 'OPERADOR');
  const isAdmin = hasRole('ADMIN');
  const d = data as any;
  const activeSubs = subscriptions.filter((s: any) => s.tipo);

  // State
  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [history, setHistory] = useState<AuditLogEntry[]>([]);
  const [promos, setPromos] = useState<any[]>([]);
  const [availablePromos, setAvailablePromos] = useState<any[]>([]);
  const [clientEquipment, setClientEquipment] = useState<any[]>([]);
  const [clientTickets, setClientTickets] = useState<any[]>([]);
  const [lastWhatsApp, setLastWhatsApp] = useState<{ sentAt: string; sentBy: string } | null>(null);

  const [noteText, setNoteText] = useState('');
  const [payMonth, setPayMonth] = useState<dayjs.Dayjs | null>(null);
  const [paySubId, setPaySubId] = useState('');
  const [newTicketTipo, setNewTicketTipo] = useState('');
  const [newTicketDesc, setNewTicketDesc] = useState('');
  const [selectedPromoId, setSelectedPromoId] = useState('');
  const [selectedPromoSubId, setSelectedPromoSubId] = useState('');
  const [equipOptions, setEquipOptions] = useState<any[]>([]);
  const [equipSearching, setEquipSearching] = useState(false);
  const [selectedEquipId, setSelectedEquipId] = useState('');
  const [fiscalEditing, setFiscalEditing] = useState(false);
  const [fiscalSaving, setFiscalSaving] = useState(false);
  const [fiscalForm, setFiscalForm] = useState<Record<string, string>>({});

  const [notesLoading, setNotesLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [promosLoading, setPromosLoading] = useState(false);
  const [equipLoading, setEquipLoading] = useState(false);
  const [ticketsLoading, setTicketsLoading] = useState(false);

  useEffect(() => { clientsApi.getLastWhatsApp(data.clientId).then(setLastWhatsApp).catch(() => {}); }, [data.clientId]);

  // Loaders
  const loadNotes = async () => { setNotesLoading(true); try { setNotes(await clientsApi.getNotes(data.clientId)); } catch { /* */ } finally { setNotesLoading(false); } };
  const loadHistory = async () => { setHistoryLoading(true); try { setHistory(await clientsApi.getHistory(data.clientId)); } catch { /* */ } finally { setHistoryLoading(false); } };
  const loadPromos = async () => {
    setPromosLoading(true);
    try { const [a, all] = await Promise.all([promotionsApi.getClientPromos(data.clientId), promotionsApi.getAll({ scope: 'CLIENTE', activa: 'true' })]); setPromos(a); setAvailablePromos(all); }
    catch { /* */ } finally { setPromosLoading(false); }
  };
  const loadEquipment = async () => { setEquipLoading(true); try { setClientEquipment(await equipmentApi.getClientEquipment(data.clientId)); } catch { /* */ } finally { setEquipLoading(false); } };
  const loadTickets = async () => { setTicketsLoading(true); try { setClientTickets(await ticketsApi.getClientTickets(data.clientId)); } catch { /* */ } finally { setTicketsLoading(false); } };

  // Handlers
  const handlePayment = async () => {
    if (!payMonth || !paySubId) return;
    try { await clientsApi.createPayment(data.clientId, paySubId, payMonth.year(), payMonth.month() + 1); message.success('Pago registrado'); setPayMonth(null); onRefresh(); }
    catch (err) { message.error(getErrorMessage(err)); }
  };

  const handleWhatsApp = async () => {
    const msg = generarMensajeDeuda({ nombre: nombreNormalizado, deudaCable: data.deudaCable, deudaInternet: data.deudaInternet, cantidadDeuda: data.cantidadDeuda });
    window.open(generarLinkWhatsApp(d.telefono, msg), '_blank');
    try { await clientsApi.logWhatsApp(data.clientId); setLastWhatsApp({ sentAt: new Date().toISOString(), sentBy: 'Vos' }); } catch { /* */ }
  };

  const startFiscalEdit = () => {
    setFiscalForm({ tipoDocumento: d.tipoDocumento || '', numeroDocumento: d.numeroDocFiscal || '', condicionFiscal: d.condicionFiscal || 'CONSUMIDOR_FINAL', razonSocial: d.razonSocial || '', telefono: d.telefono || '', email: d.email || '' });
    setFiscalEditing(true);
  };
  const saveFiscal = async () => {
    setFiscalSaving(true);
    try { await fiscalApi.updateClientFiscal(data.clientId, fiscalForm); message.success('Datos actualizados'); setFiscalEditing(false); onRefresh(); }
    catch (err) { message.error(getErrorMessage(err)); } finally { setFiscalSaving(false); }
  };

  const searchEquip = async (s: string) => { if (!s || s.length < 2) return; setEquipSearching(true); try { const r = await equipmentApi.getAll({ estado: 'EN_DEPOSITO', search: s }); setEquipOptions((r.data || r).slice(0, 20)); } catch { /* */ } finally { setEquipSearching(false); } };

  return (
    <div>
      {/* Header actions */}
      <Space style={{ marginBottom: 12 }} wrap>
        {canOperate && estado === 'ACTIVO' && (
          <Button danger icon={<StopOutlined />} size="small" onClick={() => Modal.confirm({
            title: `Confirmar baja de ${nombreNormalizado}`, content: 'Se darán de baja todos sus servicios.', okText: 'Dar de baja', okType: 'danger',
            onOk: async () => { await clientsApi.deactivate(data.clientId); message.success('Dado de baja'); onRefresh(); },
          })}>Dar de baja</Button>
        )}
        {isAdmin && estado === 'BAJA' && <Button type="primary" icon={<PlayCircleOutlined />} size="small" onClick={async () => { await clientsApi.reactivate(data.clientId); message.success('Reactivado'); onRefresh(); }}>Reactivar</Button>}
        {d.telefono && data.cantidadDeuda > 0 && (
          <Space direction="vertical" size={0}>
            <Button icon={<WhatsAppOutlined />} size="small" style={{ color: '#25D366' }} onClick={handleWhatsApp}>WhatsApp</Button>
            {lastWhatsApp && <Typography.Text type="secondary" style={{ fontSize: 10 }}>Último: {dayjs(lastWhatsApp.sentAt).fromNow()}</Typography.Text>}
          </Space>
        )}
      </Space>

      {/* Info + Estado */}
      <Descriptions bordered size="small" column={1}>
        <Descriptions.Item label="Código">{codCli}</Descriptions.Item>
        <Descriptions.Item label="Nombre">{nombreNormalizado}</Descriptions.Item>
        {nombreOriginal !== nombreNormalizado && <Descriptions.Item label="Original"><Typography.Text type="secondary">{nombreOriginal}</Typography.Text></Descriptions.Item>}
        <Descriptions.Item label="Estado"><Tag color={estado === 'ACTIVO' ? 'blue' : 'default'}>{estado}</Tag> {requiereCorte && <Tag color="red" icon={<WarningOutlined />}>CORTE</Tag>}</Descriptions.Item>
        <Descriptions.Item label="Alta">{fechaAlta ? new Date(fechaAlta).toLocaleDateString('es-AR') : '—'}</Descriptions.Item>
        <Descriptions.Item label="Dirección">{calle || '—'}{d.zona ? ` · ${d.zona}` : ''}</Descriptions.Item>
      </Descriptions>

      {/* Tabs */}
      <Tabs style={{ marginTop: 16 }} size="small" defaultActiveKey="servicios" onChange={(key) => {
        if (key === 'notas' && notes.length === 0) loadNotes();
        if (key === 'historial' && history.length === 0) loadHistory();
        if (key === 'promos' && promos.length === 0) loadPromos();
        if (key === 'equipos' && clientEquipment.length === 0) loadEquipment();
        if (key === 'tickets' && clientTickets.length === 0) loadTickets();
      }} items={[
        // ── Servicios ──
        { key: 'servicios', label: '📊 Deuda', children: (
          <div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              {subscriptions.map((sub: any) => (
                <Card key={sub.subscriptionId} size="small" style={{ flex: 1, minWidth: 220, border: sub.requiereCorte ? '1px solid #ff4d4f' : undefined }}
                  title={<Space size={4}>{sub.tipo === 'CABLE' ? '📺' : '🌐'} {sub.tipo} {sub.requiereCorte && <Tag color="red" style={{ margin: 0, fontSize: 10 }}>CORTE</Tag>}</Space>}
                  extra={canOperate && estado === 'ACTIVO' && <Button type="link" danger size="small" onClick={() => Modal.confirm({ title: `Cancelar ${sub.tipo}?`, okText: 'Sí', okType: 'danger', onOk: async () => { await clientsApi.deactivateSub(data.clientId, sub.subscriptionId); message.success('Cancelado'); onRefresh(); } })}>Cancelar</Button>}>
                  <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
                    <div style={{ textAlign: 'center' }}><div style={{ fontSize: 24, fontWeight: 700, color: sub.cantidadDeuda > 0 ? '#f5222d' : '#52c41a' }}>{sub.cantidadDeuda}</div><div style={{ color: '#888', fontSize: 11 }}>deuda</div></div>
                    <div style={{ textAlign: 'center' }}><div style={{ fontSize: 24, fontWeight: 700, color: '#52c41a' }}>{sub.mesesPagados.length}</div><div style={{ color: '#888', fontSize: 11 }}>pagados</div></div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                    {sub.mesesObligatorios.slice(-12).map((m: string) => {
                      const pagado = sub.mesesPagados.includes(m); const pg = sub.mesesConPromoGratis?.includes(m);
                      const color = pg && !pagado ? 'purple' : pagado ? 'green' : 'red';
                      const ic = pagado || pg ? <CheckCircleFilled style={{ color: pg && !pagado ? '#722ed1' : '#52c41a', fontSize: 7 }} /> : <CloseCircleFilled style={{ color: '#f5222d', fontSize: 7 }} />;
                      return <Badge key={m} count={ic} offset={[-3, 0]}><Tag color={color} style={{ margin: 0, fontSize: 9 }}>{m}</Tag></Badge>;
                    })}
                  </div>
                </Card>
              ))}
            </div>
            {canOperate && activeSubs.length > 0 && estado === 'ACTIVO' && (
              <>
                <Divider orientation="left" style={{ fontSize: 12 }}>Registrar pago</Divider>
                <Space>
                  <Select placeholder="Servicio" size="small" style={{ width: 130 }} value={paySubId || undefined} onChange={setPaySubId} options={activeSubs.map((s: any) => ({ value: s.subscriptionId, label: s.tipo }))} />
                  <DatePicker picker="month" size="small" value={payMonth} onChange={setPayMonth} disabledDate={(dd) => dd.isAfter(dayjs())} format="MMM YYYY" placeholder="Mes" />
                  <Button type="primary" size="small" onClick={handlePayment} disabled={!payMonth || !paySubId}>Registrar</Button>
                </Space>
              </>
            )}
          </div>
        )},

        // ── Fiscal ──
        { key: 'fiscal', label: <><IdcardOutlined /> Fiscal</>, children: (
          <div>
            {canOperate && !fiscalEditing && <Button size="small" onClick={startFiscalEdit} style={{ marginBottom: 8 }}>Editar</Button>}
            {!fiscalEditing ? (
              <Descriptions bordered size="small" column={1}>
                <Descriptions.Item label="Tipo Doc">{d.tipoDocumento || '—'}</Descriptions.Item>
                <Descriptions.Item label="Nro Doc">{d.numeroDocFiscal || '—'}</Descriptions.Item>
                <Descriptions.Item label="Condición">{d.condicionFiscal || 'CONSUMIDOR_FINAL'}</Descriptions.Item>
                <Descriptions.Item label="Razón Social">{d.razonSocial || '—'}</Descriptions.Item>
                <Descriptions.Item label="Teléfono">{d.telefono || '—'}</Descriptions.Item>
                <Descriptions.Item label="Email">{d.email || '—'}</Descriptions.Item>
                <Descriptions.Item label="Zona">{d.zona || '—'}</Descriptions.Item>
                <Descriptions.Item label="Comprobante"><Tag color={d.tipoComprobante === 'FACTURA' ? 'blue' : 'default'}>{d.tipoComprobante || 'RAMITO'}</Tag></Descriptions.Item>
              </Descriptions>
            ) : (
              <Space direction="vertical" style={{ width: '100%' }} size={8}>
                <Select style={{ width: '100%' }} value={fiscalForm.tipoDocumento || undefined} onChange={(v) => setFiscalForm({ ...fiscalForm, tipoDocumento: v })} placeholder="Tipo doc" allowClear options={[{ value: 'CUIT', label: 'CUIT' }, { value: 'CUIL', label: 'CUIL' }, { value: 'DNI', label: 'DNI' }, { value: 'CONSUMIDOR_FINAL', label: 'Consumidor Final' }]} />
                <Input size="small" value={fiscalForm.numeroDocumento} onChange={(e) => setFiscalForm({ ...fiscalForm, numeroDocumento: e.target.value })} placeholder="Nro documento" />
                <Select style={{ width: '100%' }} value={fiscalForm.condicionFiscal} onChange={(v) => setFiscalForm({ ...fiscalForm, condicionFiscal: v })} options={[{ value: 'CONSUMIDOR_FINAL', label: 'Consumidor Final' }, { value: 'MONOTRIBUTISTA', label: 'Monotributista' }, { value: 'RESPONSABLE_INSCRIPTO', label: 'Responsable Inscripto' }, { value: 'EXENTO', label: 'Exento' }]} />
                <Input size="small" value={fiscalForm.razonSocial} onChange={(e) => setFiscalForm({ ...fiscalForm, razonSocial: e.target.value })} placeholder="Razón social" />
                <Input size="small" value={fiscalForm.telefono} onChange={(e) => setFiscalForm({ ...fiscalForm, telefono: e.target.value })} placeholder="Teléfono" />
                <Input size="small" value={fiscalForm.email} onChange={(e) => setFiscalForm({ ...fiscalForm, email: e.target.value })} placeholder="Email" />
                <Space><Button type="primary" size="small" onClick={saveFiscal} loading={fiscalSaving}>Guardar</Button><Button size="small" onClick={() => setFiscalEditing(false)}>Cancelar</Button></Space>
              </Space>
            )}
          </div>
        )},

        // ── Equipos ──
        { key: 'equipos', label: <><ToolOutlined /> Equipos</>, children: (
          <Spin spinning={equipLoading}>
            {canOperate && estado === 'ACTIVO' && (
              <Space.Compact style={{ width: '100%', marginBottom: 12 }}>
                <Select showSearch placeholder="Buscar equipo..." filterOption={false} onSearch={searchEquip} loading={equipSearching} style={{ flex: 1 }} size="small"
                  value={selectedEquipId || undefined} onChange={setSelectedEquipId} notFoundContent={equipSearching ? <Spin size="small" /> : 'Escribí para buscar'}>
                  {equipOptions.map((eq: any) => <Select.Option key={eq.id} value={eq.id}>{eq.tipo} {eq.marca && `${eq.marca}`} {eq.numeroSerie && `[${eq.numeroSerie}]`}</Select.Option>)}
                </Select>
                <Button type="primary" size="small" disabled={!selectedEquipId} onClick={async () => {
                  try { await equipmentApi.assign(data.clientId, selectedEquipId); message.success('Asignado'); setSelectedEquipId(''); setEquipOptions([]); loadEquipment(); } catch (err) { message.error(getErrorMessage(err)); }
                }}>Asignar</Button>
              </Space.Compact>
            )}
            {clientEquipment.length > 0 ? <List size="small" dataSource={clientEquipment} renderItem={(eq: any) => (
              <List.Item actions={canOperate && !eq.fechaRetiro ? [<Button size="small" type="link" danger onClick={async () => { try { await equipmentApi.retire(data.clientId, eq.id); message.success('Retirado'); loadEquipment(); } catch (err) { message.error(getErrorMessage(err)); } }}>Retirar</Button>] : undefined}>
                <List.Item.Meta title={<Space size={4}>{eq.equipment?.tipo} <Tag color={eq.fechaRetiro ? 'default' : 'blue'}>{eq.fechaRetiro ? 'Retirado' : 'Instalado'}</Tag></Space>}
                  description={<>{[eq.equipment?.marca, eq.equipment?.modelo].filter(Boolean).join(' ') || ''} {eq.equipment?.numeroSerie && <Typography.Text code style={{ fontSize: 11 }}>{eq.equipment.numeroSerie}</Typography.Text>}</>} />
              </List.Item>
            )} /> : !equipLoading && <Typography.Text type="secondary">Sin equipos.</Typography.Text>}
          </Spin>
        )},

        // ── Tickets ──
        { key: 'tickets', label: <><ExclamationCircleOutlined /> Tickets</>, children: (
          <Spin spinning={ticketsLoading}>
            {canOperate && estado === 'ACTIVO' && (
              <Space.Compact style={{ width: '100%', marginBottom: 12 }}>
                <Select placeholder="Tipo" size="small" style={{ width: 150 }} value={newTicketTipo || undefined} onChange={setNewTicketTipo}
                  options={[{ value: 'SIN_SENIAL', label: 'Sin señal' }, { value: 'LENTITUD_INTERNET', label: 'Lentitud' }, { value: 'RECONEXION', label: 'Reconexión' }, { value: 'INSTALACION', label: 'Instalación' }, { value: 'CAMBIO_EQUIPO', label: 'Cambio equipo' }, { value: 'OTRO', label: 'Otro' }]} />
                <Input size="small" placeholder="Descripción" value={newTicketDesc} onChange={(e) => setNewTicketDesc(e.target.value)} />
                <Button type="primary" size="small" disabled={!newTicketTipo} onClick={async () => {
                  try { await ticketsApi.create(data.clientId, newTicketTipo, newTicketDesc || undefined); message.success('Creado'); setNewTicketTipo(''); setNewTicketDesc(''); loadTickets(); } catch (err) { message.error(getErrorMessage(err)); }
                }}>Crear</Button>
              </Space.Compact>
            )}
            {clientTickets.length > 0 ? <List size="small" dataSource={clientTickets} renderItem={(t: any) => (
              <List.Item><Space size={4}><Tag color={t.estado === 'ABIERTO' ? 'red' : 'green'}>{t.estado}</Tag><Tag>{t.tipo.replace(/_/g, ' ')}</Tag><span style={{ fontSize: 12 }}>{t.descripcion || '—'}</span><Typography.Text type="secondary" style={{ fontSize: 11 }}>{dayjs(t.createdAt).fromNow()}</Typography.Text></Space></List.Item>
            )} /> : !ticketsLoading && <Typography.Text type="secondary">Sin tickets.</Typography.Text>}
          </Spin>
        )},

        // ── Notas ──
        { key: 'notas', label: <><MessageOutlined /> Notas</>, children: (
          <Spin spinning={notesLoading}>
            {canOperate && (
              <Space.Compact style={{ width: '100%', marginBottom: 12 }}>
                <Input.TextArea rows={2} maxLength={1000} value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Agregar nota..." />
                <Button type="primary" onClick={async () => { if (!noteText.trim()) return; try { await clientsApi.createNote(data.clientId, noteText.trim()); setNoteText(''); message.success('Agregada'); loadNotes(); } catch (err) { message.error(getErrorMessage(err)); } }} disabled={!noteText.trim()}>Agregar</Button>
              </Space.Compact>
            )}
            {notes.length > 0 ? notes.map((n) => (
              <div key={n.id} style={{ padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
                <Space size={4}><Typography.Text strong style={{ fontSize: 12 }}>{n.user.name}</Typography.Text><Typography.Text type="secondary" style={{ fontSize: 11 }}>{dayjs(n.createdAt).fromNow()}</Typography.Text>
                  {isAdmin && <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={async () => { try { await clientsApi.deleteNote(data.clientId, n.id); loadNotes(); } catch { message.error('Error'); } }} />}</Space>
                <div style={{ fontSize: 13 }}>{n.content}</div>
              </div>
            )) : !notesLoading && <Typography.Text type="secondary">Sin notas.</Typography.Text>}
          </Spin>
        )},

        // ── Historial ──
        { key: 'historial', label: <><HistoryOutlined /> Historial</>, children: (
          <Spin spinning={historyLoading}>
            {history.length > 0 ? <Timeline items={history.map((h) => ({ key: h.id, children: <div><Typography.Text strong style={{ fontSize: 12 }}>{ACTION_LABELS[h.action] || h.action}</Typography.Text><Typography.Text type="secondary" style={{ fontSize: 11, marginLeft: 6 }}>{h.user.name} — {dayjs(h.createdAt).fromNow()}</Typography.Text></div> }))} />
              : !historyLoading && <Typography.Text type="secondary">Sin historial.</Typography.Text>}
          </Spin>
        )},

        // ── Promociones ──
        { key: 'promos', label: <><ThunderboltOutlined /> Promos</>, children: (
          <Spin spinning={promosLoading}>
            {canOperate && estado === 'ACTIVO' && activeSubs.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                {availablePromos.length > 0 ? (
                  <Space wrap size={4}>
                    <Select placeholder="Suscripción" size="small" style={{ width: 120 }} value={selectedPromoSubId || undefined} onChange={setSelectedPromoSubId} options={activeSubs.map((s: any) => ({ value: s.subscriptionId, label: s.tipo }))} />
                    <Select placeholder="Promoción" size="small" style={{ width: 220 }} value={selectedPromoId || undefined} onChange={setSelectedPromoId}
                      options={availablePromos.map((p: any) => ({ value: p.id, label: `${p.nombre} (${p.tipo}${p.tipo === 'PORCENTAJE' ? ' ' + p.valor + '%' : p.tipo === 'MESES_GRATIS' ? '' : ' $' + p.valor})` }))} />
                    <Button type="primary" size="small" disabled={!selectedPromoId || !selectedPromoSubId} onClick={async () => {
                      try { await promotionsApi.assignToSub(data.clientId, selectedPromoSubId, selectedPromoId); message.success('Asignada'); setSelectedPromoId(''); setSelectedPromoSubId(''); loadPromos(); }
                      catch (err) { message.error(getErrorMessage(err)); }
                    }}>Asignar</Button>
                  </Space>
                ) : <Typography.Text type="secondary" style={{ fontSize: 12 }}>No hay promos CLIENTE activas.</Typography.Text>}
              </div>
            )}
            {promos.length > 0 ? <List size="small" dataSource={promos} renderItem={(p: any) => (
              <List.Item actions={isAdmin ? [<Button type="link" danger size="small" onClick={async () => { try { await promotionsApi.removeFromSub(data.clientId, p.subscriptionId, p.id); message.success('Removida'); loadPromos(); } catch (err) { message.error(getErrorMessage(err)); } }}>Quitar</Button>] : undefined}>
                <Space size={4}><Tag color="purple">{p.promotion?.tipo || p.tipo}</Tag><span style={{ fontSize: 12 }}>{p.promotion?.nombre || p.nombre}</span></Space>
              </List.Item>
            )} /> : !promosLoading && <Typography.Text type="secondary">Sin promociones.</Typography.Text>}
          </Spin>
        )},

        // ── Documentos ──
        { key: 'docs', label: <><FileTextOutlined /> Docs ({data.docPagination.total})</>, children: (
          documents.length > 0 ? (
            <Timeline items={documents.map((doc) => ({
              key: doc.id, color: doc.tipo === 'FACTURA' ? 'green' : 'blue',
              children: <div>
                <Space size={4}><Tag color={doc.tipo === 'FACTURA' ? 'green' : 'blue'} style={{ fontSize: 10 }}>{doc.tipo}</Tag>{doc.numeroDocumento && <Typography.Text code style={{ fontSize: 10 }}>{doc.numeroDocumento}</Typography.Text>}{doc.fechaDocumento && <Typography.Text type="secondary" style={{ fontSize: 10 }}>{new Date(doc.fechaDocumento).toLocaleDateString('es-AR')}</Typography.Text>}</Space>
                {doc.paymentPeriods.length > 0 && <div style={{ marginTop: 2 }}>{doc.paymentPeriods.map((pp) => <Tag key={`${pp.year}-${pp.month}`} color="cyan" style={{ fontSize: 10 }}>{pp.year}-{String(pp.month).padStart(2, '0')}</Tag>)}</div>}
              </div>,
            }))} />
          ) : <Typography.Text type="secondary">Sin documentos.</Typography.Text>
        )},
      ]} />
    </div>
  );
}
