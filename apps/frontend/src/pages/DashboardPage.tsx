import { useEffect, useState } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Spin,
  Alert,
  Table,
  Tag,
  Typography,
} from 'antd';
import {
  TeamOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { dashboardApi, getErrorMessage } from '../services/api';
import type { DashboardMetrics } from '../types';

const COLORS = ['#52c41a', '#faad14', '#ff7a45', '#f5222d'];

export default function DashboardPage() {
  const [data, setData] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    dashboardApi
      .getMetrics()
      .then(setData)
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (error) return <Alert type="error" message={error} showIcon />;
  if (!data) return null;

  const { resumen, deuda, documentos } = data;

  const pie = [
    { name: 'Al día', value: deuda.alDia },
    { name: '1 mes', value: deuda.unMes },
    { name: '2 meses', value: deuda.dosMeses },
    { name: '+2 meses', value: deuda.masDosMeses },
  ].filter((d) => d.value > 0);

  return (
    <div>
      <Typography.Title level={3}>Dashboard</Typography.Title>

      {/* Resumen */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="Total Clientes" value={resumen.totalClients} prefix={<TeamOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="Activos" value={resumen.activeClients} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="De Baja" value={resumen.bajaClients} prefix={<CloseCircleOutlined />} valueStyle={{ color: '#8c8c8c' }} />
          </Card>
        </Col>
      </Row>

      {/* Deuda */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={12} sm={6}>
          <Card><Statistic title="Al día" value={deuda.alDia} valueStyle={{ color: '#52c41a' }} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card><Statistic title="1 mes deuda" value={deuda.unMes} valueStyle={{ color: '#faad14' }} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card><Statistic title="2 meses deuda" value={deuda.dosMeses} valueStyle={{ color: '#ff7a45' }} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="+2 meses (CORTE)" value={deuda.masDosMeses} prefix={<WarningOutlined />} valueStyle={{ color: '#f5222d' }} />
          </Card>
        </Col>
      </Row>

      {/* Charts + KPIs */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} md={12}>
          <Card title="Distribución de deuda">
            {pie.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={pie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name}: ${value}`}>
                    {pie.map((item, i) => (
                      <Cell key={item.name} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
                Sin datos. Importá archivos primero.
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="Indicadores clave">
            <Statistic
              title="Tasa de morosidad"
              value={deuda.tasaMorosidad}
              precision={1}
              suffix="%"
              valueStyle={{ color: deuda.tasaMorosidad > 30 ? '#f5222d' : '#faad14' }}
            />
            <Statistic title="Para corte" value={deuda.requierenCorte} valueStyle={{ color: '#f5222d' }} style={{ marginTop: 20 }} />
            <Row gutter={16} style={{ marginTop: 20 }}>
              <Col span={12}><Statistic title="Ramitos" value={documentos.ramitos} /></Col>
              <Col span={12}><Statistic title="Facturas" value={documentos.facturas} /></Col>
            </Row>
            <Statistic title="Períodos registrados" value={documentos.periodosRegistrados} style={{ marginTop: 16 }} />
          </Card>
        </Col>
      </Row>

      {/* Import log */}
      <Card title="Últimas importaciones" style={{ marginTop: 16 }}>
        <Table
          dataSource={data.ultimasImportaciones}
          rowKey="id"
          pagination={false}
          size="small"
          locale={{ emptyText: 'Sin importaciones aún' }}
          columns={[
            { title: 'Tipo', dataIndex: 'tipo', render: (t: string) => <Tag>{t}</Tag> },
            { title: 'Archivo', dataIndex: 'fileName', ellipsis: true },
            { title: 'Filas', dataIndex: 'totalRows', width: 70 },
            { title: 'Válidas', dataIndex: 'validRows', width: 70 },
            {
              title: 'Estado', dataIndex: 'status', width: 100,
              render: (s: string) => <Tag color={s === 'SUCCESS' ? 'green' : s === 'PARTIAL' ? 'orange' : 'red'}>{s}</Tag>,
            },
            {
              title: 'Fecha', dataIndex: 'executedAt', width: 160,
              render: (d: string) => new Date(d).toLocaleString('es-AR'),
            },
          ]}
        />
      </Card>
    </div>
  );
}
