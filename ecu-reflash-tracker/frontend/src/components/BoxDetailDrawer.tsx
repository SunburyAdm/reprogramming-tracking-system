import { useEffect, useState } from 'react';
import { getBoxEcus, downloadBoxReport, deleteEcu } from '../services/api';
import { Box, ECUContext } from '../store/index';
import { format } from 'date-fns';
import EcuDetailModal from './EcuDetailModal';
import { useAuthStore } from '../store/index';

interface Props {
  sessionId: string;
  box: Box;
  onClose: () => void;
  onRefresh: () => void;
}

export default function BoxDetailDrawer({ sessionId, box, onClose, onRefresh }: Props) {
  const { user } = useAuthStore();
  const [ecus, setEcus] = useState<ECUContext[]>([]);
  const [selectedEcu, setSelectedEcu] = useState<ECUContext | null>(null);

  useEffect(() => {
    getBoxEcus(sessionId, box.id).then(setEcus);
  }, [box.id]);

  const countBy = (status: string) => ecus.filter(e => e.status === status).length;
  const success = countBy('success');
  const failed = countBy('failed');
  const flashing = countBy('flashing');
  const learned = countBy('learned');
  const rework = countBy('rework_pending');

  const handleDeleteEcu = async (ecu: ECUContext) => {
    if (!window.confirm(`Delete ECU "${ecu.ecu_code}"?`)) return;
    try {
      await deleteEcu(sessionId, box.id, ecu.id);
      setEcus(prev => prev.filter(e => e.id !== ecu.id));
      onRefresh();
    } catch (err: any) {
      alert(err?.response?.data?.detail ?? 'Error al eliminar ECU');
    }
  };

  const handleExport = async () => {
    try {
      const blob = await downloadBoxReport(sessionId, box.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `box-${box.box_serial}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err?.response?.data?.detail ?? 'Export failed');
    }
  };

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer">
        <div className="drawer-header">
          <h2>{box.box_serial}</h2>
          <span className={`badge badge-${box.status}`}>{box.status}</span>
          <span className="navbar-spacer" />
          <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 13 }} onClick={handleExport}>
            ↓ XLSX
          </button>
          <button
            className="btn btn-ghost"
            style={{ padding: '5px 10px', marginLeft: 6 }}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* KPI row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Learned', value: learned, color: 'var(--primary)' },
            { label: 'Flashing', value: flashing, color: '#a78bfa' },
            { label: 'Success', value: success, color: 'var(--success)' },
            { label: 'Failed', value: failed, color: 'var(--error)' },
            { label: 'Rework', value: rework, color: 'var(--warn)' },
          ].map(k => (
            <div key={k.label} className="card" style={{ textAlign: 'center', padding: '12px 8px' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: k.color }}>{k.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* Meta */}
        <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--text-dim)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <span>
            Frozen:{' '}
            <strong style={{ color: box.inventory_frozen ? 'var(--success)' : 'var(--text-dim)' }}>
              {box.inventory_frozen ? 'Yes' : 'No'}
            </strong>
          </span>
          {box.frozen_at && (
            <span>at {format(new Date(box.frozen_at), 'dd MMM HH:mm')}</span>
          )}
          {box.expected_ecu_count && (
            <span>Expected: {box.expected_ecu_count}</span>
          )}
          <span>Total: {ecus.length}</span>
        </div>

        {/* ECU table */}
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>ECU Code</th>
              <th>Status</th>
              <th>Attempts</th>
              <th>Total Time</th>
              {user?.role === 'admin' && !box.inventory_frozen && <th></th>}
            </tr>
          </thead>
          <tbody>
            {ecus.map((e, i) => (
              <tr key={e.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedEcu(e)}>
                <td style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'underline dotted' }}>{i + 1}</td>
                <td><code style={{ fontSize: 13, color: 'var(--primary)', cursor: 'pointer' }}>{e.ecu_code}</code></td>
                <td><span className={`badge badge-${e.status}`}>{e.status}</span></td>
                <td style={{ color: 'var(--text-dim)' }}>{e.attempts}</td>
                <td style={{ color: 'var(--text-dim)' }}>
                  {e.total_time_seconds != null ? `${Math.round(e.total_time_seconds)}s` : '—'}
                </td>
                {user?.role === 'admin' && !box.inventory_frozen && (
                  <td onClick={ev => ev.stopPropagation()}>
                    {e.status === 'learned' && (
                      <button
                        className="btn btn-danger"
                        style={{ padding: '2px 8px', fontSize: 11 }}
                        title="Eliminar ECU"
                        onClick={() => handleDeleteEcu(e)}
                      >✕</button>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {ecus.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-dim)', padding: 24 }}>
                  No ECUs in this box
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {selectedEcu && (
        <EcuDetailModal
          sessionId={sessionId}
          ecu={selectedEcu}
          onClose={() => setSelectedEcu(null)}
        />
      )}
    </>
  );
}
