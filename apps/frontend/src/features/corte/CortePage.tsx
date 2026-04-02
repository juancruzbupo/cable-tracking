import { useEffect, useState } from 'react';
import { Card, Table, Tag, Typography, Spin, Alert, Statistic, Row, Col, Button, Space, Tooltip, message, Select, Input } from 'antd';
import { WarningOutlined, ScissorOutlined, FileExcelOutlined, FilePdfOutlined, WhatsAppOutlined, SearchOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import { dashboardApi, billingApi, getErrorMessage } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { generarMensajeDeuda, generarLinkWhatsApp } from '../../shared/utils/whatsapp';
import type { ClientDebtInfo } from '../../types';

export default function CortePage() {
  const [clients, setClients] = useState<ClientDebtInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [zonaFilter, setZonaFilter] = useState<string | undefined>();
  const [search, setSearch] = useState('');
  const { hasRole } = useAuth();
  const canExport = hasRole('ADMIN', 'OPERADOR');

  useEffect(() => {
    dashboardApi
      .getClientesParaCorte()
      .then(setClients)
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  // Zonas únicas para el filtro
  const zonas = [...new Set(clients.map((c) => (c as any).zona || (c.calle ? 'Con calle' : 'Sin datos')))].sort();

  // Filtrar
  const filtered = clients.filter((c) => {
    if (zonaFilter && ((c as any).zona || 'Sin datos') !== zonaFilter) return false;
    if (search && !c.nombreNormalizado.toLowerCase().includes(search.toLowerCase()) && !c.codCli.includes(search)) return false;
    return true;
  });

  // Stats sobre los filtrados
  const totalCable = filtered.filter((c) => c.requiereCorteCable).length;
  const totalInternet = filtered.filter((c) => c.requiereCorteInternet).length;
  const totalAmbos = filtered.filter((c) => c.requiereCorteCable && c.requiereCorteInternet).length;
  const handleExportCorte = () => {
    if (filtered.length === 0) return;
    const rows = filtered.map((c, i) => ({
      '#': i + 1,
      'Código': c.codCli,
      'Cliente': c.nombreNormalizado,
      'Calle': c.calle || '',
      'Zona': (c as any).zona || '',
      'Teléfono': (c as any).telefono || '',
      'Cable': c.requiereCorteCable ? `${c.deudaCable} meses` : 'Al día',
      'Internet': c.requiereCorteInternet ? `${c.deudaInternet} meses` : 'Al día',
      'Total deuda': c.cantidadDeuda,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const keys = Object.keys(rows[0]) as (keyof typeof rows[0])[];
    ws['!cols'] = keys.map((key) => ({ wch: Math.max(String(key).length, ...rows.slice(0, 50).map((r) => String(r[key]).length)) + 2 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Para Corte');
    XLSX.writeFile(wb, `corte_${new Date().toISOString().slice(0, 10)}.xlsx`);
    message.success('Excel descargado');
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (error) return <Alert type="error" message={error} showIcon />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}><ScissorOutlined /> Lista de Corte</Typography.Title>
        {canExport && (
          <Space>
            <Button icon={<FilePdfOutlined />} onClick={() => billingApi.downloadCortePdf().then(() => message.success('PDF descargado')).catch((e) => message.error(getErrorMessage(e)))}>PDF</Button>
            <Button icon={<FileExcelOutlined />} onClick={handleExportCorte} disabled={filtered.length === 0}>Excel</Button>
          </Space>
        )}
      </div>

      {/* Stats */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="Total para corte" value={filtered.length} valueStyle={{ color: '#f5222d', fontSize: 28 }} prefix={<WarningOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="Solo Cable" value={totalCable - totalAmbos} valueStyle={{ color: '#1677ff' }} suffix={<span style={{ fontSize: 12, color: '#999' }}>clientes</span>} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="Solo Internet" value={totalInternet - totalAmbos} valueStyle={{ color: '#52c41a' }} suffix={<span style={{ fontSize: 12, color: '#999' }}>clientes</span>} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="Ambos servicios" value={totalAmbos} valueStyle={{ color: '#722ed1' }} suffix={<span style={{ fontSize: 12, color: '#999' }}>clientes</span>} />
          </Card>
        </Col>
      </Row>

      {/* Filtros */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input placeholder="Buscar nombre o código..." prefix={<SearchOutlined />} value={search} onChange={(e) => setSearch(e.target.value)} allowClear style={{ width: 240 }} />
          {zonas.length > 1 && (
            <Select placeholder="Filtrar por zona" value={zonaFilter} onChange={setZonaFilter} allowClear style={{ width: 200 }}
              options={zonas.map((z) => ({ value: z, label: z }))} />
          )}
          <Typography.Text type="secondary">{filtered.length} de {clients.length} clientes</Typography.Text>
        </Space>
      </Card>

      {/* Tabla */}
      <Card>
        <Table
          dataSource={filtered}
          rowKey="clientId"
          pagination={{ pageSize: 30, showTotal: (t) => `${t} clientes` }}
          scroll={{ x: 900 }}
          size="small"
          rowClassName={(r) => r.cantidadDeuda >= 6 ? 'row-corte-critico' : ''}
          columns={[
            {
              title: '#',
              width: 45,
              render: (_: unknown, __: unknown, i: number) => <span style={{ color: '#999', fontSize: 11 }}>{i + 1}</span>,
            },
            {
              title: 'Cliente',
              dataIndex: 'nombreNormalizado',
              ellipsis: true,
              sorter: (a: ClientDebtInfo, b: ClientDebtInfo) => a.nombreNormalizado.localeCompare(b.nombreNormalizado),
              render: (name: string, r: ClientDebtInfo) => (
                <div>
                  <div style={{ fontWeight: 500 }}>{name}</div>
                  <div style={{ fontSize: 11, color: '#999' }}>
                    {r.calle || 'Sin dirección'}{(r as any).zona ? ` · ${(r as any).zona}` : ''}
                  </div>
                </div>
              ),
            },
            {
              title: 'Servicios a cortar',
              width: 160,
              render: (_: unknown, r: ClientDebtInfo) => (
                <Space direction="vertical" size={2}>
                  {r.requiereCorteCable && (
                    <Tag color="red" style={{ margin: 0 }}>Cable — {r.deudaCable} mes{r.deudaCable !== 1 ? 'es' : ''}</Tag>
                  )}
                  {r.requiereCorteInternet && (
                    <Tag color="red" style={{ margin: 0 }}>Internet — {r.deudaInternet} mes{r.deudaInternet !== 1 ? 'es' : ''}</Tag>
                  )}
                  {!r.requiereCorteCable && r.deudaCable > 0 && (
                    <Tag color="orange" style={{ margin: 0 }}>Cable — {r.deudaCable} mes</Tag>
                  )}
                  {!r.requiereCorteInternet && r.deudaInternet > 0 && (
                    <Tag color="orange" style={{ margin: 0 }}>Internet — {r.deudaInternet} mes</Tag>
                  )}
                </Space>
              ),
            },
            {
              title: 'Deuda total',
              dataIndex: 'cantidadDeuda',
              width: 100,
              sorter: (a: ClientDebtInfo, b: ClientDebtInfo) => a.cantidadDeuda - b.cantidadDeuda,
              defaultSortOrder: 'descend',
              render: (v: number) => (
                <span style={{ fontWeight: 700, fontSize: 16, color: v >= 6 ? '#f5222d' : v >= 4 ? '#ff7a45' : '#faad14' }}>
                  {v} <span style={{ fontSize: 11, fontWeight: 400 }}>meses</span>
                </span>
              ),
            },
            {
              title: 'Último pago',
              width: 100,
              render: (_: unknown, r: ClientDebtInfo) => {
                const pagados = r.mesesPagados;
                if (pagados.length === 0) return <Tag color="default">Nunca</Tag>;
                const last = pagados[pagados.length - 1];
                return <span style={{ fontSize: 12 }}>{last}</span>;
              },
            },
            ...(canExport ? [{
              title: '',
              width: 45,
              render: (_: unknown, r: any) => r.telefono ? (
                <Tooltip title="Enviar recordatorio WhatsApp">
                  <Button type="text" size="small" icon={<WhatsAppOutlined style={{ color: '#25D366' }} />}
                    onClick={() => {
                      const msg = generarMensajeDeuda({ nombre: r.nombreNormalizado, deudaCable: r.deudaCable, deudaInternet: r.deudaInternet, cantidadDeuda: r.cantidadDeuda });
                      window.open(generarLinkWhatsApp(r.telefono, msg), '_blank');
                    }} />
                </Tooltip>
              ) : null,
            }] : []),
          ]}
        />
      </Card>
    </div>
  );
}
