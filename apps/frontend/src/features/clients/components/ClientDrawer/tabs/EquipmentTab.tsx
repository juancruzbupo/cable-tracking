import { useState, useEffect } from 'react';
import { Space, Typography, Button, Spin, Select, Tag, List, Modal, message } from 'antd';
import { equipmentApi, getErrorMessage } from '../../../../../services/api';
import { useAuth } from '../../../../../context/AuthContext';
import type { Equipment, EquipmentAssignment } from '../../../../../types';

interface EquipmentTabProps {
  clientId: string;
  estado: string;
}

export default function EquipmentTab({ clientId, estado }: EquipmentTabProps) {
  const { hasRole } = useAuth();
  const canOperate = hasRole('ADMIN', 'OPERADOR');

  const [clientEquipment, setClientEquipment] = useState<EquipmentAssignment[]>([]);
  const [equipOptions, setEquipOptions] = useState<Equipment[]>([]);
  const [equipSearching, setEquipSearching] = useState(false);
  const [equipLoading, setEquipLoading] = useState(false);
  const [selectedEquipId, setSelectedEquipId] = useState('');

  const loadEquipment = async () => {
    setEquipLoading(true);
    try { setClientEquipment(await equipmentApi.getClientEquipment(clientId)); }
    catch { /* */ }
    finally { setEquipLoading(false); }
  };

  useEffect(() => { loadEquipment(); }, [clientId]);

  const searchEquip = async (s: string) => {
    if (!s || s.length < 2) return;
    setEquipSearching(true);
    try {
      const r = await equipmentApi.getAll({ estado: 'EN_DEPOSITO', search: s });
      setEquipOptions(((r.data || r) as Equipment[]).slice(0, 20));
    } catch { /* */ }
    finally { setEquipSearching(false); }
  };

  return (
    <Spin spinning={equipLoading}>
      {canOperate && estado === 'ACTIVO' && (
        <Space.Compact style={{ width: '100%', marginBottom: 12 }}>
          <Select showSearch placeholder="Buscar equipo..." filterOption={false} onSearch={searchEquip} loading={equipSearching} style={{ flex: 1 }} size="small"
            value={selectedEquipId || undefined} onChange={setSelectedEquipId} notFoundContent={equipSearching ? <Spin size="small" /> : 'Escribí para buscar'}>
            {equipOptions.map((eq) => (
              <Select.Option key={eq.id} value={eq.id}>
                {eq.tipo} {eq.marca && `${eq.marca}`} {eq.numeroSerie && `[${eq.numeroSerie}]`}
              </Select.Option>
            ))}
          </Select>
          <Button type="primary" size="small" disabled={!selectedEquipId} onClick={async () => {
            try { await equipmentApi.assign(clientId, selectedEquipId); message.success('Asignado'); setSelectedEquipId(''); setEquipOptions([]); loadEquipment(); }
            catch (err) { message.error(getErrorMessage(err)); }
          }}>Asignar</Button>
        </Space.Compact>
      )}
      {clientEquipment.length > 0 ? (
        <List size="small" dataSource={clientEquipment} renderItem={(eq) => (
          <List.Item actions={canOperate && !eq.fechaRetiro ? [
            <Button key="retire" size="small" type="link" danger onClick={() => Modal.confirm({
              title: '¿Retirar este equipo?', okText: 'Retirar', okType: 'danger',
              onOk: async () => {
                try { await equipmentApi.retire(clientId, eq.id); message.success('Retirado'); loadEquipment(); }
                catch (err) { message.error(getErrorMessage(err)); }
              },
            })}>Retirar</Button>,
          ] : undefined}>
            <List.Item.Meta
              title={<Space size={4}>{eq.equipment?.tipo} <Tag color={eq.fechaRetiro ? 'default' : 'blue'}>{eq.fechaRetiro ? 'Retirado' : 'Instalado'}</Tag></Space>}
              description={<>{[eq.equipment?.marca, eq.equipment?.modelo].filter(Boolean).join(' ') || ''} {eq.equipment?.numeroSerie && <Typography.Text code style={{ fontSize: 11 }}>{eq.equipment.numeroSerie}</Typography.Text>}</>}
            />
          </List.Item>
        )} />
      ) : !equipLoading && <Typography.Text type="secondary">Sin equipos.</Typography.Text>}
    </Spin>
  );
}
