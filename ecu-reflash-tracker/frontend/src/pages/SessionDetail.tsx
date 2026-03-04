import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getSession, listBoxes, createBox,
  sessionReady, sessionStart, sessionClose, reopenSession,
  getAnalytics, downloadSessionReport,
  getStations, createStation, getUsers,
  deleteBox, updateBoxStatus,
} from '../services/api';
import { useAuthStore, useSessionStore, useWorkbenchStore, Box } from '../store/index';
import { format } from 'date-fns';
import BoxDetailDrawer from '../components/BoxDetailDrawer';
import AnalyticsTab from '../components/AnalyticsTab';
import StationDetailModal from '../components/StationDetailModal';
import BoxKanban from '../components/BoxKanban';
import ProfileModal, { AvatarCircle } from '../components/ProfileModal';

export default function SessionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { setCurrentSession } = useSessionStore();
  const { setStation } = useWorkbenchStore();
  const [session, setSession] = useState<any>(null);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [templateLabel, setTemplateLabel] = useState('');
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [tab, setTab] = useState<'boxes' | 'stations' | 'setups' | 'analytics'>('boxes');
  const [boxView, setBoxView] = useState<'kanban' | 'grid'>('kanban');
  const [boxSearch, setBoxSearch] = useState('');
  const [boxStatusFilter, setBoxStatusFilter] = useState<string>('all');
  const [boxStationFilter, setBoxStationFilter] = useState<string>('all');
  const [boxHasIssues, setBoxHasIssues] = useState(false);
  const [boxSort, setBoxSort] = useState<'serial' | 'created' | 'completed' | 'ecus' | 'issues'>('serial');
  const [boxSortDir, setBoxSortDir] = useState<'asc' | 'desc'>('asc');
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
  const [selectedStation, setSelectedStation] = useState<any | null>(null);
  const [stationPresets] = useState<any[]>(() =>
    JSON.parse(localStorage.getItem('ecu-station-presets') || '[]')
  );

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

  // Initial load + background polling every 5 s
  const tabRef = useRef(tab);
  useEffect(() => { tabRef.current = tab; }, [tab]);

  useEffect(() => {
    load();
    getUsers().then(setAllUsers);

    const interval = setInterval(() => {
      load();
      if (tabRef.current === 'analytics') loadAnalytics();
    }, 5000);

    return () => clearInterval(interval);
  }, [id]);

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
    if (!window.confirm(`Delete box "${boxSerial}"?\nAll its ECUs and records will also be deleted.`)) return;
    await deleteBox(id, boxId);
    load();
  };

  const handleBoxStatusChange = async (boxId: string, newStatus: string) => {
    if (!id) return;
    try { await updateBoxStatus(id, boxId, newStatus); load(); } catch {}
  };

  const handleGoToStation = (stationId: string) => {
    setStation(stationId);
    navigate(`/sessions/${id}/workbench`);
  };

  const handleStationUpdated = (updated: any) => {
    setStations((prev: any[]) => prev.map((s: any) => s.id === updated.id ? updated : s));
    setSelectedStation(updated);
  };

  const handleSaveTemplate = () => {
    if (!session || !templateLabel.trim()) return;
    const templates = JSON.parse(localStorage.getItem('ecu-session-templates') || '[]');
    const tpl = { id: Date.now().toString(), label: templateLabel.trim(), name: session.name, target_sw_version: session.target_sw_version };
    localStorage.setItem('ecu-session-templates', JSON.stringify([tpl, ...templates.filter((t: any) => t.label !== tpl.label)]));
    setShowSaveTemplate(false);
    setTemplateLabel('');
    alert(`Template "${tpl.label}" saved.`);
  };

  const handleReopen = async () => {
    if (!id) return;
    if (!window.confirm(
      '⚠️ SPECIAL CASE — Reopen Session\n\n' +
      'This action reverts a completed/archived session back to active status.\n' +
      'Confirm reopening? (Only for cases authorized by administration.)'
    )) return;
    try {
      await reopenSession(id);
      load();
    } catch (err: any) {
      alert('Error reopening session: ' + (err?.response?.data?.detail ?? err.message));
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
        {user && (
          <button
            onClick={() => setShowProfile(true)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '4px 8px', borderRadius: 8,
              color: 'var(--text)',
              marginRight: 8,
            }}
            title="View profile"
          >
            <AvatarCircle user={user} size={28} />
            <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>{user.name}</span>
          </button>
        )}
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
                  ⚠️ Reopen Session
                </button>
              )}
              <button
                className="btn btn-ghost"
                style={{ padding: '6px 12px', fontSize: 13 }}
                onClick={() => { setTemplateLabel(session.name); setShowSaveTemplate(true); }}
              >
                📋 Save Template
              </button>
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
            className={`tab-btn ${tab === 'setups' ? 'active' : ''}`}
            onClick={() => setTab('setups')}
          >
            Setups
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
            {/* Search + filter bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Search box…"
                value={boxSearch}
                onChange={e => setBoxSearch(e.target.value)}
                style={{
                  background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 7,
                  color: 'var(--text)', padding: '5px 12px', fontSize: 13, width: 180,
                }}
              />
              {(['all','pending','learning','in_progress','blocked','completed'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setBoxStatusFilter(s)}
                  style={{
                    padding: '4px 10px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 5,
                    cursor: 'pointer', transition: 'all .15s',
                    background: boxStatusFilter === s ? 'var(--primary)' : 'var(--surface2)',
                    color: boxStatusFilter === s ? '#fff' : 'var(--text-dim)',
                  }}
                >{s === 'all' ? 'All' : s === 'in_progress' ? 'In progress' : s.charAt(0).toUpperCase() + s.slice(1)}</button>
              ))}
              <button
                onClick={() => setBoxHasIssues(v => !v)}
                style={{
                  padding: '4px 10px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 5,
                  cursor: 'pointer', transition: 'all .15s',
                  background: boxHasIssues ? '#ef4444' : 'var(--surface2)',
                  color: boxHasIssues ? '#fff' : 'var(--text-dim)',
                }}
              >⚠ With issues</button>
              <select
                value={boxStationFilter}
                onChange={e => setBoxStationFilter(e.target.value)}
                style={{
                  background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 7,
                  color: boxStationFilter !== 'all' ? 'var(--primary)' : 'var(--text-dim)',
                  padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}
              >
                <option value="all">All stations</option>
                <option value="__none__">No station</option>
                {stations.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <select
                value={boxSort}
                onChange={e => setBoxSort(e.target.value as any)}
                style={{
                  background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 7,
                  color: 'var(--text-dim)', padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}
              >
                <option value="serial">Sort: Name</option>
                <option value="created">Sort: Created</option>
                <option value="completed">Sort: Completed</option>
                <option value="ecus">Sort: ECUs</option>
                <option value="issues">Sort: Issues</option>
              </select>
              <button
                onClick={() => setBoxSortDir(d => d === 'asc' ? 'desc' : 'asc')}
                title={boxSortDir === 'asc' ? 'Ascendente' : 'Descendente'}
                style={{
                  background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 7,
                  color: 'var(--text-dim)', padding: '4px 9px', fontSize: 14, cursor: 'pointer', lineHeight: 1,
                }}
              >{boxSortDir === 'asc' ? '↑' : '↓'}</button>
              <span style={{ flex: 1 }} />
              {/* View toggle */}
              <div style={{ display: 'flex', background: 'var(--surface2)', borderRadius: 7, padding: 3, gap: 2 }}>
                <button
                  onClick={() => setBoxView('kanban')}
                  style={{
                    padding: '4px 12px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 5, cursor: 'pointer',
                    background: boxView === 'kanban' ? 'var(--primary)' : 'transparent',
                    color: boxView === 'kanban' ? '#fff' : 'var(--text-dim)',
                    transition: 'all .15s',
                  }}
                >⬜ Kanban</button>
                <button
                  onClick={() => setBoxView('grid')}
                  style={{
                    padding: '4px 12px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 5, cursor: 'pointer',
                    background: boxView === 'grid' ? 'var(--primary)' : 'transparent',
                    color: boxView === 'grid' ? '#fff' : 'var(--text-dim)',
                    transition: 'all .15s',
                  }}
                >▦ Grid</button>
              </div>
              {session.status === 'active' && (user?.role === 'admin' || user?.role === 'tech') && (
                <button className="btn btn-primary" onClick={() => setShowAddBox(true)}>+ Add Box</button>
              )}
            </div>

            {(() => {
              const filtered = boxes.filter(b => {
                const matchSearch = !boxSearch || b.box_serial.toLowerCase().includes(boxSearch.toLowerCase());
                const matchStatus = boxStatusFilter === 'all' || b.status === boxStatusFilter;
                const matchStation = boxStationFilter === 'all'
                  || (boxStationFilter === '__none__' ? !b.assigned_station_id : b.assigned_station_id === boxStationFilter);
                const matchIssues = !boxHasIssues || (b.failed_count > 0 || b.scratch_count > 0);
                return matchSearch && matchStatus && matchStation && matchIssues;
              });
              const dir = boxSortDir === 'asc' ? 1 : -1;
              const sorted = [...filtered].sort((a, b) => {
                switch (boxSort) {
                  case 'serial': return dir * a.box_serial.localeCompare(b.box_serial);
                  case 'created': return dir * (new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime());
                  case 'completed': return dir * (new Date(a.completed_at ?? 0).getTime() - new Date(b.completed_at ?? 0).getTime());
                  case 'ecus': return dir * ((a.learned_count ?? 0) - (b.learned_count ?? 0));
                  case 'issues': return dir * ((a.failed_count + a.scratch_count) - (b.failed_count + b.scratch_count));
                  default: return 0;
                }
              });
              return boxView === 'kanban' ? (
              <BoxKanban
                boxes={sorted}
                isAdmin={user?.role === 'admin'}
                onCardClick={b => setSelectedBox(b)}
                onDelete={handleDeleteBox}
                onStatusChange={handleBoxStatusChange}
              />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {sorted.map((b: Box) => (
                <div
                  key={b.id}
                  className="card"
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelectedBox(b)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: 15 }}>{b.box_serial}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className={`badge badge-${b.status}`}>{b.status}</span>
                      {user?.role === 'admin' && (
                        <button
                          className="btn btn-danger"
                          style={{ padding: '2px 8px', fontSize: 11 }}
                          onClick={e => handleDeleteBox(e, b.id, b.box_serial)}
                        >✕</button>
                      )}
                    </div>
                  </div>
                  {b.assigned_station_name && (
                    <div style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600, marginBottom: 6 }}>
                      📍 {b.assigned_station_name}
                    </div>
                  )}
                  <div style={{ fontSize: 13, color: 'var(--text-dim)', display: 'flex', gap: 16, marginBottom: 6 }}>
                    <span>ECUs: <strong style={{ color: 'var(--text)' }}>{b.learned_count}{b.expected_ecu_count ? `/${b.expected_ecu_count}` : ''}</strong></span>
                    <span>Frozen: <strong style={{ color: b.inventory_frozen ? 'var(--success)' : 'var(--text-dim)' }}>{b.inventory_frozen ? 'Yes' : 'No'}</strong></span>
                  </div>
                  {(b.failed_count > 0 || b.scratch_count > 0) && (
                    <div style={{ fontSize: 11, display: 'flex', gap: 10, marginBottom: 4 }}>
                      {b.failed_count > 0 && <span style={{ color: '#ef4444', fontWeight: 600 }}>✗ {b.failed_count} failed</span>}
                      {b.scratch_count > 0 && <span style={{ color: '#6b7280', fontWeight: 600 }}>🗑 {b.scratch_count} scratch</span>}
                    </div>
                  )}
                  {b.completed_at && (
                    <div style={{ fontSize: 12, color: 'var(--success)', marginTop: 4 }}>
                      ✓ Completed {format(new Date(b.completed_at), 'dd MMM HH:mm')}
                    </div>
                  )}
                </div>
              ))}
              {sorted.length === 0 && <p style={{ color: 'var(--text-dim)' }}>No boxes match.</p>}
            </div>
            );
            })()}
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
                <div
                  key={s.id}
                  className="card"
                  style={{ cursor: 'pointer', position: 'relative' }}
                  onClick={() => setSelectedStation(s)}
                >
                  {session.status === 'active' && (
                    <div
                      style={{ position: 'absolute', top: 10, right: 10, fontSize: 11, color: 'var(--primary)', fontWeight: 600 }}
                      onClick={e => { e.stopPropagation(); handleGoToStation(s.id); }}
                    >
                      Workbench →
                    </div>
                  )}
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

        {tab === 'setups' && (
          <div>
            {stations.every((s: any) => !s.setups || s.setups.length === 0) && (
              <p style={{ color: 'var(--text-dim)', padding: '20px 0' }}>No setups registered in any station.</p>
            )}
            {stations.map((s: any) => {
              const setups = s.setups ?? [];
              if (setups.length === 0) return null;
              // Collect all unique attribute keys across all setups of this station
              const allKeys = Array.from(
                new Set(setups.flatMap((su: any) => Object.keys(su.attributes ?? {})))
              ) as string[];
              return (
                <div key={s.id} style={{ marginBottom: 32 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                    🏭 {s.name}
                    <span style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 400 }}>{setups.length} setup{setups.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="table" style={{ width: '100%' }}>
                      <thead>
                        <tr>
                          <th>Name</th>
                          {allKeys.map(k => <th key={k}>{k}</th>)}
                          <th style={{ color: 'var(--text-dim)', fontSize: 11 }}>Added</th>
                        </tr>
                      </thead>
                      <tbody>
                        {setups.map((su: any) => (
                          <tr key={su.id}>
                            <td style={{ fontWeight: 600 }}>🔧 {su.name}</td>
                            {allKeys.map(k => (
                              <td key={k} style={{ color: su.attributes?.[k] ? 'var(--text)' : 'var(--text-dim)' }}>
                                {su.attributes?.[k] ?? '—'}
                              </td>
                            ))}
                            <td style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                              {su.created_at ? format(new Date(su.created_at), 'MMM d, yyyy') : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
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

      {selectedStation && (
        <StationDetailModal
          sessionId={id!}
          station={selectedStation}
          allUsers={allUsers}
          boxes={boxes}
          isAdmin={user?.role === 'admin'}
          isSessionActive={session.status === 'active'}
          onClose={() => setSelectedStation(null)}
          onUpdated={handleStationUpdated}
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

      {showSaveTemplate && (
        <div className="modal-overlay" onClick={() => setShowSaveTemplate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Save as Template</h2>
            <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 16 }}>
              Saves the session name and SW version to prefill future sessions.
            </p>
            <div className="form-group">
              <label>Template Name</label>
              <input
                value={templateLabel}
                onChange={e => setTemplateLabel(e.target.value)}
                placeholder="E.g.: Line A \u2013 Standard"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleSaveTemplate()}
              />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 16 }}>
              Name: <strong>{session?.name}</strong> · SW: <strong>{session?.target_sw_version}</strong>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowSaveTemplate(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveTemplate} disabled={!templateLabel.trim()}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddStation && (
        <div className="modal-overlay" onClick={() => setShowAddStation(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Add Station</h2>

            {stationPresets.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>Saved presets:</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {stationPresets.map((p: any) => (
                    <button
                      key={p.id}
                      type="button"
                      style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--primary)', padding: '5px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
                      onClick={() => {
                        setStationName(p.name);
                        const validIds = (p.member_ids as string[]).filter((mid: string) => allUsers.find((u: any) => u.id === mid));
                        setSelectedMembers(validIds);
                      }}
                      title={`Members: ${p.member_names?.join(', ') || 'none'}`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
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
                <div style={{
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  overflow: 'hidden',
                  maxHeight: 220,
                  overflowY: 'auto',
                }}>
                  {allUsers.length === 0 && (
                    <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-dim)' }}>No users available</div>
                  )}
                  {allUsers.map((u: any, idx: number) => (
                    <label
                      key={u.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '9px 14px',
                        cursor: 'pointer',
                        background: selectedMembers.includes(u.id) ? 'rgba(99,102,241,.08)' : 'transparent',
                        borderTop: idx > 0 ? '1px solid var(--border)' : 'none',
                        userSelect: 'none',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedMembers.includes(u.id)}
                        onChange={e => {
                          if (e.target.checked) setSelectedMembers(p => [...p, u.id]);
                          else setSelectedMembers(p => p.filter(id => id !== u.id));
                        }}
                        style={{ accentColor: 'var(--primary)', width: 15, height: 15, flexShrink: 0 }}
                      />
                      <span style={{ fontSize: 14, fontWeight: 500, flex: 1 }}>{u.name}</span>
                      <span style={{
                        fontSize: 11, color: 'var(--text-dim)',
                        background: 'var(--surface2)',
                        border: '1px solid var(--border)',
                        borderRadius: 4, padding: '1px 6px',
                      }}>{u.role}</span>
                    </label>
                  ))}
                </div>
                {selectedMembers.length > 0 && (
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 6, paddingLeft: 2 }}>
                    {selectedMembers.length} member{selectedMembers.length !== 1 ? 's' : ''} selected
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowAddStation(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add Station</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showProfile && (
        <ProfileModal onClose={() => setShowProfile(false)} />
      )}
    </>
  );
}
