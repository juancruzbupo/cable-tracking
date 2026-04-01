import { useState } from 'react';
import {
  Card, Select, Tag, Space, Typography, Button,
  message, Descriptions, Timeline, Badge, Divider,
  DatePicker, Modal, Collapse, Input, Spin, List,
} from 'antd';
import {
  WarningOutlined, CheckCircleFilled, CloseCircleFilled, FileTextOutlined,
  StopOutlined, PlayCircleOutlined, DeleteOutlined,
  HistoryOutlined, MessageOutlined, ThunderboltOutlined,
  IdcardOutlined, ToolOutlined, ExclamationCircleOutlined, WhatsAppOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/es';
import { clientsApi, promotionsApi, equipmentApi, ticketsApi, getErrorMessage } from '../../../../services/api';
import { useAuth } from '../../../../context/AuthContext';
import { generarMensajeDeuda, generarLinkWhatsApp } from '../../../../shared/utils/whatsapp';
import type { ClientDetailResult, ClientNote, AuditLogEntry } from '../../../../types';

dayjs.extend(relativeTime);
dayjs.locale('es');

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

export default function ClientDetail({ data, onRefresh }: { data: ClientDetailResult; onRefresh: () => void }) {
  const { nombreNormalizado, nombreOriginal, codCli, estado, fechaAlta, calle, requiereCorte, subscriptions, documents } = data;
  const { hasRole } = useAuth();
  const canOperate = hasRole('ADMIN', 'OPERADOR');
  const isAdmin = hasRole('ADMIN');

  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [history, setHistory] = useState<AuditLogEntry[]>([]);
  const [promos, setPromos] = useState<any[]>([]);
  const [clientEquipment, setClientEquipment] = useState<any[]>([]);
  const [clientTickets, setClientTickets] = useState<any[]>([]);
  const [newTicketTipo, setNewTicketTipo] = useState<string>('');
  const [newTicketDesc, setNewTicketDesc] = useState('');
  const [noteText, setNoteText] = useState('');
  const [payMonth, setPayMonth] = useState<dayjs.Dayjs | null>(null);
  const [paySubId, setPaySubId] = useState<string>('');

  const [notesLoading, setNotesLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [promosLoading, setPromosLoading] = useState(false);
  const [equipLoading, setEquipLoading] = useState(false);
  const [ticketsLoading, setTicketsLoading] = useState(false);

  const loadNotes = async () => { setNotesLoading(true); try { setNotes(await clientsApi.getNotes(data.clientId)); } catch { message.error('Error al cargar notas'); } finally { setNotesLoading(false); } };
  const loadHistory = async () => { setHistoryLoading(true); try { setHistory(await clientsApi.getHistory(data.clientId)); } catch { message.error('Error al cargar historial'); } finally { setHistoryLoading(false); } };
  const loadPromos = async () => { setPromosLoading(true); try { setPromos(await promotionsApi.getClientPromos(data.clientId)); } catch { message.error('Error al cargar promos'); } finally { setPromosLoading(false); } };
  const loadEquipment = async () => { setEquipLoading(true); try { setClientEquipment(await equipmentApi.getClientEquipment(data.clientId)); } catch { message.error('Error al cargar equipos'); } finally { setEquipLoading(false); } };
  const loadTickets = async () => { setTicketsLoading(true); try { setClientTickets(await ticketsApi.getClientTickets(data.clientId)); } catch { message.error('Error al cargar tickets'); } finally { setTicketsLoading(false); } };

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

  const activeSubs = subscriptions.filter((s: any) => s.tipo);

  return (
    <div>
      <Space style={{ marginBottom: 12 }}>
        {canOperate && estado === 'ACTIVO' && (
          <Button danger icon={<StopOutlined />} size="small" onClick={handleDeactivate}>Dar de baja</Button>
        )}
        {isAdmin && estado === 'BAJA' && (
          <Button type="primary" icon={<PlayCircleOutlined />} size="small" onClick={handleReactivate}>Reactivar</Button>
        )}
        {(data as any).telefono && data.cantidadDeuda > 0 && (
          <Button icon={<WhatsAppOutlined />} size="small" style={{ color: '#25D366' }}
            onClick={() => {
              const msg = generarMensajeDeuda({ nombre: nombreNormalizado, deudaCable: data.deudaCable, deudaInternet: data.deudaInternet, cantidadDeuda: data.cantidadDeuda });
              window.open(generarLinkWhatsApp((data as any).telefono, msg), '_blank');
            }}>WhatsApp</Button>
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
        {subscriptions.map((sub: any) => (
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
              {sub.mesesObligatorios.slice(-6).map((m: string) => {
                const pagado = sub.mesesPagados.includes(m);
                const promoGratis = sub.mesesConPromoGratis?.includes(m);
                const cubierto = pagado || promoGratis;
                const color = promoGratis && !pagado ? 'purple' : pagado ? 'green' : 'red';
                const icon = cubierto ? <CheckCircleFilled style={{ color: promoGratis && !pagado ? '#722ed1' : '#52c41a', fontSize: 8 }} /> : <CloseCircleFilled style={{ color: '#f5222d', fontSize: 8 }} />;
                return (<Badge key={m} count={icon} offset={[-4, 0]}><Tag color={color} style={{ margin: 0, fontSize: 10 }}>{m}</Tag></Badge>);
              })}
            </div>
          </Card>
        ))}
      </div>

      {canOperate && activeSubs.length > 0 && estado === 'ACTIVO' && (
        <>
          <Divider orientation="left">Registrar pago manual</Divider>
          <Space>
            <Select placeholder="Servicio" style={{ width: 140 }} value={paySubId || undefined} onChange={setPaySubId}
              options={activeSubs.map((s: any) => ({ value: s.subscriptionId, label: s.tipo }))} />
            <DatePicker picker="month" value={payMonth} onChange={setPayMonth} disabledDate={(d) => d.isAfter(dayjs())} format="MMM YYYY" placeholder="Mes a pagar" />
            <Button type="primary" size="small" onClick={handlePayment} disabled={!payMonth || !paySubId}>Registrar</Button>
          </Space>
        </>
      )}

      <Collapse style={{ marginTop: 16 }} items={[
        {
          key: 'notes', label: <><MessageOutlined /> Notas</>,
          children: (
            <Spin spinning={notesLoading}>
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
                    {isAdmin && <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={async () => { try { await clientsApi.deleteNote(data.clientId, n.id); loadNotes(); } catch (err) { message.error('Error al eliminar nota'); } }} />}
                  </Space>
                  <div style={{ fontSize: 13 }}>{n.content}</div>
                </div>
              ))}
              {notes.length === 0 && !notesLoading && <Typography.Text type="secondary">Sin notas.</Typography.Text>}
            </div>
            </Spin>
          ),
          onExpand: (_e: any, expanded: boolean) => { if (expanded) loadNotes(); },
        } as any,
        {
          key: 'history', label: <><HistoryOutlined /> Historial</>,
          children: (
            <Spin spinning={historyLoading}>
            <Timeline items={history.map((h) => ({
              key: h.id,
              children: (
                <div>
                  <Typography.Text strong style={{ fontSize: 12 }}>{ACTION_LABELS[h.action] || h.action}</Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>{h.user.name} — {dayjs(h.createdAt).fromNow()}</Typography.Text>
                </div>
              ),
            }))} />
            </Spin>
          ),
          onExpand: (_e: any, expanded: boolean) => { if (expanded) loadHistory(); },
        } as any,
        {
          key: 'promos', label: <><ThunderboltOutlined /> Promociones</>,
          children: (
            <Spin spinning={promosLoading}>
              {promos.length > 0 ? (
                <List size="small" dataSource={promos} renderItem={(p: any) => (
                  <List.Item>
                    <Space>
                      <Tag color="purple">{p.promotion?.tipo || p.tipo}</Tag>
                      <span>{p.promotion?.nombre || p.nombre}</span>
                      {p.promotion?.fechaFin && <Typography.Text type="secondary">hasta {dayjs(p.promotion.fechaFin).format('DD/MM/YYYY')}</Typography.Text>}
                    </Space>
                  </List.Item>
                )} />
              ) : !promosLoading && <Typography.Text type="secondary">Sin promociones asignadas.</Typography.Text>}
            </Spin>
          ),
          onExpand: (_e: any, expanded: boolean) => { if (expanded) loadPromos(); },
        } as any,
        {
          key: 'fiscal', label: <><IdcardOutlined /> Datos Fiscales</>,
          children: (
            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label="Tipo Doc">{(data as any).tipoDocumento || '—'}</Descriptions.Item>
              <Descriptions.Item label="Nro Doc">{(data as any).numeroDocFiscal || '—'}</Descriptions.Item>
              <Descriptions.Item label="Condición">{(data as any).condicionFiscal || 'CONSUMIDOR_FINAL'}</Descriptions.Item>
              <Descriptions.Item label="Razón Social">{(data as any).razonSocial || '—'}</Descriptions.Item>
              <Descriptions.Item label="Teléfono">{(data as any).telefono || '—'}</Descriptions.Item>
              <Descriptions.Item label="Email">{(data as any).email || '—'}</Descriptions.Item>
              <Descriptions.Item label="Zona">{(data as any).zona || '—'}</Descriptions.Item>
              <Descriptions.Item label="Comprobante">
                <Tag color={(data as any).tipoComprobante === 'FACTURA' ? 'blue' : 'default'}>{(data as any).tipoComprobante || 'RAMITO'}</Tag>
              </Descriptions.Item>
            </Descriptions>
          ),
        } as any,
        {
          key: 'equipment', label: <><ToolOutlined /> Equipos</>,
          children: (
            <Spin spinning={equipLoading}>
              {clientEquipment.length > 0 ? (
                <List size="small" dataSource={clientEquipment} renderItem={(eq: any) => (
                  <List.Item actions={canOperate && !eq.fechaRetiro ? [
                    <Button size="small" type="link" danger onClick={async () => {
                      try { await equipmentApi.retire(data.clientId, eq.id); message.success('Equipo retirado'); loadEquipment(); } catch (err) { message.error(getErrorMessage(err)); }
                    }}>Retirar</Button>
                  ] : undefined}>
                    <List.Item.Meta
                      title={<Space>{eq.equipment?.tipo} <Tag>{eq.equipment?.estado}</Tag> {eq.fechaRetiro && <Tag color="default">Retirado</Tag>}</Space>}
                      description={<>{eq.equipment?.marca} {eq.equipment?.modelo} {eq.equipment?.numeroSerie && <Typography.Text code>{eq.equipment.numeroSerie}</Typography.Text>}</>}
                    />
                  </List.Item>
                )} />
              ) : !equipLoading && <Typography.Text type="secondary">Sin equipos asignados.</Typography.Text>}
            </Spin>
          ),
          onExpand: (_e: any, expanded: boolean) => { if (expanded) loadEquipment(); },
        } as any,
        {
          key: 'tickets', label: <><ExclamationCircleOutlined /> Tickets</>,
          children: (
            <Spin spinning={ticketsLoading}>
              {canOperate && estado === 'ACTIVO' && (
                <Space.Compact style={{ width: '100%', marginBottom: 8 }}>
                  <Select placeholder="Tipo" style={{ width: 160 }} value={newTicketTipo || undefined} onChange={setNewTicketTipo}
                    options={[
                      { value: 'SIN_SENIAL', label: 'Sin señal' },
                      { value: 'LENTITUD_INTERNET', label: 'Lentitud internet' },
                      { value: 'RECONEXION', label: 'Reconexión' },
                      { value: 'INSTALACION', label: 'Instalación' },
                      { value: 'CAMBIO_EQUIPO', label: 'Cambio equipo' },
                      { value: 'OTRO', label: 'Otro' },
                    ]} />
                  <Input placeholder="Descripción (opcional)" value={newTicketDesc} onChange={(e) => setNewTicketDesc(e.target.value)} />
                  <Button type="primary" disabled={!newTicketTipo} onClick={async () => {
                    try { await ticketsApi.create(data.clientId, newTicketTipo, newTicketDesc || undefined); message.success('Ticket creado'); setNewTicketTipo(''); setNewTicketDesc(''); loadTickets(); } catch (err) { message.error(getErrorMessage(err)); }
                  }}>Crear</Button>
                </Space.Compact>
              )}
              {clientTickets.length > 0 ? (
                <List size="small" dataSource={clientTickets} renderItem={(t: any) => (
                  <List.Item>
                    <Space>
                      <Tag color={t.estado === 'ABIERTO' ? 'red' : 'green'}>{t.estado}</Tag>
                      <Tag>{t.tipo}</Tag>
                      <span>{t.descripcion || '—'}</span>
                      <Typography.Text type="secondary">{dayjs(t.createdAt).fromNow()}</Typography.Text>
                    </Space>
                  </List.Item>
                )} />
              ) : !ticketsLoading && <Typography.Text type="secondary">Sin tickets.</Typography.Text>}
            </Spin>
          ),
          onExpand: (_e: any, expanded: boolean) => { if (expanded) loadTickets(); },
        } as any,
      ]} />

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
