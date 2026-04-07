import { useState, useEffect } from 'react';
import { Space, Typography, Button, Spin, Modal, Input, message } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { clientsApi, getErrorMessage } from '../../../../../services/api';
import { useAuth } from '../../../../../context/AuthContext';
import type { ClientNote } from '../../../../../types';

interface NotesTabProps {
  clientId: string;
}

export default function NotesTab({ clientId }: NotesTabProps) {
  const { hasRole } = useAuth();
  const canOperate = hasRole('ADMIN', 'OPERADOR');
  const isAdmin = hasRole('ADMIN');

  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [noteText, setNoteText] = useState('');
  const [notesLoading, setNotesLoading] = useState(false);

  const loadNotes = async () => {
    setNotesLoading(true);
    try { const res = await clientsApi.getNotes(clientId); setNotes(res); }
    catch { /* */ }
    finally { setNotesLoading(false); }
  };

  useEffect(() => { loadNotes(); }, [clientId]);

  return (
    <Spin spinning={notesLoading}>
      {canOperate && (
        <Space.Compact style={{ width: '100%', marginBottom: 12 }}>
          <Input.TextArea rows={2} maxLength={1000} value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Agregar nota..." />
          <Button type="primary" onClick={async () => {
            if (!noteText.trim()) return;
            try { await clientsApi.createNote(clientId, noteText.trim()); setNoteText(''); message.success('Agregada'); loadNotes(); }
            catch (err) { message.error(getErrorMessage(err)); }
          }} disabled={!noteText.trim()}>Agregar</Button>
        </Space.Compact>
      )}
      {notes.length > 0 ? notes.map((n) => (
        <div key={n.id} style={{ padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
          <Space size={4}>
            <Typography.Text strong style={{ fontSize: 12 }}>{n.user.name}</Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>{dayjs(n.createdAt).fromNow()}</Typography.Text>
            {isAdmin && <Button type="text" danger size="small" icon={<DeleteOutlined />} aria-label="Eliminar nota" onClick={() => Modal.confirm({
              title: '¿Eliminar esta nota?', okText: 'Eliminar', okType: 'danger',
              onOk: async () => { try { await clientsApi.deleteNote(clientId, n.id); loadNotes(); } catch { message.error('Error'); } },
            })} />}
          </Space>
          <div style={{ fontSize: 13 }}>{n.content}</div>
        </div>
      )) : !notesLoading && <Typography.Text type="secondary">Sin notas.</Typography.Text>}
    </Spin>
  );
}
