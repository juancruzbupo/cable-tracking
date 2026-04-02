import { useState, useEffect } from 'react';
import { Card, Typography, DatePicker, Row, Col, Statistic, Progress, Table, Button, Space, Spin, message } from 'antd';
import { BarChartOutlined, ArrowUpOutlined, ArrowDownOutlined, FilePdfOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { billingApi, getErrorMessage } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function ReportesPage() {
  const navigate = useNavigate();
  const [month, setMonth] = useState<dayjs.Dayjs>(dayjs().subtract(1, 'month'));
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [batchLoading, setBatchLoading] = useState(false);
  const { hasRole } = useAuth();

  const loadReport = async (m: dayjs.Dayjs) => {
    try {
      setLoading(true);
      const data = await billingApi.getReport(m.month() + 1, m.year());
      setReport(data);
    } catch (err) { message.error(getErrorMessage(err)); }
    finally { setLoading(false); }
  };

  const handleMonthChange = (d: dayjs.Dayjs | null) => {
    if (!d) return;
    setMonth(d);
    loadReport(d);
  };

  // Auto-load on mount
  useEffect(() => { loadReport(month); }, [month]);

  const handleBatch = async () => {
    try {
      setBatchLoading(true);
      await billingApi.downloadBatchInvoices(month.month() + 1, month.year());
      message.success('Facturas descargadas');
    } catch (err) { message.error(getErrorMessage(err)); }
    finally { setBatchLoading(false); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}><BarChartOutlined /> Reportes</Typography.Title>
        <Space>
          <DatePicker picker="month" value={month} onChange={handleMonthChange} format="MMM YYYY" />
          {!report && <Button type="primary" onClick={() => loadReport(month)}>Cargar reporte</Button>}
          {hasRole('ADMIN') && report && (
            <Button icon={<FilePdfOutlined />} loading={batchLoading} onClick={handleBatch}>
              Generar facturas del mes
            </Button>
          )}
        </Space>
      </div>

      {loading && <Spin size="large" style={{ display: 'block', margin: '60px auto' }} />}

      {report && !loading && (
        <>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={8}>
              <Card>
                <Statistic title="Clientes con pago" value={report.resumen.clientesConPago} suffix={`de ${report.resumen.totalClientes}`} />
                <Progress percent={report.resumen.porcentajeCobrado} size="small" status={report.resumen.porcentajeCobrado > 50 ? 'active' : 'exception'} />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card>
                <Statistic title="Recaudación Cable" value={report.porServicio.cable.montoRecaudado} prefix="$" valueStyle={{ color: '#1677ff' }} />
                <Typography.Text type="secondary">de ${report.porServicio.cable.montoEsperado} esperado</Typography.Text>
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card>
                <Statistic title="Recaudación Internet" value={report.porServicio.internet.montoRecaudado} prefix="$" valueStyle={{ color: '#52c41a' }} />
                <Typography.Text type="secondary">de ${report.porServicio.internet.montoEsperado} esperado</Typography.Text>
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={24} sm={12}>
              <Card title="Cable">
                <Statistic title="Pagadas" value={report.porServicio.cable.pagadas} suffix={`de ${report.porServicio.cable.suscripcionesActivas}`} />
                <Progress percent={report.porServicio.cable.suscripcionesActivas > 0 ? Math.round((report.porServicio.cable.pagadas / report.porServicio.cable.suscripcionesActivas) * 100) : 0} />
              </Card>
            </Col>
            <Col xs={24} sm={12}>
              <Card title="Internet">
                <Statistic title="Pagadas" value={report.porServicio.internet.pagadas} suffix={`de ${report.porServicio.internet.suscripcionesActivas}`} />
                <Progress percent={report.porServicio.internet.suscripcionesActivas > 0 ? Math.round((report.porServicio.internet.pagadas / report.porServicio.internet.suscripcionesActivas) * 100) : 0} />
              </Card>
            </Col>
          </Row>

          <Card style={{ marginTop: 16 }} title="Comparación con mes anterior">
            <Space size={24}>
              <Statistic title="Mes anterior" value={report.comparacionMesAnterior.porcentajeCobradoAnterior} suffix="%" />
              <Statistic title="Este mes" value={report.resumen.porcentajeCobrado} suffix="%" />
              <Statistic
                title="Variación"
                value={Math.abs(report.comparacionMesAnterior.variacion)}
                suffix="pp"
                prefix={report.comparacionMesAnterior.variacion >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                valueStyle={{ color: report.comparacionMesAnterior.variacion >= 0 ? '#52c41a' : '#f5222d' }}
              />
            </Space>
          </Card>

          <Card style={{ marginTop: 16 }} title="Clientes sin pago">
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
              Basado en pagos registrados en el sistema.
            </Typography.Text>
            <Table dataSource={report.clientesSinPago} rowKey="id" pagination={false} size="small" columns={[
              { title: 'Cliente', dataIndex: 'nombre', render: (name: string, r: any) => <a onClick={() => navigate(`/clients?clientId=${r.id}`)} style={{ cursor: 'pointer' }}>{name}</a> },
            ]} />
          </Card>
        </>
      )}
    </div>
  );
}
