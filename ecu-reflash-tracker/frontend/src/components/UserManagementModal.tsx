import { useEffect, useState } from 'react';
import { getUsers, createUser, updateUser, deleteUser } from '../services/api';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

const ROLE_COLOR: Record<string, string> = {
  admin: '#ef4444',
  tech:  '#4f8ef7',
  viewer:'#8892a4',
};

const EMPTY_FORM = { name: '', email: '', password: '', role: 'tech' };

interface Props {
  currentUserId: string;
  onClose: () => void;
}

export default function UserManagementModal({ currentUserId, onClose }: Props) {
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState<User | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try { setUsers(await getUsers()); } catch {}
  };

  useEffect(() => { load(); }, []);

  const startEdit = (u: User) => {
    setEditing(u);
    setForm({ name: u.name, email: u.email, password: '', role: u.role });
    setError('');
  };

  const reset = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError('');
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) { setError('Name and email are required.'); return; }
    if (!editing && !form.password.trim()) { setError('Password is required for new users.'); return; }
    setSaving(true);
    setError('');
    try {
      if (editing) {
        const payload: any = { name: form.name, email: form.email, role: form.role };
        if (form.password.trim()) payload.password = form.password;
        await updateUser(editing.id, payload);
      } else {
        await createUser({ name: form.name, email: form.email, password: form.password, role: form.role });
      }
      reset();
      load();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Error saving.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (u: User) => {
    if (!confirm(`Delete ${u.name}? This action cannot be undone.`)) return;
    try {
      await deleteUser(u.id);
      load();
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? 'Error deleting.');
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="card" style={{ width: 640, maxHeight: '85vh', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 18, margin: 0 }}>👤 User Management</h2>
          <button className="btn" style={{ padding: '2px 10px' }} onClick={onClose}>✕</button>
        </div>

        {/* Form */}
        <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: 'var(--primary)' }}>
            {editing ? `✏️ Editing: ${editing.name}` : '➕ New User'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <input
              placeholder="Nombre completo"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '6px 10px', fontSize: 13 }}
            />
            <input
              placeholder="Email"
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '6px 10px', fontSize: 13 }}
            />
            <input
              placeholder={editing ? 'New password (leave blank = no change)' : 'Password'}
              type="password"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '6px 10px', fontSize: 13 }}
            />
            <select
              value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '6px 10px', fontSize: 13 }}
            >
              <option value="tech">Tech</option>
              <option value="viewer">Viewer</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {error && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 8 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create User'}
            </button>
            {editing && (
              <button className="btn" style={{ fontSize: 13 }} onClick={reset}>Cancel</button>
            )}
          </div>
        </div>

        {/* User list */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <table className="table" style={{ fontSize: 13 }}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ opacity: editing?.id === u.id ? 0.5 : 1 }}>
                  <td style={{ fontWeight: 600 }}>{u.name}</td>
                  <td style={{ color: 'var(--text-dim)' }}>{u.email}</td>
                  <td>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                      background: `${ROLE_COLOR[u.role]}22`, color: ROLE_COLOR[u.role],
                    }}>{u.role}</span>
                  </td>
                  <td style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button className="btn" style={{ padding: '2px 9px', fontSize: 12 }} onClick={() => startEdit(u)}>✏️</button>
                    {u.id !== currentUserId && (
                      <button className="btn btn-danger" style={{ padding: '2px 9px', fontSize: 12 }} onClick={() => handleDelete(u)}>🗑</button>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-dim)', padding: 20 }}>No users</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
