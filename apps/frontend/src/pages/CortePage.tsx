import { useEffect, useState } from 'react';
import { Card, Table, Tag, Typography, Spin, Alert, Statistic, Row, Col, Button, Space, message } from 'antd';
import { WarningOutlined, ScissorOutlined, DownloadOutlined, FileExcelOutlined } from '@ant-design/icons';
import type { SorterResult } from 'antd/es/table/interface';
import * as XLSX from 'xlsx';
import { dashboardApi, exportApi, getErrorMessage } from '../services/api';
import type { ClientDebtInfo } from '../types';

export default function CortePage() {
  const [clients, setClients] = useState<ClientDebtInfo[]>([]);
  const [sortedClients, setSortedClients] = useState<ClientDebtInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    dashboardApi
      .getClientesParaCorte()
      .then((data) => {
        setClients(data);
        setSortedClients(data);
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  const [downloading, setDownloading] = useState(false);

  const handleExportCorte = () => {
    if (sortedClients.length === 0) return;

    const rows = sortedClients.map((c) => ({
      'Código': c.codCli,
      'Cliente': c.nombreNormalizado,
      'Calle': c.calle || '',
      'Fecha Alta': c.fechaAlta ? new Date(c.fechaAlta).toLocaleDateString('es-AR') : '',
      'Meses Deuda': c.cantidadDeuda,
      'Meses Adeudados': c.mesesAdeudados.join(', '),
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Para Corte');

    // Auto-width columns
    if (rows.length === 0) return;
    const keys = Object.keys(rows[0]) as (keyof typeof rows[0])[];
    const colWidths = keys.map((key) => ({
      wch: Math.max(String(key).length, ...rows.slice(0, 50).map((r) => String(r[key]).length)) + 2,
    }));
    ws['!cols'] = colWidths;

    XLSX.writeFile(wb, `corte_${new Date().toISOString().slice(0, 10)}.xlsx`);
    message.success('Excel descargado');
  };

  const handleDownloadResumen = async () => {
    try {
      setDownloading(true);
      await exportApi.downloadResumen();
      message.success('Archivo descargado');
    } catch {
      message.error('Error al descargar');
    } finally {
      setDownloading(false);
    }
  };

  const handleTableChange = (_pagination: unknown, _filters: unknown, sorter: SorterResult<ClientDebtInfo> | SorterResult<ClientDebtInfo>[]) => {
    const s = Array.isArray(sorter) ? sorter[0] : sorter;
    if (!s.order || !s.field) {
      setSortedClients(clients);
      return;
    }
    const field = s.field as keyof ClientDebtInfo;
    const sorted = [...clients].sort((a, b) => {
      const aVal = a[field];
      const bVal = b[field];
      if (aVal == null || bVal == null) return 0;
      const cmp = typeof aVal === 'number' && typeof bVal === 'number'
        ? aVal - bVal
        : String(aVal).localeCompare(String(bVal));
      return s.order === 'ascend' ? cmp : -cmp;
    });
    setSortedClients(sorted);
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (error) return <Alert type="error" message={error} showIcon />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          <ScissorOutlined /> Clientes para Corte
        </Typography.Title>
        <Space>
          <Button
            icon={<FileExcelOutlined />}
            onClick={handleExportCorte}
            disabled={clients.length === 0}
          >
            Exportar Corte
          </Button>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleDownloadResumen}
            loading={downloading}
          >
            Resumen General
          </Button>
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Total para corte"
              value={clients.length}
              valueStyle={{ color: '#f5222d' }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Promedio meses deuda"
              value={
                clients.length > 0
                  ? (clients.reduce((a, c) => a + c.cantidadDeuda, 0) / clients.length).toFixed(1)
                  : 0
              }
              suffix="meses"
              valueStyle={{ color: '#ff7a45' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Máxima deuda"
              value={clients.length > 0 ? Math.max(...clients.map((c) => c.cantidadDeuda)) : 0}
              suffix="meses"
              valueStyle={{ color: '#f5222d' }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Alert
          type="error"
          message="Estos clientes tienen MÁS DE 2 MESES de deuda y deben ser marcados para corte."
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Table
          dataSource={clients}
          rowKey="clientId"
          pagination={{ pageSize: 25 }}
          scroll={{ x: 900 }}
          onChange={handleTableChange}
          columns={[
            {
              title: 'Código',
              dataIndex: 'codCli',
              width: 80,
              sorter: (a: ClientDebtInfo, b: ClientDebtInfo) => Number(a.codCli) - Number(b.codCli),
            },
            {
              title: 'Cliente',
              dataIndex: 'nombreNormalizado',
              ellipsis: true,
              sorter: (a: ClientDebtInfo, b: ClientDebtInfo) => a.nombreNormalizado.localeCompare(b.nombreNormalizado),
            },
            {
              title: 'Calle',
              dataIndex: 'calle',
              ellipsis: true,
              render: (v: string | null) => v || '—',
            },
            {
              title: 'Alta',
              dataIndex: 'fechaAlta',
              width: 110,
              sorter: (a: ClientDebtInfo, b: ClientDebtInfo) => (a.fechaAlta ? new Date(a.fechaAlta).getTime() : 0) - (b.fechaAlta ? new Date(b.fechaAlta).getTime() : 0),
              render: (d: string | null) => (d ? new Date(d).toLocaleDateString('es-AR') : '—'),
            },
            {
              title: 'Meses deuda',
              dataIndex: 'cantidadDeuda',
              width: 120,
              sorter: (a: ClientDebtInfo, b: ClientDebtInfo) => a.cantidadDeuda - b.cantidadDeuda,
              defaultSortOrder: 'descend',
              render: (v: number) => <Tag color="red" icon={<WarningOutlined />}>{v} meses</Tag>,
            },
            {
              title: 'Meses adeudados',
              dataIndex: 'mesesAdeudados',
              render: (meses: string[]) => (
                <span style={{ color: '#f5222d', fontSize: 12 }}>
                  {meses.slice(0, 5).join(', ')}
                  {meses.length > 5 && ` +${meses.length - 5}`}
                </span>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
