import { useEffect, useState, useCallback } from 'react';
import { Card, Table, Select, Tag, Typography, Space, message } from 'antd';
import { documentsApi, getErrorMessage } from '../services/api';
import type { Document, Pagination } from '../types';

const { Option } = Select;

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(false);
  const [tipo, setTipo] = useState<string | undefined>();

  const loadDocuments = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const result = await documentsApi.getAll({ tipo, page, limit: 20 });
      setDocuments(result.data);
      setPagination(result.pagination);
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [tipo]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const columns = [
    {
      title: 'Cliente',
      key: 'cliente',
      render: (_: unknown, record: Document) =>
        record.client?.nombreNormalizado || '—',
      ellipsis: true,
    },
    {
      title: 'Tipo',
      dataIndex: 'tipo',
      key: 'tipo',
      width: 100,
      render: (t: string) => (
        <Tag color={t === 'RAMITO' ? 'blue' : 'green'}>{t}</Tag>
      ),
    },
    {
      title: 'Nro. Documento',
      dataIndex: 'numeroDocumento',
      key: 'numero',
      width: 140,
      render: (v: string | null) => v || '—',
    },
    {
      title: 'Fecha',
      dataIndex: 'fechaDocumento',
      key: 'fecha',
      width: 120,
      render: (d: string | null) =>
        d ? new Date(d).toLocaleDateString('es-AR') : '—',
    },
    {
      title: 'Descripción',
      dataIndex: 'descripcionOriginal',
      key: 'desc',
      ellipsis: true,
      render: (v: string | null) => v || '—',
    },
    {
      title: 'Períodos',
      key: 'periodos',
      width: 180,
      render: (_: unknown, record: Document) => {
        const periods = record.paymentPeriods || [];
        if (periods.length === 0) return <Tag color="red">Sin períodos</Tag>;
        return (
          <Space wrap size={[4, 4]}>
            {periods.map((p) => (
              <Tag key={p.id} color="cyan">
                {p.year}-{String(p.month).padStart(2, '0')}
              </Tag>
            ))}
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      <Typography.Title level={3} style={{ marginBottom: 24 }}>
        Documentos
      </Typography.Title>

      <Card style={{ marginBottom: 16 }}>
        <Select
          placeholder="Filtrar por tipo"
          value={tipo}
          onChange={setTipo}
          allowClear
          style={{ width: 180 }}
        >
          <Option value="RAMITO">Ramitos</Option>
          <Option value="FACTURA">Facturas</Option>
        </Select>
      </Card>

      <Card>
        <Table
          dataSource={documents}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{
            total: pagination.total,
            current: pagination.page,
            pageSize: pagination.limit,
            showTotal: (total) => `${total} documentos`,
            onChange: (page) => loadDocuments(page),
          }}
          scroll={{ x: 1000 }}
        />
      </Card>
    </div>
  );
}
