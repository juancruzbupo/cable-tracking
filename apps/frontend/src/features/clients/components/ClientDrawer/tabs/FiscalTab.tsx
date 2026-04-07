import { useState } from 'react';
import { Space, Button, Descriptions, Select, Switch, Input, Tag, message } from 'antd';
import { clientsApi, fiscalApi, getErrorMessage } from '../../../../../services/api';
import { useAuth } from '../../../../../context/AuthContext';
import type { ClientDetailResult } from '../../../../../types';

interface FiscalTabProps {
  clientId: string;
  data: ClientDetailResult;
  onRefresh: () => void;
}

export default function FiscalTab({ clientId, data: d, onRefresh }: FiscalTabProps) {
  const { hasRole } = useAuth();
  const canOperate = hasRole('ADMIN', 'OPERADOR');

  const [fiscalEditing, setFiscalEditing] = useState(false);
  const [fiscalSaving, setFiscalSaving] = useState(false);
  const [fiscalForm, setFiscalForm] = useState<Record<string, string>>({});

  const startFiscalEdit = () => {
    setFiscalForm({
      tipoDocumento: d.tipoDocumento || '',
      numeroDocumento: d.numeroDocFiscal || '',
      condicionFiscal: d.condicionFiscal || 'CONSUMIDOR_FINAL',
      razonSocial: d.razonSocial || '',
      telefono: d.telefono || '',
      email: d.email || '',
    });
    setFiscalEditing(true);
  };

  const saveFiscal = async () => {
    setFiscalSaving(true);
    try {
      await fiscalApi.updateClientFiscal(clientId, fiscalForm);
      message.success('Datos actualizados');
      setFiscalEditing(false);
      onRefresh();
    } catch (err) { message.error(getErrorMessage(err)); }
    finally { setFiscalSaving(false); }
  };

  return (
    <div>
      {canOperate && !fiscalEditing && <Button size="small" onClick={startFiscalEdit} style={{ marginBottom: 8 }}>Editar</Button>}
      {!fiscalEditing ? (
        <Descriptions bordered size="small" column={1}>
          <Descriptions.Item label="Tipo Doc">{d.tipoDocumento || '—'}</Descriptions.Item>
          <Descriptions.Item label="Nro Doc">{d.numeroDocFiscal || '—'}</Descriptions.Item>
          <Descriptions.Item label="Condición">{d.condicionFiscal || 'CONSUMIDOR_FINAL'}</Descriptions.Item>
          <Descriptions.Item label="Razón Social">{d.razonSocial || '—'}</Descriptions.Item>
          <Descriptions.Item label="Teléfono">{d.telefono || '—'}</Descriptions.Item>
          <Descriptions.Item label="Email">{d.email || '—'}</Descriptions.Item>
          <Descriptions.Item label="Zona">{d.zona || '—'}</Descriptions.Item>
          <Descriptions.Item label="Comprobante">
            <Space>
              <Tag color={d.tipoComprobante === 'FACTURA' ? 'blue' : 'default'}>{d.tipoComprobante || 'RAMITO'}</Tag>
              {canOperate && (
                <Switch size="small" checked={d.tipoComprobante === 'FACTURA'}
                  checkedChildren="Factura" unCheckedChildren="Ramito"
                  onChange={async (checked) => {
                    try {
                      await clientsApi.updateComprobanteConfig(clientId, { tipoComprobante: checked ? 'FACTURA' : 'RAMITO' });
                      message.success(`Comprobante: ${checked ? 'FACTURA' : 'RAMITO'}`);
                      onRefresh();
                    } catch (err) { message.error(getErrorMessage(err)); }
                  }} />
              )}
            </Space>
          </Descriptions.Item>
        </Descriptions>
      ) : (
        <Space direction="vertical" style={{ width: '100%' }} size={8}>
          <Select style={{ width: '100%' }} value={fiscalForm.tipoDocumento || undefined} onChange={(v) => setFiscalForm({ ...fiscalForm, tipoDocumento: v })} placeholder="Tipo doc" allowClear
            options={[{ value: 'CUIT', label: 'CUIT' }, { value: 'CUIL', label: 'CUIL' }, { value: 'DNI', label: 'DNI' }, { value: 'CONSUMIDOR_FINAL', label: 'Consumidor Final' }]} />
          <Input size="small" value={fiscalForm.numeroDocumento} onChange={(e) => setFiscalForm({ ...fiscalForm, numeroDocumento: e.target.value })} placeholder="Nro documento" />
          <Select style={{ width: '100%' }} value={fiscalForm.condicionFiscal} onChange={(v) => setFiscalForm({ ...fiscalForm, condicionFiscal: v })}
            options={[{ value: 'CONSUMIDOR_FINAL', label: 'Consumidor Final' }, { value: 'MONOTRIBUTISTA', label: 'Monotributista' }, { value: 'RESPONSABLE_INSCRIPTO', label: 'Responsable Inscripto' }, { value: 'EXENTO', label: 'Exento' }]} />
          <Input size="small" value={fiscalForm.razonSocial} onChange={(e) => setFiscalForm({ ...fiscalForm, razonSocial: e.target.value })} placeholder="Razón social" />
          <Input size="small" value={fiscalForm.telefono} onChange={(e) => setFiscalForm({ ...fiscalForm, telefono: e.target.value })} placeholder="Teléfono" />
          <Input size="small" value={fiscalForm.email} onChange={(e) => setFiscalForm({ ...fiscalForm, email: e.target.value })} placeholder="Email" />
          <Space>
            <Button type="primary" size="small" onClick={saveFiscal} loading={fiscalSaving}>Guardar</Button>
            <Button size="small" onClick={() => setFiscalEditing(false)}>Cancelar</Button>
          </Space>
        </Space>
      )}
    </div>
  );
}
