import { useReducer } from 'react';
import {
  Card, Select, Tag, Space, Typography, Button, Tabs, Switch,
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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

// ── useReducer types ──────────────────────────────────────────────────────

interface DrawerUIState {
  activeTab: string;
  noteText: string;
  payMonth: dayjs.Dayjs | null;
  paySubId: string;
  newTicketTipo: string;
  newTicketDesc: string;
  selectedPromoId: string;
  selectedPromoSubId: string;
  selectedEquipId: string;
  fiscalEditing: boolean;
  fiscalSaving: boolean;
  fiscalForm: Record<string, string>;
  equipOptions: any[];
  equipSearching: boolean;
}

const initialState: DrawerUIState = {
  activeTab: 'servicios',
  noteText: '',
  payMonth: null,
  paySubId: '',
  newTicketTipo: '',
  newTicketDesc: '',
  selectedPromoId: '',
  selectedPromoSubId: '',
  selectedEquipId: '',
  fiscalEditing: false,
  fiscalSaving: false,
  fiscalForm: {},
  equipOptions: [],
  equipSearching: false,
};

type DrawerAction =
  | { type: 'SET_TAB'; payload: string }
  | { type: 'SET_NOTE_TEXT'; payload: string }
  | { type: 'SET_PAY'; payload: { month?: dayjs.Dayjs | null; subId?: string } }
  | { type: 'RESET_PAYMENT' }
  | { type: 'SET_TICKET'; payload: { tipo?: string; desc?: string } }
  | { type: 'RESET_TICKET' }
  | { type: 'SET_PROMO'; payload: { promoId?: string; subId?: string } }
  | { type: 'SET_EQUIP_ID'; payload: string }
  | { type: 'SET_EQUIP_OPTIONS'; payload: any[] }
  | { type: 'SET_EQUIP_SEARCHING'; payload: boolean }
  | { type: 'START_FISCAL_EDIT'; payload: Record<string, string> }
  | { type: 'UPDATE_FISCAL_FIELD'; payload: { field: string; value: string } }
  | { type: 'SET_FISCAL_SAVING'; payload: boolean }
  | { type: 'CANCEL_FISCAL_EDIT' };

function drawerReducer(state: DrawerUIState, action: DrawerAction): DrawerUIState {
  switch (action.type) {
    case 'SET_TAB':
      return { ...state, activeTab: action.payload };
    case 'SET_NOTE_TEXT':
      return { ...state, noteText: action.payload };
    case 'SET_PAY':
      return {
        ...state,
        payMonth: action.payload.month !== undefined ? action.payload.month : state.payMonth,
        paySubId: action.payload.subId !== undefined ? action.payload.subId : state.paySubId,
      };
    case 'RESET_PAYMENT':
      return { ...state, payMonth: null, paySubId: '' };
    case 'SET_TICKET':
      return {
        ...state,
        newTicketTipo: action.payload.tipo !== undefined ? action.payload.tipo : state.newTicketTipo,
        newTicketDesc: action.payload.desc !== undefined ? action.payload.desc : state.newTicketDesc,
      };
    case 'RESET_TICKET':
      return { ...state, newTicketTipo: '', newTicketDesc: '' };
    case 'SET_PROMO':
      return {
        ...state,
        selectedPromoId: action.payload.promoId !== undefined ? action.payload.promoId : state.selectedPromoId,
        selectedPromoSubId: action.payload.subId !== undefined ? action.payload.subId : state.selectedPromoSubId,
      };
    case 'SET_EQUIP_ID':
      return { ...state, selectedEquipId: action.payload };
    case 'SET_EQUIP_OPTIONS':
      return { ...state, equipOptions: action.payload };
    case 'SET_EQUIP_SEARCHING':
      return { ...state, equipSearching: action.payload };
    case 'START_FISCAL_EDIT':
      return { ...state, fiscalEditing: true, fiscalForm: action.payload };
    case 'UPDATE_FISCAL_FIELD':
      return { ...state, fiscalForm: { ...state.fiscalForm, [action.payload.field]: action.payload.value } };
    case 'SET_FISCAL_SAVING':
      return { ...state, fiscalSaving: action.payload };
    case 'CANCEL_FISCAL_EDIT':
      return { ...state, fiscalEditing: false, fiscalForm: {} };
    default:
      return state;
  }
}

// ── Component ─────────────────────────────────────────────────────────────

export default function ClientDetail({ data, onRefresh }: { data: ClientDetailResult; onRefresh: () => void }) {
  const { nombreNormalizado, nombreOriginal, codCli, estado, fechaAlta, calle, requiereCorte, subscriptions, documents } = data;
  const { hasRole } = useAuth();
  const canOperate = hasRole('ADMIN', 'OPERADOR');
  const isAdmin = hasRole('ADMIN');
  const d = data;
  const activeSubs = subscriptions.filter((s: any) => s.tipo);
  const queryClient = useQueryClient();

  const [state, dispatch] = useReducer(drawerReducer, initialState);

  // ── React Query: tab data ─────────────────────────────────────────────

  const { data: notes = [], isLoading: notesLoading } = useQuery({
    queryKey: ['clientNotes', data.clientId],
    queryFn: () => clientsApi.getNotes(data.clientId),
    enabled: state.activeTab === 'notas',
  });

  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: ['clientHistory', data.clientId],
    queryFn: () => clientsApi.getHistory(data.clientId),
    enabled: state.activeTab === 'historial',
  });

  const { data: promosData, isLoading: promosLoading } = useQuery({
    queryKey: ['clientPromos', data.clientId],
    queryFn: async () => {
      const [assigned, all] = await Promise.all([
        promotionsApi.getClientPromos(data.clientId),
        promotionsApi.getAll({ scope: 'CLIENTE', activa: 'true' }),
      ]);
      return { promos: assigned, availablePromos: all };
    },
    enabled: state.activeTab === 'promos',
  });
  const promos = promosData?.promos ?? [];
  const availablePromos = promosData?.availablePromos ?? [];

  const { data: clientEquipment = [], isLoading: equipLoading } = useQuery({
    queryKey: ['clientEquipment', data.clientId],
    queryFn: () => equipmentApi.getClientEquipment(data.clientId),
    enabled: state.activeTab === 'equipos',
  });

  const { data: clientTickets = [], isLoading: ticketsLoading } = useQuery({
    queryKey: ['clientTickets', data.clientId],
    queryFn: () => ticketsApi.getClientTickets(data.clientId),
    enabled: state.activeTab === 'tickets',
  });

  const { data: lastWhatsApp = null } = useQuery({
    queryKey: ['clientWhatsApp', data.clientId],
    queryFn: () => clientsApi.getLastWhatsApp(data.clientId).catch(() => null),
  });

  // ── Mutations ─────────────────────────────────────────────────────────

  const invalidateClient = () => {
    onRefresh();
  };

  const paymentMutation = useMutation({
    mutationFn: () => clientsApi.createPayment(data.clientId, state.paySubId, state.payMonth!.year(), state.payMonth!.month() + 1),
    onSuccess: () => {
      message.success('Pago registrado');
      dispatch({ type: 'RESET_PAYMENT' });
      invalidateClient();
    },
    onError: (err) => message.error(getErrorMessage(err)),
  });

  const deactivateMutation = useMutation({
    mutationFn: () => clientsApi.deactivate(data.clientId),
    onSuccess: () => { message.success('Dado de baja'); invalidateClient(); },
    onError: (err) => message.error(getErrorMessage(err)),
  });

  const reactivateMutation = useMutation({
    mutationFn: () => clientsApi.reactivate(data.clientId),
    onSuccess: () => { message.success('Reactivado'); invalidateClient(); },
    onError: (err) => message.error(getErrorMessage(err)),
  });

  const deactivateSubMutation = useMutation({
    mutationFn: (subId: string) => clientsApi.deactivateSub(data.clientId, subId),
    onSuccess: () => { message.success('Cancelado'); invalidateClient(); },
    onError: (err) => message.error(getErrorMessage(err)),
  });

  const createNoteMutation = useMutation({
    mutationFn: (content: string) => clientsApi.createNote(data.clientId, content),
    onSuccess: () => {
      dispatch({ type: 'SET_NOTE_TEXT', payload: '' });
      message.success('Agregada');
      queryClient.invalidateQueries({ queryKey: ['clientNotes', data.clientId] });
    },
    onError: (err) => message.error(getErrorMessage(err)),
  });

  const deleteNoteMutation = useMutation({
    mutationFn: (noteId: string) => clientsApi.deleteNote(data.clientId, noteId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clientNotes', data.clientId] }),
    onError: () => message.error('Error'),
  });

  const logWhatsAppMutation = useMutation({
    mutationFn: () => clientsApi.logWhatsApp(data.clientId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clientWhatsApp', data.clientId] }),
  });

  const assignPromoMutation = useMutation({
    mutationFn: () => promotionsApi.assignToSub(data.clientId, state.selectedPromoSubId, state.selectedPromoId),
    onSuccess: () => {
      message.success('Asignada');
      dispatch({ type: 'SET_PROMO', payload: { promoId: '', subId: '' } });
      queryClient.invalidateQueries({ queryKey: ['clientPromos', data.clientId] });
    },
    onError: (err) => message.error(getErrorMessage(err)),
  });

  const removePromoMutation = useMutation({
    mutationFn: ({ subId, promoId }: { subId: string; promoId: string }) => promotionsApi.removeFromSub(data.clientId, subId, promoId),
    onSuccess: () => {
      message.success('Removida');
      queryClient.invalidateQueries({ queryKey: ['clientPromos', data.clientId] });
    },
    onError: (err) => message.error(getErrorMessage(err)),
  });

  const assignEquipMutation = useMutation({
    mutationFn: () => equipmentApi.assign(data.clientId, state.selectedEquipId),
    onSuccess: () => {
      message.success('Asignado');
      dispatch({ type: 'SET_EQUIP_ID', payload: '' });
      dispatch({ type: 'SET_EQUIP_OPTIONS', payload: [] });
      queryClient.invalidateQueries({ queryKey: ['clientEquipment', data.clientId] });
    },
    onError: (err) => message.error(getErrorMessage(err)),
  });

  const retireEquipMutation = useMutation({
    mutationFn: (assignmentId: string) => equipmentApi.retire(data.clientId, assignmentId),
    onSuccess: () => {
      message.success('Retirado');
      queryClient.invalidateQueries({ queryKey: ['clientEquipment', data.clientId] });
    },
    onError: (err) => message.error(getErrorMessage(err)),
  });

  const createTicketMutation = useMutation({
    mutationFn: () => ticketsApi.create(data.clientId, state.newTicketTipo, state.newTicketDesc || undefined),
    onSuccess: () => {
      message.success('Creado');
      dispatch({ type: 'RESET_TICKET' });
      queryClient.invalidateQueries({ queryKey: ['clientTickets', data.clientId] });
    },
    onError: (err) => message.error(getErrorMessage(err)),
  });

  const saveFiscalMutation = useMutation({
    mutationFn: () => fiscalApi.updateClientFiscal(data.clientId, state.fiscalForm),
    onSuccess: () => {
      message.success('Datos actualizados');
      dispatch({ type: 'CANCEL_FISCAL_EDIT' });
      invalidateClient();
    },
    onError: (err) => message.error(getErrorMessage(err)),
  });

  const updateComprobanteMutation = useMutation({
    mutationFn: (tipoComprobante: string) => clientsApi.updateComprobanteConfig(data.clientId, { tipoComprobante }),
    onSuccess: (_, tipoComprobante) => {
      message.success(`Comprobante: ${tipoComprobante}`);
      invalidateClient();
    },
    onError: (err) => message.error(getErrorMessage(err)),
  });

  // ── Handlers ──────────────────────────────────────────────────────────

  const handlePayment = () => {
    if (!state.payMonth || !state.paySubId) return;
    paymentMutation.mutate();
  };

  const handleWhatsApp = async () => {
    const msg = generarMensajeDeuda({ nombre: nombreNormalizado, deudaCable: data.deudaCable, deudaInternet: data.deudaInternet, cantidadDeuda: data.cantidadDeuda });
    window.open(generarLinkWhatsApp(d.telefono!, msg), '_blank');
    logWhatsAppMutation.mutate();
  };

  const startFiscalEdit = () => {
    dispatch({
      type: 'START_FISCAL_EDIT',
      payload: {
        tipoDocumento: d.tipoDocumento || '',
        numeroDocumento: d.numeroDocFiscal || '',
        condicionFiscal: d.condicionFiscal || 'CONSUMIDOR_FINAL',
        razonSocial: d.razonSocial || '',
        telefono: d.telefono || '',
        email: d.email || '',
      },
    });
  };

  const searchEquip = async (s: string) => {
    if (!s || s.length < 2) return;
    dispatch({ type: 'SET_EQUIP_SEARCHING', payload: true });
    try {
      const r = await equipmentApi.getAll({ estado: 'EN_DEPOSITO', search: s });
      dispatch({ type: 'SET_EQUIP_OPTIONS', payload: (r.data || r).slice(0, 20) });
    } catch { /* */ }
    finally { dispatch({ type: 'SET_EQUIP_SEARCHING', payload: false }); }
  };

  return (
    <div>
      {/* Header actions */}
      <Space style={{ marginBottom: 12 }} wrap>
        {canOperate && estado === 'ACTIVO' && (
          <Button danger icon={<StopOutlined />} size="small" onClick={() => Modal.confirm({
            title: `Confirmar baja de ${nombreNormalizado}`, content: 'Se daran de baja todos sus servicios.', okText: 'Dar de baja', okType: 'danger',
            onOk: () => deactivateMutation.mutateAsync(),
          })}>Dar de baja</Button>
        )}
        {isAdmin && estado === 'BAJA' && <Button type="primary" icon={<PlayCircleOutlined />} size="small" onClick={() => reactivateMutation.mutate()}>Reactivar</Button>}
        {d.telefono && data.cantidadDeuda > 0 && (
          <Space direction="vertical" size={0}>
            <Button icon={<WhatsAppOutlined />} size="small" style={{ color: '#25D366' }} onClick={handleWhatsApp}>WhatsApp</Button>
            {lastWhatsApp && <Typography.Text type="secondary" style={{ fontSize: 10 }}>Ultimo: {dayjs(lastWhatsApp.sentAt).fromNow()}</Typography.Text>}
          </Space>
        )}
      </Space>

      {/* Info + Estado */}
      <Descriptions bordered size="small" column={1}>
        <Descriptions.Item label="Codigo">{codCli}</Descriptions.Item>
        <Descriptions.Item label="Nombre">{nombreNormalizado}</Descriptions.Item>
        {nombreOriginal !== nombreNormalizado && <Descriptions.Item label="Original"><Typography.Text type="secondary">{nombreOriginal}</Typography.Text></Descriptions.Item>}
        <Descriptions.Item label="Estado"><Tag color={estado === 'ACTIVO' ? 'blue' : 'default'}>{estado}</Tag> {requiereCorte && <Tag color="red" icon={<WarningOutlined />}>CORTE</Tag>}</Descriptions.Item>
        <Descriptions.Item label="Alta">{fechaAlta ? new Date(fechaAlta).toLocaleDateString('es-AR') : '\u2014'}</Descriptions.Item>
        <Descriptions.Item label="Direccion">{calle || '\u2014'}{d.zona ? ` \u00B7 ${d.zona}` : ''}</Descriptions.Item>
      </Descriptions>

      {/* Tabs */}
      <Tabs style={{ marginTop: 16 }} size="small" activeKey={state.activeTab} onChange={(key) => dispatch({ type: 'SET_TAB', payload: key })} items={[
        // -- Servicios --
        { key: 'servicios', label: '\uD83D\uDCCA Deuda', children: (
          <div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              {subscriptions.map((sub: any) => (
                <Card key={sub.subscriptionId} size="small" style={{ flex: 1, minWidth: 0, border: sub.requiereCorte ? '1px solid #ff4d4f' : undefined }}
                  title={<Space size={4}>{sub.tipo === 'CABLE' ? '\uD83D\uDCFA' : '\uD83C\uDF10'} {sub.tipo} {sub.requiereCorte && <Tag color="red" style={{ margin: 0, fontSize: 10 }}>CORTE</Tag>}</Space>}
                  extra={canOperate && estado === 'ACTIVO' && <Button type="link" danger size="small" onClick={() => Modal.confirm({ title: `Cancelar ${sub.tipo}?`, okText: 'Si', okType: 'danger', onOk: () => deactivateSubMutation.mutateAsync(sub.subscriptionId) })}>Cancelar</Button>}>
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
                  <Select placeholder="Servicio" size="small" style={{ width: 130 }} value={state.paySubId || undefined} onChange={(v) => dispatch({ type: 'SET_PAY', payload: { subId: v } })} options={activeSubs.map((s: any) => ({ value: s.subscriptionId, label: s.tipo }))} />
                  <DatePicker picker="month" size="small" value={state.payMonth} onChange={(v) => dispatch({ type: 'SET_PAY', payload: { month: v } })} disabledDate={(dd) => dd.isAfter(dayjs())} format="MMM YYYY" placeholder="Mes" />
                  <Button type="primary" size="small" onClick={handlePayment} disabled={!state.payMonth || !state.paySubId} loading={paymentMutation.isPending}>Registrar</Button>
                </Space>
              </>
            )}
          </div>
        )},

        // -- Fiscal --
        { key: 'fiscal', label: <><IdcardOutlined /> Fiscal</>, children: (
          <div>
            {canOperate && !state.fiscalEditing && <Button size="small" onClick={startFiscalEdit} style={{ marginBottom: 8 }}>Editar</Button>}
            {!state.fiscalEditing ? (
              <Descriptions bordered size="small" column={1}>
                <Descriptions.Item label="Tipo Doc">{d.tipoDocumento || '\u2014'}</Descriptions.Item>
                <Descriptions.Item label="Nro Doc">{d.numeroDocFiscal || '\u2014'}</Descriptions.Item>
                <Descriptions.Item label="Condicion">{d.condicionFiscal || 'CONSUMIDOR_FINAL'}</Descriptions.Item>
                <Descriptions.Item label="Razon Social">{d.razonSocial || '\u2014'}</Descriptions.Item>
                <Descriptions.Item label="Telefono">{d.telefono || '\u2014'}</Descriptions.Item>
                <Descriptions.Item label="Email">{d.email || '\u2014'}</Descriptions.Item>
                <Descriptions.Item label="Zona">{d.zona || '\u2014'}</Descriptions.Item>
                <Descriptions.Item label="Comprobante">
                  <Space>
                    <Tag color={d.tipoComprobante === 'FACTURA' ? 'blue' : 'default'}>{d.tipoComprobante || 'RAMITO'}</Tag>
                    {canOperate && (
                      <Switch size="small" checked={d.tipoComprobante === 'FACTURA'}
                        checkedChildren="Factura" unCheckedChildren="Ramito"
                        onChange={(checked) => updateComprobanteMutation.mutate(checked ? 'FACTURA' : 'RAMITO')} />
                    )}
                  </Space>
                </Descriptions.Item>
              </Descriptions>
            ) : (
              <Space direction="vertical" style={{ width: '100%' }} size={8}>
                <Select style={{ width: '100%' }} value={state.fiscalForm.tipoDocumento || undefined} onChange={(v) => dispatch({ type: 'UPDATE_FISCAL_FIELD', payload: { field: 'tipoDocumento', value: v } })} placeholder="Tipo doc" allowClear options={[{ value: 'CUIT', label: 'CUIT' }, { value: 'CUIL', label: 'CUIL' }, { value: 'DNI', label: 'DNI' }, { value: 'CONSUMIDOR_FINAL', label: 'Consumidor Final' }]} />
                <Input size="small" value={state.fiscalForm.numeroDocumento} onChange={(e) => dispatch({ type: 'UPDATE_FISCAL_FIELD', payload: { field: 'numeroDocumento', value: e.target.value } })} placeholder="Nro documento" />
                <Select style={{ width: '100%' }} value={state.fiscalForm.condicionFiscal} onChange={(v) => dispatch({ type: 'UPDATE_FISCAL_FIELD', payload: { field: 'condicionFiscal', value: v } })} options={[{ value: 'CONSUMIDOR_FINAL', label: 'Consumidor Final' }, { value: 'MONOTRIBUTISTA', label: 'Monotributista' }, { value: 'RESPONSABLE_INSCRIPTO', label: 'Responsable Inscripto' }, { value: 'EXENTO', label: 'Exento' }]} />
                <Input size="small" value={state.fiscalForm.razonSocial} onChange={(e) => dispatch({ type: 'UPDATE_FISCAL_FIELD', payload: { field: 'razonSocial', value: e.target.value } })} placeholder="Razon social" />
                <Input size="small" value={state.fiscalForm.telefono} onChange={(e) => dispatch({ type: 'UPDATE_FISCAL_FIELD', payload: { field: 'telefono', value: e.target.value } })} placeholder="Telefono" />
                <Input size="small" value={state.fiscalForm.email} onChange={(e) => dispatch({ type: 'UPDATE_FISCAL_FIELD', payload: { field: 'email', value: e.target.value } })} placeholder="Email" />
                <Space><Button type="primary" size="small" onClick={() => saveFiscalMutation.mutate()} loading={saveFiscalMutation.isPending}>Guardar</Button><Button size="small" onClick={() => dispatch({ type: 'CANCEL_FISCAL_EDIT' })}>Cancelar</Button></Space>
              </Space>
            )}
          </div>
        )},

        // -- Equipos --
        { key: 'equipos', label: <><ToolOutlined /> Equipos</>, children: (
          <Spin spinning={equipLoading}>
            {canOperate && estado === 'ACTIVO' && (
              <Space.Compact style={{ width: '100%', marginBottom: 12 }}>
                <Select showSearch placeholder="Buscar equipo..." filterOption={false} onSearch={searchEquip} loading={state.equipSearching} style={{ flex: 1 }} size="small"
                  value={state.selectedEquipId || undefined} onChange={(v) => dispatch({ type: 'SET_EQUIP_ID', payload: v })} notFoundContent={state.equipSearching ? <Spin size="small" /> : 'Escribi para buscar'}>
                  {state.equipOptions.map((eq: any) => <Select.Option key={eq.id} value={eq.id}>{eq.tipo} {eq.marca && `${eq.marca}`} {eq.numeroSerie && `[${eq.numeroSerie}]`}</Select.Option>)}
                </Select>
                <Button type="primary" size="small" disabled={!state.selectedEquipId} loading={assignEquipMutation.isPending} onClick={() => assignEquipMutation.mutate()}>Asignar</Button>
              </Space.Compact>
            )}
            {clientEquipment.length > 0 ? <List size="small" dataSource={clientEquipment} renderItem={(eq: any) => (
              <List.Item actions={canOperate && !eq.fechaRetiro ? [<Button size="small" type="link" danger onClick={() => Modal.confirm({ title: 'Retirar este equipo?', okText: 'Retirar', okType: 'danger', onOk: () => retireEquipMutation.mutateAsync(eq.id) })}>Retirar</Button>] : undefined}>
                <List.Item.Meta title={<Space size={4}>{eq.equipment?.tipo} <Tag color={eq.fechaRetiro ? 'default' : 'blue'}>{eq.fechaRetiro ? 'Retirado' : 'Instalado'}</Tag></Space>}
                  description={<>{[eq.equipment?.marca, eq.equipment?.modelo].filter(Boolean).join(' ') || ''} {eq.equipment?.numeroSerie && <Typography.Text code style={{ fontSize: 11 }}>{eq.equipment.numeroSerie}</Typography.Text>}</>} />
              </List.Item>
            )} /> : !equipLoading && <Typography.Text type="secondary">Sin equipos.</Typography.Text>}
          </Spin>
        )},

        // -- Tickets --
        { key: 'tickets', label: <><ExclamationCircleOutlined /> Tickets</>, children: (
          <Spin spinning={ticketsLoading}>
            {canOperate && estado === 'ACTIVO' && (
              <Space.Compact style={{ width: '100%', marginBottom: 12 }}>
                <Select placeholder="Tipo" size="small" style={{ width: 150 }} value={state.newTicketTipo || undefined} onChange={(v) => dispatch({ type: 'SET_TICKET', payload: { tipo: v } })}
                  options={[{ value: 'SIN_SENIAL', label: 'Sin senal' }, { value: 'LENTITUD_INTERNET', label: 'Lentitud' }, { value: 'RECONEXION', label: 'Reconexion' }, { value: 'INSTALACION', label: 'Instalacion' }, { value: 'CAMBIO_EQUIPO', label: 'Cambio equipo' }, { value: 'OTRO', label: 'Otro' }]} />
                <Input size="small" placeholder="Descripcion" value={state.newTicketDesc} onChange={(e) => dispatch({ type: 'SET_TICKET', payload: { desc: e.target.value } })} />
                <Button type="primary" size="small" disabled={!state.newTicketTipo} loading={createTicketMutation.isPending} onClick={() => createTicketMutation.mutate()}>Crear</Button>
              </Space.Compact>
            )}
            {clientTickets.length > 0 ? <List size="small" dataSource={clientTickets} renderItem={(t: any) => (
              <List.Item><Space size={4}><Tag color={t.estado === 'ABIERTO' ? 'red' : 'green'}>{t.estado}</Tag><Tag>{t.tipo.replace(/_/g, ' ')}</Tag><span style={{ fontSize: 12 }}>{t.descripcion || '\u2014'}</span><Typography.Text type="secondary" style={{ fontSize: 11 }}>{dayjs(t.createdAt).fromNow()}</Typography.Text></Space></List.Item>
            )} /> : !ticketsLoading && <Typography.Text type="secondary">Sin tickets.</Typography.Text>}
          </Spin>
        )},

        // -- Notas --
        { key: 'notas', label: <><MessageOutlined /> Notas</>, children: (
          <Spin spinning={notesLoading}>
            {canOperate && (
              <Space.Compact style={{ width: '100%', marginBottom: 12 }}>
                <Input.TextArea rows={2} maxLength={1000} value={state.noteText} onChange={(e) => dispatch({ type: 'SET_NOTE_TEXT', payload: e.target.value })} placeholder="Agregar nota..." />
                <Button type="primary" onClick={() => { if (!state.noteText.trim()) return; createNoteMutation.mutate(state.noteText.trim()); }} disabled={!state.noteText.trim()} loading={createNoteMutation.isPending}>Agregar</Button>
              </Space.Compact>
            )}
            {notes.length > 0 ? (notes as ClientNote[]).map((n) => (
              <div key={n.id} style={{ padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
                <Space size={4}><Typography.Text strong style={{ fontSize: 12 }}>{n.user.name}</Typography.Text><Typography.Text type="secondary" style={{ fontSize: 11 }}>{dayjs(n.createdAt).fromNow()}</Typography.Text>
                  {isAdmin && <Button type="text" danger size="small" icon={<DeleteOutlined />} aria-label="Eliminar nota" onClick={() => Modal.confirm({ title: 'Eliminar esta nota?', okText: 'Eliminar', okType: 'danger', onOk: () => deleteNoteMutation.mutateAsync(n.id) })} />}</Space>
                <div style={{ fontSize: 13 }}>{n.content}</div>
              </div>
            )) : !notesLoading && <Typography.Text type="secondary">Sin notas.</Typography.Text>}
          </Spin>
        )},

        // -- Historial --
        { key: 'historial', label: <><HistoryOutlined /> Historial</>, children: (
          <Spin spinning={historyLoading}>
            {(history as AuditLogEntry[]).length > 0 ? <Timeline items={(history as AuditLogEntry[]).map((h) => ({ key: h.id, children: <div><Typography.Text strong style={{ fontSize: 12 }}>{ACTION_LABELS[h.action] || h.action}</Typography.Text><Typography.Text type="secondary" style={{ fontSize: 11, marginLeft: 6 }}>{h.user.name} \u2014 {dayjs(h.createdAt).fromNow()}</Typography.Text></div> }))} />
              : !historyLoading && <Typography.Text type="secondary">Sin historial.</Typography.Text>}
          </Spin>
        )},

        // -- Promociones --
        { key: 'promos', label: <><ThunderboltOutlined /> Promos</>, children: (
          <Spin spinning={promosLoading}>
            {canOperate && estado === 'ACTIVO' && activeSubs.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                {availablePromos.length > 0 ? (
                  <Space wrap size={4}>
                    <Select placeholder="Suscripcion" size="small" style={{ width: 120 }} value={state.selectedPromoSubId || undefined} onChange={(v) => dispatch({ type: 'SET_PROMO', payload: { subId: v } })} options={activeSubs.map((s: any) => ({ value: s.subscriptionId, label: s.tipo }))} />
                    <Select placeholder="Promocion" size="small" style={{ width: 220 }} value={state.selectedPromoId || undefined} onChange={(v) => dispatch({ type: 'SET_PROMO', payload: { promoId: v } })}
                      options={availablePromos.map((p: any) => ({ value: p.id, label: `${p.nombre} (${p.tipo}${p.tipo === 'PORCENTAJE' ? ' ' + p.valor + '%' : p.tipo === 'MESES_GRATIS' ? '' : ' $' + p.valor})` }))} />
                    <Button type="primary" size="small" disabled={!state.selectedPromoId || !state.selectedPromoSubId} loading={assignPromoMutation.isPending} onClick={() => assignPromoMutation.mutate()}>Asignar</Button>
                  </Space>
                ) : <Typography.Text type="secondary" style={{ fontSize: 12 }}>No hay promos CLIENTE activas.</Typography.Text>}
              </div>
            )}
            {promos.length > 0 ? <List size="small" dataSource={promos} renderItem={(p: any) => (
              <List.Item actions={isAdmin ? [<Button type="link" danger size="small" onClick={() => Modal.confirm({ title: 'Quitar esta promocion?', okText: 'Quitar', okType: 'danger', onOk: () => removePromoMutation.mutateAsync({ subId: p.subscriptionId, promoId: p.id }) })}>Quitar</Button>] : undefined}>
                <Space size={4}><Tag color="purple">{p.promotion?.tipo || p.tipo}</Tag><span style={{ fontSize: 12 }}>{p.promotion?.nombre || p.nombre}</span></Space>
              </List.Item>
            )} /> : !promosLoading && <Typography.Text type="secondary">Sin promociones.</Typography.Text>}
          </Spin>
        )},

        // -- Documentos --
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
