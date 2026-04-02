import { useState, useEffect, useRef } from 'react';
import {
  Card, Upload, Button, Alert, Table, Tabs, Statistic, Row, Col,
  Tag, Typography, Space, Modal, Collapse, Progress, message,
} from 'antd';
import {
  UploadOutlined, CheckCircleOutlined, WarningOutlined, FileExcelOutlined, HistoryOutlined, PlusOutlined,
} from '@ant-design/icons';
import { importApi } from '../../services/api';
import type { ImportPreview, ImportResult, ImportLog } from '../../types';

type ImportType = 'clientes' | 'ramitos' | 'facturas';

interface State {
  file: File | null;
  preview: ImportPreview | null;
  result: ImportResult | null;
  loading: boolean;
  previewing: boolean;
  error: string | null;
}

const empty: State = { file: null, preview: null, result: null, loading: false, previewing: false, error: null };

function ImportSection({ tipo }: { tipo: ImportType }) {
  const [s, set] = useState<State>({ ...empty });
  const [importProgress, setImportProgress] = useState(0);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { return () => { if (progressRef.current) clearInterval(progressRef.current); }; }, []);

  const labels: Record<ImportType, string> = { clientes: 'Clientes', ramitos: 'Ramitos', facturas: 'Facturas' };
  const rules: Record<ImportType, string> = {
    clientes: 'NO pisa la tabla. Si el cliente ya existe, no lo duplica. Si indica "BAJA", actualiza el estado.',
    ramitos: '⚠️ PISA la base. Elimina TODOS los ramitos existentes y los reemplaza.',
    facturas: '⚠️ PISA la base. Elimina TODAS las facturas existentes y las reemplaza.',
  };

  const onFile = async (file: File) => {
    set((p) => ({ ...p, file, preview: null, result: null, error: null, previewing: true }));
    try {
      const preview = await importApi.preview(file, tipo);
      set((p) => ({ ...p, preview, previewing: false }));
    } catch {
      set((p) => ({ ...p, previewing: false, error: 'Error al previsualizar' }));
    }
    return false;
  };

  const onConfirm = () => {
    Modal.confirm({
      title: `Confirmar importación de ${labels[tipo]}`,
      content: tipo === 'clientes'
        ? 'Se agregarán clientes nuevos. Los existentes no serán modificados.'
        : `⚠️ Se eliminarán TODOS los ${labels[tipo].toLowerCase()} existentes y se reemplazarán.`,
      okText: 'Importar',
      okType: tipo === 'clientes' ? 'primary' : 'danger',
      cancelText: 'Cancelar',
      onOk: doImport,
    });
  };

  const doImport = async () => {
    if (!s.file) return;
    set((p) => ({ ...p, loading: true, error: null }));
    setImportProgress(0);
    progressRef.current = setInterval(() => {
      setImportProgress((prev) => prev >= 90 ? 90 : prev + Math.random() * 8);
    }, 300);
    try {
      const result = await importApi.execute(s.file, tipo);
      if (progressRef.current) clearInterval(progressRef.current);
      setImportProgress(100);
      set((p) => ({ ...p, result, loading: false }));
      message.success(`${labels[tipo]}: ${result.validRows} filas importadas`);
    } catch {
      if (progressRef.current) clearInterval(progressRef.current);
      setImportProgress(0);
      set((p) => ({ ...p, loading: false, error: 'Error en la importación' }));
      message.error('Error en la importación');
    }
  };

  const { preview: pv, result: rs } = s;

  return (
    <div>
      <Alert message={`Regla: ${labels[tipo]}`} description={rules[tipo]} type={tipo === 'clientes' ? 'info' : 'warning'} showIcon style={{ marginBottom: 16 }} />

      {/* Upload */}
      <Card style={{ marginBottom: 16 }}>
        <Upload.Dragger accept=".xlsx,.xls" maxCount={1} beforeUpload={onFile} showUploadList={false}>
          <p className="ant-upload-drag-icon"><FileExcelOutlined style={{ fontSize: 48, color: '#52c41a' }} /></p>
          <p className="ant-upload-text">Click o arrastrá el archivo Excel de {labels[tipo]}</p>
          <p className="ant-upload-hint">.xlsx o .xls — Máximo 10MB</p>
        </Upload.Dragger>
        {s.file && <Tag icon={<FileExcelOutlined />} color="green" style={{ marginTop: 8 }}>{s.file.name} ({(s.file.size / 1024).toFixed(1)} KB)</Tag>}
      </Card>

      {s.error && <Alert type="error" message={s.error} closable style={{ marginBottom: 16 }} />}
      {s.previewing && <Card loading style={{ marginBottom: 16 }}>Analizando...</Card>}

      {s.loading && (
        <Card style={{ marginBottom: 16 }}>
          <Typography.Text>Importando {labels[tipo].toLowerCase()}...</Typography.Text>
          <Progress percent={Math.round(importProgress)} status="active" strokeColor={{ from: '#108ee9', to: '#1677ff' }} style={{ marginTop: 8 }} />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>Esto puede tardar unos segundos...</Typography.Text>
        </Card>
      )}

      {/* Preview */}
      {pv && !rs && (
        <Card title="Preview" style={{ marginBottom: 16 }}>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={8}><Statistic title="Total" value={pv.totalRows} /></Col>
            <Col span={8}><Statistic title="Válidas" value={pv.validRows} valueStyle={{ color: '#52c41a' }} /></Col>
            <Col span={8}><Statistic title="Inválidas" value={pv.invalidRows} valueStyle={{ color: pv.invalidRows > 0 ? '#f5222d' : undefined }} /></Col>
          </Row>

          <Typography.Text strong>Headers: </Typography.Text>
          <Space wrap style={{ marginBottom: 12 }}>{pv.headers.map((h, i) => <Tag key={i}>{h}</Tag>)}</Space>

          {pv.sampleRows.length > 0 && (
            <Table
              dataSource={pv.sampleRows.map((r, i) => ({ ...r, _k: i }))}
              rowKey="_k" size="small" scroll={{ x: true }} pagination={false}
              columns={pv.headers.map((h) => ({ title: h, dataIndex: h, key: h, ellipsis: true, render: (v: unknown) => String(v ?? '') }))}
              style={{ marginBottom: 16 }}
            />
          )}

          {pv.errors.length > 0 && (
            <Collapse items={[{
              key: '1',
              label: <span style={{ color: '#f5222d' }}><WarningOutlined /> {pv.errors.length} errores</span>,
              children: (
                <Table dataSource={pv.errors} rowKey={(_, i) => String(i)} size="small" pagination={{ pageSize: 10 }}
                  columns={[
                    { title: 'Fila', dataIndex: 'row', width: 80 },
                    { title: 'Columna', dataIndex: 'column', width: 120 },
                    { title: 'Error', dataIndex: 'message' },
                  ]}
                />
              ),
            }]} />
          )}

          <Space style={{ marginTop: 16 }}>
            <Button type="primary" size="large" icon={<CheckCircleOutlined />} onClick={onConfirm} loading={s.loading} disabled={pv.validRows === 0}>
              Confirmar ({pv.validRows} filas)
            </Button>
            <Button onClick={() => set({ ...empty })}>Cancelar</Button>
          </Space>
        </Card>
      )}

      {/* Result */}
      {rs && (
        <Card style={{ marginBottom: 16 }}>
          <Typography.Title level={5} style={{ marginBottom: 16 }}>Importación completada</Typography.Title>
          <Row gutter={[16, 16]}>
            <Col xs={8}><Statistic title="Total procesados" value={rs.totalRows} valueStyle={{ color: '#1677ff' }} /></Col>
            <Col xs={8}><Statistic title="Válidos" value={rs.validRows} valueStyle={{ color: '#52c41a' }} /></Col>
            <Col xs={8}><Statistic title="Con error" value={rs.invalidRows} valueStyle={{ color: rs.invalidRows > 0 ? '#ff4d4f' : '#8c8c8c' }} /></Col>
            {tipo === 'clientes' && rs.newClients > 0 && <Col xs={12}><Statistic title="Clientes nuevos" value={rs.newClients} prefix={<PlusOutlined />} valueStyle={{ color: '#52c41a' }} /></Col>}
            {tipo === 'clientes' && rs.updatedClients > 0 && <Col xs={12}><Statistic title="Actualizados" value={rs.updatedClients} valueStyle={{ color: '#faad14' }} /></Col>}
            {rs.documentsCreated > 0 && <Col xs={12}><Statistic title="Documentos creados" value={rs.documentsCreated} /></Col>}
            {rs.periodsCreated > 0 && <Col xs={12}><Statistic title="Períodos registrados" value={rs.periodsCreated} /></Col>}
          </Row>

          {rs.errors.length > 0 && (
            <Alert type="warning" showIcon style={{ marginTop: 16 }} message={`${rs.errors.length} registro(s) con problemas`}
              description={<ul style={{ marginBottom: 0, paddingLeft: 20 }}>{rs.errors.slice(0, 5).map((e, i) => <li key={i} style={{ fontSize: 12 }}>{e.message} (fila {e.row})</li>)}{rs.errors.length > 5 && <li style={{ fontSize: 12 }}>... y {rs.errors.length - 5} más</li>}</ul>} />
          )}

          <Button style={{ marginTop: 16 }} type="primary" onClick={() => { set({ ...empty }); setImportProgress(0); }}>Nueva importación</Button>
        </Card>
      )}
    </div>
  );
}

