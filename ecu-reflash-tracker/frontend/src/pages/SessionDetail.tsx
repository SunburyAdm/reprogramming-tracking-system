import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getSession, listBoxes, createBox,
  sessionReady, sessionStart, sessionClose, reopenSession,
  getAnalytics, downloadSessionReport,
  getStations, createStation, getUsers,
  deleteBox,
} from '../services/api';
import { useAuthStore, useSessionStore, Box } from '../store/index';
import { format } from 'date-fns';
import BoxDetailDrawer from '../components/BoxDetailDrawer';
import AnalyticsTab from '../components/AnalyticsTab';

export default function SessionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { setCurrentSession } = useSessionStore();
  const [session, setSession] = useState<any>(null);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [tab, setTab] = useState<'boxes' | 'stations' | 'analytics'>('boxes');
  const [analytics, setAnalytics] = useState<any>(null);
  const [selectedBox, setSelectedBox] = useState<Box | null>(null);
  // Add box modal
  const [showAddBox, setShowAddBox] = useState(false);
  const [boxSerial, setBoxSerial] = useState('');
  const [expectedCount, setExpectedCount] = useState('');
  // Add station modal
  const [showAddStation, setShowAddStation] = useState(false);
  const [stationName, setStationName] = useState('');
  const [stations, setStations] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  const load = async () => {
    if (!id) return;
    const [s, b, st] = await Promise.all([getSession(id), listBoxes(id), getStations(id)]);
    setSession(s);
    setCurrentSession(s);
    setBoxes(b);
    setStations(st);
  };

  const loadAnalytics = async () => {
    if (!id) return;
    try { setAnalytics(await getAnalytics(id)); } catch {}
  };

  useEffect(() => { load(); getUsers().then(setAllUsers); }, [id]);
  useEffect(() => { if (tab === 'analytics') loadAnalytics(); }, [tab]);

  const handleTransition = async (fn: () => Promise<any>) => {
    await fn();
    load();
  };

  const handleAddBox = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    await createBox(id, { box_serial: boxSerial, expected_ecu_count: expectedCount ? Number(expectedCount) : undefined });
    setShowAddBox(false);
    setBoxSerial('');
    setExpectedCount('');
    load();
  };

  const handleAddStation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    await createStation(id, { name: stationName, member_ids: selectedMembers });
    setShowAddStation(false);
    setStationName('');
    setSelectedMembers([]);
    load();
  };

  const handleExport = async () => {
    if (!id) return;
    const blob = await downloadSessionReport(id);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `session-${session?.name ?? id}.xlsx`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteBox = async (e: React.MouseEvent, boxId: string, boxSerial: string) => {
    e.stopPropagation();
    if (!id) return;
    if (!window.confirm(`¿Eliminar la caja "${boxSerial}"?\nSe borrarán también todos sus ECUs y registros.`)) return;
    await deleteBox(id, boxId);
    load();
  };

  const handleReopen = async () => {
    if (!id) return;
    if (!window.confirm(
      '⚠️ CASO ESPECIAL — Reabrir Sesión\n\n' +
      'Esta acción revierte una sesión completada/archivada al estado activo.\n' +
      '¿Confirmar reapertura? (Solo para casos autorizados por administración.)'
    )) return;
    try {
      await reopenSession(id);
      load();
    } catch (err: any) {
      alert('Error al reabrir la sesión: ' + (err?.response?.data?.detail ?? err.message));
    }
  };

  if (!session) return (
    <div className="page" style={{ color: 'var(--text-dim)' }}>Loading…</div>
  );

  return (
    <>
      <nav className="navbar">
        <span
          className="navbar-brand"
          style={{ cursor: 'pointer' }}
          onClick={() => navigate('/sessions')}
        >
          ⚡ ECU Reflash
        </span>
        <span
          className="navbar-link"
          onClick={() => navigate('/sessions')}
          style={{ cursor: 'pointer' }}
        >
          Sessions
        </span>
        <span style={{ color: 'var(--text-dim)' }}>/</span>
        <span style={{ fontSize: 14, fontWeight: 500 }}>{session.name}</span>
        <span className="navbar-spacer" />
        <span style={{ fontSize: 13, color: 'var(--text-dim)', marginRight: 12 }}>{user?.name}</span>
        <button
          className="btn btn-ghost"
          style={{ padding: '6px 12px', fontSize: 13, marginRight: 8 }}
          onClick={handleExport}
        >
          ↓ XLSX
        </button>
        {session.status === 'active' && (
          <button
            className="btn btn-primary"
            style={{ padding: '6px 14px', fontSize: 13 }}
            onClick={() => navigate(`/sessions/${id}/workbench`)}
          >
            Station Workbench →
          </button>
        )}
        <button
          className="btn btn-ghost"
          style={{ padding: '6px 10px', fontSize: 13, marginLeft: 8 }}
          onClick={() => { logout(); navigate('/login'); }}
        >
          Logout
        </button>
      </nav>

      <div className="page">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>{session.name}</h1>
          <span className={`badge badge-${session.status}`}>{session.status}</span>
          <code style={{ fontSize: 13, color: 'var(--text-dim)' }}>{session.target_sw_version}</code>
          <span className="navbar-spacer" />
          {user?.role === 'admin' && (
            <div style={{ display: 'flex', gap: 8 }}>
              {session.status === 'draft' && (
                <button className="btn btn-primary" onClick={() => handleTransition(() => sessionReady(id!))}>
                  Mark Ready
                </button>
              )}
              {session.status === 'ready' && (
                <button className="btn btn-success" onClick={() => handleTransition(() => sessionStart(id!))}>
                  Start Session
                </button>
              )}
              {session.status === 'active' && (
                <button className="btn btn-warn" onClick={() => handleTransition(() => sessionClose(id!))}>
                  Close Session
                </button>
              )}
              {(session.status === 'completed' || session.status === 'archived') && (
                <button className="btn btn-danger" onClick={handleReopen}>
                  ⚠️ Reabrir Sesión
                </button>
              )}
            </div>
          )}
        </div>

        <div className="tab-bar">
          <button
            className={`tab-btn ${tab === 'boxes' ? 'active' : ''}`}
            onClick={() => setTab('boxes')}
          >
            Boxes ({boxes.length})
          </button>
          <button
            className={`tab-btn ${tab === 'stations' ? 'active' : ''}`}
            onClick={() => setTab('stations')}
          >
            Stations ({stations.length})
          </button>
          <button
            className={`tab-btn ${tab === 'analytics' ? 'active' : ''}`}
            onClick={() => setTab('analytics')}
          >
            Analytics
          </button>
        </div>

        {tab === 'boxes' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              {session.status === 'active' && user?.role === 'admin' && (
                <button className="btn btn-primary" onClick={() => setShowAddBox(true)}>+ Add Box</button>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {boxes.map((b: Box) => (
                <div
                  key={b.id}
                  className="card"
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelectedBox(b)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ fontWeight: 600, fontSize: 15 }}>{b.box_serial}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className={`badge badge-${b.status}`}>{b.status}</span>
                      {user?.role === 'admin' && (
                        <button
                          className="btn btn-danger"
                          style={{ padding: '2px 8px', fontSize: 11 }}
                          onClick={e => handleDeleteBox(e, b.id, b.box_serial)}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-dim)', display: 'flex', gap: 16 }}>
                    <span>
                      ECUs: <strong style={{ color: 'var(--text)' }}>{b.learned_count}</strong>
                      {b.expected_ecu_count ? `/${b.expected_ecu_count}` : ''}
                    </span>
                    <span>
                      Frozen:{' '}
                      <strong style={{ color: b.inventory_frozen ? 'var(--success)' : 'var(--text-dim)' }}>
                        {b.inventory_frozen ? 'Yes' : 'No'}
                      </strong>
                    </span>
                  </div>
                  {b.completed_at && (
                    <div style={{ fontSize: 12, color: 'var(--success)', marginTop: 8 }}>
                      ✓ Completed {format(new Date(b.completed_at), 'dd MMM HH:mm')}
                    </div>
                  )}
                </div>
              ))}
              {boxes.length === 0 && <p style={{ color: 'var(--text-dim)' }}>No boxes yet.</p>}
            </div>
          </>
        )}

        {tab === 'stations' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              {user?.role === 'admin' && session.status !== 'archived' && (
                <button className="btn btn-primary" onClick={() => setShowAddStation(true)}>+ Add Station</button>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
              {stations.map((s: any) => (
                <div key={s.id} className="card">
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>🏭 {s.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>
                    Members: {s.members?.map((m: any) => m.name).join(', ') || 'None'}
                  </div>
                </div>
              ))}
              {stations.length === 0 && <p style={{ color: 'var(--text-dim)' }}>No stations yet.</p>}
            </div>
          </>
        )}

        {tab === 'analytics' && <AnalyticsTab analytics={analytics} />}
      </div>

      {selectedBox && (
        <BoxDetailDrawer
          sessionId={id!}
          box={selectedBox}
          onClose={() => setSelectedBox(null)}
          onRefresh={load}
        />
      )}

      {showAddBox && (
        <div className="modal-overlay" onClick={() => setShowAddBox(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Add Box</h2>
            <form onSubmit={handleAddBox}>
              <div className="form-group">
                <label>Box Serial</label>
                <input
                  value={boxSerial}
                  onChange={e => setBoxSerial(e.target.value)}
                  placeholder="BOX-001"
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Expected ECU Count (optional)</label>
                <input
                  value={expectedCount}
                  onChange={e => setExpectedCount(e.target.value)}
                  placeholder="20"
                  type="number"
                  min="1"
                />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowAddBox(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add Box</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddStation && (
        <div className="modal-overlay" onClick={() => setShowAddStation(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Add Station</h2>
            <form onSubmit={handleAddStation}>
              <div className="form-group">
                <label>Station Name</label>
                <input
                  value={stationName}
                  onChange={e => setStationName(e.target.value)}
                  placeholder="Station A"
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Assign Members</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {allUsers.map((u: any) => (
                    <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={selectedMembers.includes(u.id)}
                        onChange={e => {
                          if (e.target.checked) setSelectedMembers(p => [...p, u.id]);
                          else setSelectedMembers(p => p.filter(id => id !== u.id));
                        }}
                      />
                      {u.name} <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>({u.role})</span>
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowAddStation(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add Station</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
