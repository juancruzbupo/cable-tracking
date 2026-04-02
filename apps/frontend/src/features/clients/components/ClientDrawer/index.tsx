import { useState } from 'react';
import {
  Card, Select, Tag, Space, Typography, Button,
  message, Descriptions, Badge, Divider, DatePicker, Modal,
} from 'antd';
import {
  WarningOutlined, CheckCircleFilled, CloseCircleFilled,
  StopOutlined, PlayCircleOutlined, WhatsAppOutlined,
  FullscreenOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/es';
import { clientsApi, getErrorMessage } from '../../../../services/api';
import { useAuth } from '../../../../context/AuthContext';
import { generarMensajeDeuda, generarLinkWhatsApp } from '../../../../shared/utils/whatsapp';
import type { ClientDetailResult } from '../../../../types';

dayjs.extend(relativeTime);
dayjs.locale('es');

export default function ClientDetail({ data, onRefresh }: { data: ClientDetailResult; onRefresh: () => void }) {
  const { nombreNormalizado, nombreOriginal, codCli, estado, fechaAlta, calle, requiereCorte, subscriptions } = data;
  const { hasRole } = useAuth();
  const navigate = useNavigate();
  const canOperate = hasRole('ADMIN', 'OPERADOR');
  const isAdmin = hasRole('ADMIN');

  const [payMonth, setPayMonth] = useState<dayjs.Dayjs | null>(null);
  const [paySubId, setPaySubId] = useState<string>('');

  const activeSubs = subscriptions.filter((s: any) => s.tipo);

  const handlePayment = async () => {
    if (!payMonth || !paySubId) return;
    try {
      await clientsApi.createPayment(data.clientId, paySubId, payMonth.year(), payMonth.month() + 1);
      message.success('Pago registrado');
      setPayMonth(null);
      onRefresh();
    } catch (err) { message.error(getErrorMessage(err)); }
  };

  return (
    <div>
      {/* Acciones rápidas */}
      <Space style={{ marginBottom: 12 }} wrap>
        <Button type="primary" icon={<FullscreenOutlined />} onClick={() => navigate(`/clients/${data.clientId}`)}>Ver detalle completo</Button>
        {canOperate && estado === 'ACTIVO' && (
          <Button danger icon={<StopOutlined />} size="small" onClick={() => Modal.confirm({
            title: `Confirmar baja de ${nombreNormalizado}`, content: 'Se darán de baja todos sus servicios activos.', okText: 'Dar de baja', okType: 'danger',
            onOk: async () => { await clientsApi.deactivate(data.clientId); message.success('Cliente dado de baja'); onRefresh(); },
          })}>Dar de baja</Button>
        )}
        {isAdmin && estado === 'BAJA' && (
          <Button type="primary" icon={<PlayCircleOutlined />} size="small" onClick={async () => { await clientsApi.reactivate(data.clientId); message.success('Reactivado'); onRefresh(); }}>Reactivar</Button>
        )}
        {(data as any).telefono && data.cantidadDeuda > 0 && (
          <Button icon={<WhatsAppOutlined />} size="small" style={{ color: '#25D366' }}
            onClick={async () => {
              const msg = generarMensajeDeuda({ nombre: nombreNormalizado, deudaCable: data.deudaCable, deudaInternet: data.deudaInternet, cantidadDeuda: data.cantidadDeuda });
              window.open(generarLinkWhatsApp((data as any).telefono, msg), '_blank');
              try { await clientsApi.logWhatsApp(data.clientId); } catch { /* */ }
            }}>WhatsApp</Button>
        )}
      </Space>

      {/* Info básica */}
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

      {/* Servicios */}
      <Divider orientation="left">Servicios</Divider>

      {requiereCorte && <Tag color="red" icon={<WarningOutlined />} style={{ marginBottom: 12, fontSize: 14, padding: '4px 12px' }}>REQUIERE CORTE</Tag>}

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {subscriptions.map((sub: any) => (
          <Card key={sub.subscriptionId} size="small" style={{ flex: 1, minWidth: 240, border: sub.requiereCorte ? '1px solid #ff4d4f' : undefined }}
            title={<Space>{sub.tipo === 'CABLE' ? '📺' : '🌐'} {sub.tipo} {sub.requiereCorte && <Tag color="red" style={{ margin: 0 }}>CORTE</Tag>}</Space>}>
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
                return <Badge key={m} count={icon} offset={[-4, 0]}><Tag color={color} style={{ margin: 0, fontSize: 10 }}>{m}</Tag></Badge>;
              })}
            </div>
          </Card>
        ))}
      </div>

      {/* Pago rápido */}
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
    </div>
  );
}
