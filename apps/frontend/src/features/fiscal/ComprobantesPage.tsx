import { useEffect, useState, useCallback } from 'react';
import { Card, Table, Tag, Typography, Button, Select, Space, message, Modal } from 'antd';
import { FileTextOutlined, DownloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { fiscalApi, getErrorMessage } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const ESTADO_COLORS: Record<string, string> = { PENDIENTE: 'orange', EMITIDO: 'green', ANULADO: 'red', ERROR: 'red' };

export default function ComprobantesPage() {
  const [data, setData] = useState<any>({ data: [], pagination: { total: 0, page: 1, limit: 20, totalPages: 0 } });
  const [loading, setLoading] = useState(true);
  const [estado, setEstado] = useState<string | undefined>();
  const [tipo, setTipo] = useState<string | undefined>();
  const { hasRole } = useAuth();
  const navigate = useNavigate();

  const load = useCallback(async (page = 1) => {
    try { setLoading(true); setData(await fiscalApi.getComprobantes({ estado, tipo, page, limit: 20 })); }
    catch (err) { message.error(getErrorMessage(err)); }
    finally { setLoading(false); }
  }, [estado, tipo]);

  useEffect(() => { load(); }, [load]);

  const handleBatch = () => {
    const month = dayjs().subtract(1, 'month');
    Modal.confirm({
      title: `Emitir comprobantes de ${month.format('MMMM YYYY')}`,
      content: 'Se emitirán comprobantes para todos los pagos sin comprobante en ese período.',
      onOk: async () => {
        try {
          const res = await fiscalApi.emitirBatch(month.month() + 1, month.year());
          message.success(`Exitosos: ${res.exitosos}, Errores: ${res.errores}`);
          load();
        } catch (err) { message.error(getErrorMessage(err)); }
      },
    });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}><FileTextOutlined /> Comprobantes</Typography.Title>
        <Space>
          <Select placeholder="Estado" allowClear value={estado} onChange={setEstado} style={{ width: 140 }}
            options={[{ value: 'PENDIENTE', label: 'Pendiente' }, { value: 'EMITIDO', label: 'Emitido' }, { value: 'ANULADO', label: 'Anulado' }, { value: 'ERROR', label: 'Error' }]} />
          <Select placeholder="Tipo" allowClear value={tipo} onChange={setTipo} style={{ width: 140 }}
            options={[{ value: 'FACTURA_A', label: 'Factura A' }, { value: 'FACTURA_B', label: 'Factura B' }, { value: 'FACTURA_C', label: 'Factura C' }, { value: 'RECIBO_X', label: 'Recibo X' }]} />
          {hasRole('ADMIN') && <Button type="primary" onClick={handleBatch}>Emitir comprobantes del mes</Button>}
        </Space>
      </div>
      <Card>
        <Tag color="orange" style={{ marginBottom: 12 }}>Modo: INTERNO (sin valor fiscal)</Tag>
        <Table dataSource={data.data} rowKey="id" loading={loading} scroll={{ x: 750 }}
          pagination={{ total: data.pagination.total, current: data.pagination.page, pageSize: 20, onChange: load }}
          columns={[
            { title: 'Número', width: 130, render: (_: any, r: any) => `${String(r.puntoVenta).padStart(4, '0')}-${String(r.numero).padStart(8, '0')}` },
            { title: 'Tipo', dataIndex: 'tipo', width: 100, render: (t: string) => <Tag>{t.replace('_', ' ')}</Tag> },
            { title: 'Cliente', width: 200, ellipsis: true, render: (_: any, r: any) => r.client ? <a onClick={() => navigate(`/clients?clientId=${r.clientId}`)} style={{ cursor: 'pointer' }}>{r.client.nombreNormalizado}</a> : '—' },
            { title: 'Fecha', dataIndex: 'fecha', width: 110, render: (d: string) => dayjs(d).format('DD/MM/YYYY') },
            { title: 'Total', dataIndex: 'total', width: 100, render: (t: number) => `$${Number(t).toLocaleString()}` },
            { title: 'Estado', dataIndex: 'estado', width: 100, render: (e: string) => <Tag color={ESTADO_COLORS[e]}>{e}</Tag> },
            { title: '', width: 50, render: (_: any, r: any) => <Button type="text" size="small" icon={<DownloadOutlined />} onClick={() => fiscalApi.downloadPdf(r.id)} /> },
          ]}
        />
      </Card>
    </div>
  );
}
