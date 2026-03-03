import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listSessions, createSession, deleteSession } from '../services/api';
import { useAuthStore, useSessionStore, Session } from '../store/index';
import { format } from 'date-fns';

export default function SessionDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { sessions, setSessions } = useSessionStore();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [swVersion, setSwVersion] = useState('');
  const [creating, setCreating] = useState(false);

  const load = async () => {
    try {
      const data = await listSessions();
      setSessions(data);
    } catch {}
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await createSession({ name, target_sw_version: swVersion });
      setShowCreate(false);
      setName('');
      setSwVersion('');
      load();
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, sessionId: string, sessionName: string) => {
    e.stopPropagation();
    if (!window.confirm(`¿Eliminar la sesión "${sessionName}"?\nSe borrarán también todas las cajas, ECUs y datos asociados.`)) return;
    await deleteSession(sessionId);
    load();
  };

  return (
    <>
      <nav className="navbar">
        <span className="navbar-brand">⚡ ECU Reflash</span>
        <span className="navbar-link">Sessions</span>
        <span className="navbar-spacer" />
        <span style={{ fontSize: 13, color: 'var(--text-dim)', marginRight: 12 }}>{user?.name}</span>
        <button
          className="btn btn-ghost"
          style={{ padding: '6px 12px', fontSize: 13 }}
          onClick={() => { logout(); navigate('/login'); }}
        >
          Logout
        </button>
      </nav>

      <div className="page">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Flash Sessions</h1>
          {user?.role === 'admin' && (
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New Session</button>
          )}
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>SW Version</th>
              <th>Status</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s: Session) => (
              <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/sessions/${s.id}`)}>
                <td style={{ fontWeight: 500 }}>{s.name}</td>
                <td><code style={{ fontSize: 13 }}>{s.target_sw_version}</code></td>
                <td><span className={`badge badge-${s.status}`}>{s.status}</span></td>
                <td style={{ color: 'var(--text-dim)', fontSize: 13 }}>
                  {s.created_at ? format(new Date(s.created_at), 'dd MMM yyyy HH:mm') : '—'}
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ color: 'var(--primary)', fontSize: 13 }}>Open →</span>
                    {user?.role === 'admin' && (
                      <button
                        className="btn btn-danger"
                        style={{ padding: '3px 10px', fontSize: 12 }}
                        onClick={e => handleDelete(e, s.id, s.name)}
                      >
                        Borrar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {sessions.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-dim)', padding: 32 }}>
                  No sessions yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>New Flash Session</h2>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Session Name</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Line A – Batch 2026-01"
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Target SW Version</label>
                <input
                  value={swVersion}
                  onChange={e => setSwVersion(e.target.value)}
                  placeholder="v2.5.1-PROD"
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