function ImportHistory() {
  const [logs, setLogs] = useState<ImportLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    importApi.getLogs(50).then(setLogs).finally(() => setLoading(false));
  }, []);

  return (
    <Table
      dataSource={logs}
      rowKey="id"
      loading={loading}
      size="small"
      pagination={{ pageSize: 15 }}
      columns={[
        { title: 'Tipo', dataIndex: 'tipo', width: 100, render: (t: string) => <Tag>{t}</Tag> },
        { title: 'Archivo', dataIndex: 'fileName', ellipsis: true },
        { title: 'Total', dataIndex: 'totalRows', width: 70 },
        { title: 'Válidas', dataIndex: 'validRows', width: 70 },
        { title: 'Inválidas', dataIndex: 'invalidRows', width: 80 },
        { title: 'Nuevos', dataIndex: 'newClients', width: 70 },
        {
          title: 'Estado', dataIndex: 'status', width: 90,
          render: (s: string) => <Tag color={s === 'SUCCESS' ? 'green' : s === 'PARTIAL' ? 'orange' : 'red'}>{s}</Tag>,
        },
        { title: 'Fecha', dataIndex: 'executedAt', width: 160, render: (d: string) => new Date(d).toLocaleString('es-AR') },
      ]}
    />
  );
}

export default function ImportPage() {
  return (
    <div>
      <Typography.Title level={3}>Importaciones</Typography.Title>
      <Tabs
        type="card"
        items={[
          { key: 'clientes', label: <><UploadOutlined /> Clientes</>, children: <ImportSection tipo="clientes" /> },
          { key: 'ramitos', label: <><UploadOutlined /> Ramitos</>, children: <ImportSection tipo="ramitos" /> },
          { key: 'facturas', label: <><UploadOutlined /> Facturas</>, children: <ImportSection tipo="facturas" /> },
          { key: 'historial', label: <><HistoryOutlined /> Historial</>, children: <ImportHistory /> },
        ]}
      />
    </div>
  );
}
