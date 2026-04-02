import { useEffect, useState, useCallback } from 'react';
import { Card, Row, Col, Statistic, Spin, Alert, Table, Tag, Typography } from 'antd';
import {
  TeamOutlined, WarningOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ArrowUpOutlined, ArrowDownOutlined, SyncOutlined,
} from '@ant-design/icons';
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { dashboardApi, getErrorMessage } from '../../services/api';
import type { DashboardMetrics } from '../../types';

const COLORS = ['#52c41a', '#faad14', '#ff7a45', '#f5222d'];
const REFRESH_INTERVAL = 60_000;

export default function DashboardPage() {
  const [data, setData] = useState<DashboardMetrics | null>(null);
  const [tendencia, setTendencia] = useState<any>(null);
  const [mrr, setMrr] = useState<any>(null);
  const [crecimiento, setCrecimiento] = useState<any>(null);
  const [zonas, setZonas] = useState<any>(null);
  const [ticketsDash, setTicketsDash] = useState<any>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const navigate = useNavigate();

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const [m, t, mr, c, z, tk] = await Promise.all([
        dashboardApi.getMetrics(),
        dashboardApi.getTendencia().catch(() => null),
        dashboardApi.getMrr().catch(() => null),
        dashboardApi.getCrecimiento().catch(() => null),
        dashboardApi.getZonas().catch(() => null),
        dashboardApi.getTickets().catch(() => null),
      ]);
      setData(m); setTendencia(t); setMrr(mr); setCrecimiento(c); setZonas(z); setTicketsDash(tk);
      setLastUpdate(new Date());
    } catch (err) { setError(getErrorMessage(err)); }
    finally { setInitialLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(() => load(true), REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [load]);

  if (initialLoading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (error) return <Alert type="error" message={error} showIcon />;
  if (!data) return null;

  const { resumen, deuda } = data;
  const d = data;

  const pie = [
    { name: 'Al día', value: deuda.alDia },
    { name: '1 mes', value: deuda.unMes },
    { name: '2 meses', value: deuda.dosMeses },
    { name: '+2 meses', value: deuda.masDosMeses },
  ].filter((x) => x.value > 0);

  const tieneZonas = zonas?.zonas?.some((z: any) => z.zona !== 'Sin zona');

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>Dashboard</Typography.Title>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {lastUpdate && `Actualizado ${dayjs(lastUpdate).format('HH:mm:ss')}`}
          <SyncOutlined spin={refreshing} style={{ marginLeft: 8, cursor: 'pointer' }} onClick={() => load()} />
        </Typography.Text>
      </div>

      {/* Fila 1 — KPIs existentes */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={6}><Card><Statistic title="Total Clientes" value={resumen.totalClients} prefix={<TeamOutlined />} /></Card></Col>
        <Col xs={24} sm={6}><Card><Statistic title="Activos" value={resumen.activeClients} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col xs={24} sm={6}><Card><Statistic title="De Baja" value={resumen.bajaClients} prefix={<CloseCircleOutlined />} valueStyle={{ color: '#8c8c8c' }} /></Card></Col>
        <Col xs={24} sm={6}>
          <Card style={{ borderColor: '#faad14' }}>
            <Statistic title="En riesgo de corte" value={d.clientesEnRiesgo ?? 0} prefix={<WarningOutlined />} valueStyle={{ color: '#faad14' }} />
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>A un mes del corte</Typography.Text>
          </Card>
        </Col>
      </Row>

      {/* Fila 2 — MRR */}
      {mrr && (
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={12} sm={6}><Card size="small"><Statistic title="Ingreso teórico" value={mrr.mrrTeorico} prefix="$" precision={0} valueStyle={{ color: '#1677ff' }} /><Typography.Text type="secondary" style={{ fontSize: 10 }}>Suma de planes activos</Typography.Text></Card></Col>
          <Col xs={12} sm={6}><Card size="small"><Statistic title="Recaudado" value={mrr.mrrRecaudado} prefix="$" precision={0} valueStyle={{ color: '#52c41a' }} /></Card></Col>
          <Col xs={12} sm={6}><Card size="small"><Statistic title="% Recaudación" value={mrr.porcentajeRecaudado} suffix="%" precision={1} valueStyle={{ color: mrr.porcentajeRecaudado >= 80 ? '#52c41a' : mrr.porcentajeRecaudado >= 60 ? '#faad14' : '#ff4d4f' }} /></Card></Col>
          <Col xs={12} sm={6}><Card size="small"><Statistic title="Sin plan asignado" value={mrr.sinPlanAsignado} suffix="subs" valueStyle={{ color: mrr.sinPlanAsignado > 0 ? '#faad14' : '#52c41a', fontSize: 20 }} />{mrr.sinPlanAsignado > 0 && <Typography.Text type="warning" style={{ fontSize: 10 }}>Sin precio configurado</Typography.Text>}</Card></Col>
        </Row>
      )}

      {/* Fila 2b — Pérdida estimada */}
      {mrr && mrr.mrrTeorico > 0 && (
        <Row gutter={[16, 16]} style={{ marginTop: 8 }}>
          <Col xs={12} sm={8}>
            <Card size="small" style={{ borderColor: '#ff4d4f20' }}>
              <Statistic title="Pérdida por mora" value={mrr.mrrTeorico - mrr.mrrRecaudado} prefix="$" precision={0} valueStyle={{ color: '#ff4d4f' }} />
              <Typography.Text type="secondary" style={{ fontSize: 10 }}>Lo que no se cobró este mes</Typography.Text>
            </Card>
          </Col>
          <Col xs={12} sm={8}>
            <Card size="small">
              <Statistic title="Proyección anual" value={(mrr.mrrRecaudado || 0) * 12} prefix="$" precision={0} valueStyle={{ color: '#1677ff' }} />
              <Typography.Text type="secondary" style={{ fontSize: 10 }}>Si se mantiene la recaudación actual</Typography.Text>
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card size="small" style={{ borderColor: '#faad1420' }}>
              <Statistic title="Pérdida anual estimada" value={(mrr.mrrTeorico - mrr.mrrRecaudado) * 12} prefix="$" precision={0} valueStyle={{ color: '#faad14' }} />
              <Typography.Text type="secondary" style={{ fontSize: 10 }}>Si no se cobra la mora acumulada</Typography.Text>
            </Card>
          </Col>
        </Row>
      )}

      {/* Fila 3 — Scoring de clientes */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={12} sm={6}><Card><Statistic title="Bueno" value={deuda.scoring?.bueno ?? deuda.alDia} valueStyle={{ color: '#52c41a' }} suffix={<span style={{ fontSize: 12, color: '#999' }}>al día</span>} /></Card></Col>
        <Col xs={12} sm={6}><Card><Statistic title="Regular" value={deuda.scoring?.regular ?? deuda.unMes} valueStyle={{ color: '#faad14' }} suffix={<span style={{ fontSize: 12, color: '#999' }}>1 mes</span>} /></Card></Col>
        <Col xs={12} sm={6}><Card><Statistic title="Riesgo" value={deuda.scoring?.riesgo ?? deuda.dosMeses} valueStyle={{ color: '#ff7a45' }} suffix={<span style={{ fontSize: 12, color: '#999' }}>2-3 meses</span>} /></Card></Col>
        <Col xs={12} sm={6}><Card><Statistic title="Crítico" value={deuda.scoring?.critico ?? deuda.masDosMeses} prefix={<WarningOutlined />} valueStyle={{ color: '#f5222d' }} suffix={<span style={{ fontSize: 12, color: '#999' }}>4+ / corte</span>} /></Card></Col>
      </Row>

      {/* Fila 4 — Gráficos */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} md={12}>
          <Card title="Tendencia de cobranza (12 meses)" role="img" aria-label="Gráfico de línea mostrando porcentaje de cobranza de los últimos 12 meses">
            {tendencia?.meses?.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={tendencia.meses}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
                  <Tooltip formatter={(v: number) => [`${v}%`, '% cobrado']} />
                  <ReferenceLine y={80} stroke="#52c41a" strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="porcentaje" stroke="#1677ff" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>Sin datos de tendencia</div>}
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="Distribución de deuda" role="img" aria-label="Gráfico de torta mostrando distribución de clientes por nivel de deuda">
            {pie.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={pie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }: any) => `${name}: ${value}`}>
                    {pie.map((item, i) => <Cell key={item.name} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip /><Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>Sin datos</div>}
          </Card>
        </Col>
      </Row>

      {/* Fila 5 — Crecimiento */}
      {crecimiento && (
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={12} sm={4}><Card size="small"><Statistic title="Altas del mes" value={crecimiento.mesActual.altas} prefix={<ArrowUpOutlined />} valueStyle={{ color: '#52c41a' }} /></Card></Col>
          <Col xs={12} sm={4}><Card size="small"><Statistic title="Bajas del mes" value={crecimiento.mesActual.bajas} prefix={<ArrowDownOutlined />} valueStyle={{ color: '#ff4d4f' }} /></Card></Col>
          <Col xs={12} sm={4}><Card size="small"><Statistic title="Neto" value={crecimiento.mesActual.neto} prefix={crecimiento.mesActual.neto >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />} valueStyle={{ color: crecimiento.mesActual.neto >= 0 ? '#52c41a' : '#ff4d4f' }} /></Card></Col>
          <Col xs={12} sm={6}><Card size="small"><Statistic title="Penetración internet" value={crecimiento.penetracionInternet.porcentajeInternet} suffix="%" precision={1} valueStyle={{ color: '#1677ff' }} /><Typography.Text type="secondary" style={{ fontSize: 10 }}>{crecimiento.penetracionInternet.ambos + crecimiento.penetracionInternet.soloInternet} con internet</Typography.Text></Card></Col>
          <Col xs={12} sm={6}><Card size="small"><Statistic title="Potencial internet" value={crecimiento.penetracionInternet.oportunidad} suffix="clientes" valueStyle={{ color: '#722ed1' }} /><Typography.Text type="secondary" style={{ fontSize: 10 }}>Solo cable, sin internet</Typography.Text></Card></Col>
        </Row>
      )}

      {/* Fila 6 — Zonas */}
      {tieneZonas && (
        <Card title="Morosidad por zona" size="small" style={{ marginTop: 16 }}>
          <Table dataSource={zonas.zonas} rowKey="zona" size="small" pagination={false} scroll={{ x: 600 }} columns={[
            { title: 'Zona', dataIndex: 'zona', ellipsis: true },
            { title: 'Clientes', dataIndex: 'totalClientes', width: 80, align: 'center' as const },
            { title: 'Al día', dataIndex: 'alDia', align: 'center' as const, render: (v: number) => <Tag color="green">{v}</Tag> },
            { title: 'En riesgo', dataIndex: 'enRiesgo', align: 'center' as const, render: (v: number) => v > 0 ? <Tag color="orange">{v}</Tag> : <Tag>0</Tag> },
            { title: 'En corte', dataIndex: 'enCorte', align: 'center' as const, render: (v: number) => v > 0 ? <Tag color="red">{v}</Tag> : <Tag>0</Tag> },
            { title: '% Morosidad', dataIndex: 'porcentajeMorosidad', align: 'center' as const, render: (v: number) => <span style={{ color: v > 30 ? '#ff4d4f' : v > 15 ? '#faad14' : '#52c41a', fontWeight: 'bold' }}>{v.toFixed(1)}%</span> },
          ]} />
        </Card>
      )}

      {/* Fila 7 — Tickets de soporte */}
      {ticketsDash && (
        <>
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={12} sm={6}>
              <Card size="small" style={{ borderColor: ticketsDash.abiertos > 0 ? '#ff4d4f' : undefined }}>
                <Statistic title="Tickets abiertos" value={ticketsDash.abiertos} valueStyle={{ color: ticketsDash.abiertos > 0 ? '#ff4d4f' : '#52c41a' }} />
              </Card>
            </Col>
            <Col xs={12} sm={6}><Card size="small"><Statistic title="Resueltos hoy" value={ticketsDash.resueltosHoy} valueStyle={{ color: '#52c41a' }} /></Card></Col>
            <Col xs={12} sm={6}>
              <Card size="small" style={{ borderColor: ticketsDash.sinResolver48hs > 0 ? '#faad14' : undefined }}>
                <Statistic title="Sin resolver +48hs" value={ticketsDash.sinResolver48hs} prefix={ticketsDash.sinResolver48hs > 0 ? <WarningOutlined /> : undefined} valueStyle={{ color: ticketsDash.sinResolver48hs > 0 ? '#faad14' : '#52c41a' }} />
              </Card>
            </Col>
            <Col xs={12} sm={6}><Card size="small"><Statistic title="Tiempo prom. resolución" value={ticketsDash.tiempoPromedioResolucion} suffix="hs" /></Card></Col>
          </Row>
          {ticketsDash.ultimosAbiertos?.length > 0 && (
            <Card title="Tickets abiertos más antiguos" size="small" style={{ marginTop: 16 }}>
              <Table dataSource={ticketsDash.ultimosAbiertos} rowKey="id" size="small" pagination={false} columns={[
                { title: 'Cliente', dataIndex: 'cliente', render: (name: string, r: any) => <a href={`/clients?clientId=${r.clienteId}`} onClick={(e) => { e.preventDefault(); navigate(`/clients?clientId=${r.clienteId}`); }}>{name}</a> },
                { title: 'Tipo', dataIndex: 'tipo', width: 140, render: (t: string) => <Tag color={{ SIN_SENIAL: 'red', LENTITUD_INTERNET: 'orange', RECONEXION: 'blue', INSTALACION: 'green', CAMBIO_EQUIPO: 'purple' }[t] || 'default'}>{t}</Tag> },
                { title: 'Descripción', dataIndex: 'descripcion', ellipsis: true, render: (v: string) => v || '—' },
                { title: 'Desde hace', dataIndex: 'desdeHace', width: 130 },
              ]} />
            </Card>
          )}
        </>
      )}

      {/* Fila 8 — Import log */}
      <Card title="Últimas importaciones" style={{ marginTop: 16 }}>
        <Table dataSource={data.ultimasImportaciones} rowKey="id" pagination={false} size="small" locale={{ emptyText: 'Sin importaciones aún' }} columns={[
          { title: 'Tipo', dataIndex: 'tipo', render: (t: string) => <Tag>{t}</Tag> },
          { title: 'Archivo', dataIndex: 'fileName', ellipsis: true },
          { title: 'Filas', dataIndex: 'totalRows', width: 70 },
          { title: 'Válidas', dataIndex: 'validRows', width: 70 },
          { title: 'Estado', dataIndex: 'status', width: 100, render: (s: string) => <Tag color={s === 'SUCCESS' ? 'green' : s === 'PARTIAL' ? 'orange' : 'red'}>{s}</Tag> },
          { title: 'Fecha', dataIndex: 'executedAt', width: 160, render: (d: string) => new Date(d).toLocaleString('es-AR') },
        ]} />
      </Card>
    </div>
  );
}
