import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listSessions, createSession, deleteSession } from '../services/api';
import { useAuthStore, useSessionStore, Session } from '../store/index';
import { format } from 'date-fns';
import UserManagementModal from '../components/UserManagementModal';
import ProfileModal, { AvatarCircle } from '../components/ProfileModal';
import { useT } from '../i18n';

export default function SessionDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { sessions, setSessions } = useSessionStore();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [swVersion, setSwVersion] = useState('');
  const [creating, setCreating] = useState(false);
  const [templates, setTemplates] = useState<Array<{ id: string; label: string; name: string; target_sw_version: string }>>([]);
  const [showUserMgmt, setShowUserMgmt] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const t = useT();
  const loadTemplates = () =>
    setTemplates(JSON.parse(localStorage.getItem('ecu-session-templates') || '[]'));

  const deleteTemplate = (id: string) => {
    const updated = templates.filter((t: { id: string }) => t.id !== id);
    localStorage.setItem('ecu-session-templates', JSON.stringify(updated));
    setTemplates(updated);
  };

  const load = async () => {
    try {
      const data = await listSessions();
      setSessions(data);
    } catch {}
  };

  useEffect(() => { load(); loadTemplates(); }, []);

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
    if (!window.confirm(`Delete session "${sessionName}"?\nAll boxes, ECUs and associated data will also be deleted.`)) return;
    await deleteSession(sessionId);
    load();
  };

  return (
    <>
      <nav className="navbar">
        <span className="navbar-brand">⚡ ECU Reflash</span>
        <span className="navbar-link">Sessions</span>
        <span className="navbar-spacer" />
        {user && (
          <button
            onClick={() => setShowProfile(true)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '4px 8px', borderRadius: 8,
              color: 'var(--text)',
            }}
            title="View profile"
          >
            <AvatarCircle user={user} size={28} />
            <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>{user.name}</span>
          </button>
        )}
        {user?.role === 'admin' && (
          <button
            className="btn btn-ghost"
            style={{ padding: '6px 12px', fontSize: 13, marginRight: 6 }}
            onClick={() => setShowUserMgmt(true)}
          >
            👤 {t.users}
          </button>
        )}
        <button
          className="btn btn-ghost"
          style={{ padding: '6px 12px', fontSize: 13 }}
          onClick={() => { logout(); navigate('/login'); }}
        >
          {t.logout}
        </button>
      </nav>

      {showUserMgmt && user && (
        <UserManagementModal currentUserId={user.id} onClose={() => setShowUserMgmt(false)} />
      )}
      {showProfile && (
        <ProfileModal onClose={() => setShowProfile(false)} />
      )}

      <div className="page">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>{t.flashSessions}</h1>
          {user?.role === 'admin' && (
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>{t.newSession}</button>
          )}
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>{t.colName}</th>
              <th>{t.colSwVersion}</th>
              <th>{t.colStatus}</th>
              <th>{t.colCreated}</th>
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
                    <span style={{ color: 'var(--primary)', fontSize: 13 }}>{t.openSession}</span>
                    {user?.role === 'admin' && (
                      <button
                        className="btn btn-danger"
                        style={{ padding: '3px 10px', fontSize: 12 }}
                        onClick={e => handleDelete(e, s.id, s.name)}
                      >
                        {t.deleteSession}
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
            <h2>{t.newFlashSession}</h2>

            {templates.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>{t.savedTemplates}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {templates.map(t => (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', background: 'var(--surface2)', borderRadius: 6, border: '1px solid var(--border)', overflow: 'hidden' }}>
                      <button
                        type="button"
                        style={{ background: 'none', border: 'none', color: 'var(--primary)', padding: '5px 10px', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
                        onClick={() => { setName(t.name); setSwVersion(t.target_sw_version); }}
                      >
                        {t.label}
                      </button>
                      <button
                        type="button"
                        style={{ background: 'none', border: 'none', color: 'var(--text-dim)', padding: '5px 8px', cursor: 'pointer', fontSize: 12 }}
                        onClick={() => deleteTemplate(t.id)}
                        title="Delete template"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>{t.sessionName}</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Line A – Batch 2026-01"
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>{t.targetSwVersion}</label>
                <input
                  value={swVersion}
                  onChange={e => setSwVersion(e.target.value)}
                  placeholder="v2.5.1-PROD"
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>{t.cancel}</button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? t.creating : t.create}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
