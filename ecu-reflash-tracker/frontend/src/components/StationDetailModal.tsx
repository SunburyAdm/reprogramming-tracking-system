import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { updateStationMembers } from '../services/api';
import { Box } from '../store/index';

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Station {
  id: string;
  session_id: string;
  name: string;
  created_at: string;
  members: Member[];
}

interface Props {
  sessionId: string;
  station: Station;
  allUsers: Member[];
  boxes: Box[];
  isAdmin: boolean;
  isSessionActive: boolean;
  onClose: () => void;
  onUpdated: (updated: Station) => void;
}

function fmtTime(iso: string | null | undefined) {
  if (!iso) return '—';
  try { return format(new Date(iso), 'dd/MM/yy HH:mm'); } catch { return iso ?? '—'; }
}

const STATUS_COLOR: Record<string, string> = {
  completed: 'var(--success)',
  blocked: 'var(--error)',
  in_progress: 'var(--primary)',
  learning: '#a855f7',
  pending: 'var(--text-dim)',
};

export default function StationDetailModal({
  sessionId, station, allUsers, boxes, isAdmin, isSessionActive, onClose, onUpdated,
}: Props) {
  const navigate = useNavigate();
  const [members, setMembers] = useState<Member[]>(station.members);
  const [saving, setSaving] = useState(false);
  const [addingId, setAddingId] = useState('');

  const assignedBoxes = boxes.filter(b => b.assigned_station_id === station.id);
  const totalEcus = assignedBoxes.reduce((s, b) => s + (b.learned_count ?? 0), 0);
  const completedBoxes = assignedBoxes.filter(b => b.status === 'completed').length;

  const available = allUsers.filter(u => !members.find(m => m.id === u.id));

  const applyMembers = async (newList: Member[]) => {
    setSaving(true);
    try {
      const updated = await updateStationMembers(sessionId, station.id, newList.map(m => m.id));
      setMembers(updated.members);
      onUpdated(updated);
    } catch (err: any) {
      alert(err?.response?.data?.detail ?? 'Error al actualizar miembros');
    } finally {
      setSaving(false);
    }
  };

  const removeMember = (id: string) => {
    const newList = members.filter(m => m.id !== id);
    applyMembers(newList);
  };

  const addMember = () => {
    if (!addingId) return;
    const user = allUsers.find(u => u.id === addingId);
    if (!user || members.find(m => m.id === addingId)) return;
    const newList = [...members, user];
    setAddingId('');
    applyMembers(newList);
  };

  const savePreset = () => {
    const label = window.prompt('Nombre del preset (para reusar en futuras sesiones):', station.name);
    if (!label?.trim()) return;
    const presets = JSON.parse(localStorage.getItem('ecu-station-presets') || '[]');
    const preset = {
      id: Date.now().toString(),
      label: label.trim(),
      name: station.name,
      member_ids: members.map(m => m.id),
      member_names: members.map(m => m.name),
    };
    const existing = presets.filter((p: any) => p.label !== preset.label);
    localStorage.setItem('ecu-station-presets', JSON.stringify([preset, ...existing]));
    alert(`Preset "${preset.label}" guardado.`);
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="card" style={{ width: 640, maxWidth: '95vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0, borderRadius: 10 }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #2e3348', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <span style={{ fontSize: 20 }}>🏭</span>
          <span style={{ fontSize: 18, fontWeight: 700 }}>{station.name}</span>
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Creada {fmtTime(station.created_at)}</span>
          <span style={{ flex: 1 }} />
          {isAdmin && (
            <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={savePreset}>
              💾 Guardar Preset
            </button>
          )}
          {isSessionActive && (
            <button
              className="btn btn-primary"
              style={{ fontSize: 12, padding: '5px 12px' }}
              onClick={() => { onClose(); navigate(`/sessions/${sessionId}/workbench`); }}
            >
              Ir al Workbench →
            </button>
          )}
          <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 18, lineHeight: 1, marginLeft: 4 }} onClick={onClose}>×</button>
        </div>

        {/* Body */}
        <div style={{ overflow: 'auto', flex: 1, padding: 20 }}>

          {/* KPI row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 24 }}>
            {[
              { label: 'Cajas asignadas', value: assignedBoxes.length, color: 'var(--primary)' },
              { label: 'Cajas completadas', value: completedBoxes, color: 'var(--success)' },
              { label: 'ECUs procesados', value: totalEcus },
              { label: 'Miembros', value: members.length, color: 'var(--text)' },
            ].map(k => (
              <div key={k.label} className="card" style={{ textAlign: 'center', padding: '12px 8px' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: k.color ?? 'var(--text)' }}>{k.value}</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 3 }}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* Members */}
          <div style={{ marginBottom: 24 }}>
            <h4 style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Miembros</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: isAdmin ? 12 : 0 }}>
              {members.length === 0 && <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>Sin miembros asignados</span>}
              {members.map(m => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 20, padding: '5px 12px', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{m.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{m.role}</span>
                  {isAdmin && (
                    <button
                      onClick={() => removeMember(m.id)}
                      disabled={saving}
                      style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '0 2px', fontSize: 14, lineHeight: 1 }}
                      title="Quitar miembro"
                    >×</button>
                  )}
                </div>
              ))}
            </div>
            {isAdmin && available.length > 0 && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select
                  value={addingId}
                  onChange={e => setAddingId(e.target.value)}
                  disabled={saving}
                  style={{ flex: 1, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', padding: '6px 10px', borderRadius: 6, fontSize: 13 }}
                >
                  <option value="">— Agregar miembro —</option>
                  {available.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
                <button className="btn btn-primary" style={{ padding: '6px 14px', fontSize: 13 }} onClick={addMember} disabled={!addingId || saving}>
                  {saving ? '…' : 'Agregar'}
                </button>
              </div>
            )}
            {isAdmin && available.length === 0 && members.length > 0 && (
              <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 6 }}>All users are already assigned.</p>
            )}
          </div>

          {/* Assigned boxes */}
          <div>
            <h4 style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Cajas asignadas</h4>
            {assignedBoxes.length === 0 ? (
              <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>No boxes assigned to this station yet.</p>
            ) : (
              <table className="table" style={{ fontSize: 12 }}>
                <thead>
                  <tr>
                    <th>Serial</th>
                    <th>Estado</th>
                    <th>ECUs</th>
                    <th>Frozen</th>
                    <th>Completada</th>
                  </tr>
                </thead>
                <tbody>
                  {assignedBoxes.map(b => (
                    <tr key={b.id}>
                      <td><code style={{ fontSize: 12 }}>{b.box_serial}</code></td>
                      <td><span className={`badge badge-${b.status}`} style={{ color: STATUS_COLOR[b.status] }}>{b.status}</span></td>
                      <td style={{ color: 'var(--text-dim)' }}>
                        {b.learned_count}{b.expected_ecu_count ? `/${b.expected_ecu_count}` : ''}
                      </td>
                      <td style={{ color: b.inventory_frozen ? 'var(--success)' : 'var(--text-dim)' }}>
                        {b.inventory_frozen ? 'Yes' : 'No'}
                      </td>
                      <td style={{ color: 'var(--text-dim)' }}>
                        {b.completed_at ? fmtTime(b.completed_at) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
