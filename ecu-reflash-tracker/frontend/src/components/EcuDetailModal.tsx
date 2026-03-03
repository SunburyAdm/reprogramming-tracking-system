import { useEffect, useState, useRef } from 'react';
import { format } from 'date-fns';
import { getEcuAttempts, getEcuHistory, getEcuUploads, uploadEcuFile } from '../services/api';

interface ECUContext {
  id: string;
  session_id: string;
  box_id: string;
  ecu_code: string;
  status: string;
  attempts: number;
  total_time_seconds: number;
  last_attempt_duration_seconds: number | null;
  current_attempt_started_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

interface FlashAttempt {
  id: string;
  attempt_no: number;
  started_at: string;
  ended_at: string | null;
  result: string;
  duration_seconds: number | null;
  notes: string | null;
  station_id: string | null;
  user_id: string | null;
}

interface HistoryEntry {
  id: string;
  action: string;
  data: Record<string, unknown> | null;
  user_id: string | null;
  created_at: string;
}

interface UploadEntry {
  id: string;
  filename: string;
  file_size: number;
  kind: string;
  notes: string | null;
  uploader_id: string;
  created_at: string;
}

interface Props {
  sessionId: string;
  ecu: ECUContext;
  onClose: () => void;
}

function fmtTime(iso: string | null | undefined) {
  if (!iso) return '—';
  try { return format(new Date(iso), 'dd/MM/yy HH:mm:ss'); } catch { return iso; }
}

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

const STATUS_COLOR: Record<string, string> = {
  success: 'var(--success)',
  failed: 'var(--error)',
  flashing: 'var(--primary)',
  rework_pending: '#f59e0b',
  pending: 'var(--text-dim)',
  learned: '#a855f7',
};

export default function EcuDetailModal({ sessionId, ecu, onClose }: Props) {
  const [tab, setTab] = useState<'info' | 'history' | 'uploads'>('info');
  const [attempts, setAttempts] = useState<FlashAttempt[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [uploads, setUploads] = useState<UploadEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadKind, setUploadKind] = useState('log');
  const [uploadNotes, setUploadNotes] = useState('');
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reload = () => {
    setLoading(true);
    Promise.all([
      getEcuAttempts(sessionId, ecu.box_id, ecu.id),
      getEcuHistory(sessionId, ecu.box_id, ecu.id),
      getEcuUploads(sessionId, ecu.box_id, ecu.id),
    ]).then(([a, h, u]) => {
      setAttempts(a);
      setHistory(h);
      setUploads(u);
    }).catch(console.error)
      .finally(() => setLoading(false));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError('');
    try {
      await uploadEcuFile(sessionId, ecu.box_id, ecu.id, file, uploadKind, uploadNotes || undefined);
      setUploadNotes('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      reload();
    } catch (err: any) {
      setUploadError(err?.response?.data?.detail ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => { reload(); }, [sessionId, ecu.id, ecu.box_id]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="card"
        style={{
          width: 720, maxWidth: '95vw', maxHeight: '85vh',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          padding: 0, borderRadius: 10,
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid #2e3348',
          display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
        }}>
          <span style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace' }}>{ecu.ecu_code}</span>
          <span
            className={`badge badge-${ecu.status}`}
            style={{ color: STATUS_COLOR[ecu.status] ?? 'var(--text)' }}
          >
            {ecu.status}
          </span>
          <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>
          {ecu.attempts} attempt{ecu.attempts !== 1 ? 's' : ''} · {Math.round(ecu.total_time_seconds)}s total
          </span>
          <span style={{ flex: 1 }} />
          <button
            className="btn btn-ghost"
            style={{ padding: '4px 10px', fontSize: 18, lineHeight: 1 }}
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {/* Tab bar */}
        <div className="tab-bar" style={{ borderBottom: '1px solid #2e3348', flexShrink: 0 }}>
          <button
            className={`tab-btn ${tab === 'info' ? 'active' : ''}`}
            onClick={() => setTab('info')}
          >
            Attempts ({attempts.length})
          </button>
          <button
            className={`tab-btn ${tab === 'history' ? 'active' : ''}`}
            onClick={() => setTab('history')}
          >
            History ({history.length})
          </button>
          <button
            className={`tab-btn ${tab === 'uploads' ? 'active' : ''}`}
            onClick={() => setTab('uploads')}
          >
            Files ({uploads.length})
          </button>
        </div>

        {/* Body */}
        <div style={{ overflow: 'auto', flex: 1, padding: 20 }}>
          {loading ? (
            <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: 40 }}>Loading…</div>
          ) : tab === 'info' ? (
            <>
              {/* ECU meta */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                {[
                  { label: 'ECU Code', value: ecu.ecu_code },
                  { label: 'Status', value: ecu.status },
                  { label: 'Version', value: ecu.version },
                  { label: 'Total attempts', value: ecu.attempts },
                  { label: 'Total time', value: `${Math.round(ecu.total_time_seconds)}s` },
                  { label: 'Last attempt', value: ecu.last_attempt_duration_seconds != null ? `${ecu.last_attempt_duration_seconds.toFixed(1)}s` : '—' },
                  { label: 'Created', value: fmtTime(ecu.created_at) },
                  { label: 'Updated', value: fmtTime(ecu.updated_at) },
                ].map(({ label, value }) => (
                  <div key={label} style={{ background: '#1a1d27', borderRadius: 6, padding: '10px 14px' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{String(value)}</div>
                  </div>
                ))}
              </div>

              {/* Attempts table */}
              <h4 style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 10 }}>Flash Attempts</h4>
              {attempts.length === 0 ? (
                <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>No attempts recorded</div>
              ) : (
                <table className="table" style={{ fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Start</th>
                      <th>End</th>
                      <th>Duration</th>
                      <th>Result</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attempts.map(a => (
                      <tr key={a.id}>
                        <td>{a.attempt_no}</td>
                        <td>{fmtTime(a.started_at)}</td>
                        <td>{fmtTime(a.ended_at)}</td>
                        <td>{a.duration_seconds != null ? `${a.duration_seconds.toFixed(1)}s` : '—'}</td>
                        <td>
                          <span style={{ color: a.result === 'success' ? 'var(--success)' : a.result === 'failed' ? 'var(--error)' : 'var(--text-dim)' }}>
                            {a.result}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-dim)' }}>{a.notes ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          ) : tab === 'history' ? (
            history.length === 0 ? (
              <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: 40 }}>No history</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {history.map(h => (
                  <div key={h.id} style={{ background: '#1a1d27', borderRadius: 6, padding: '10px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{h.action}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{fmtTime(h.created_at)}</span>
                    </div>
                    {h.data && Object.keys(h.data).length > 0 && (
                      <pre style={{
                        fontSize: 11, color: 'var(--text-dim)', margin: 0,
                        whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                      }}>
                        {JSON.stringify(h.data, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )
          ) : (
            <>
              {/* Upload form */}
              <div style={{ background: '#1a1d27', borderRadius: 8, padding: 16, marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--primary)' }}>Attach File</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 11, color: 'var(--text-dim)' }}>Type</label>
                    <select
                      value={uploadKind}
                      onChange={e => setUploadKind(e.target.value)}
                      style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '5px 10px', fontSize: 13 }}
                    >
                      <option value="log">Log</option>
                      <option value="photo">Photo</option>
                      <option value="report">Report</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 160 }}>
                    <label style={{ fontSize: 11, color: 'var(--text-dim)' }}>Notes (optional)</label>
                    <input
                      value={uploadNotes}
                      onChange={e => setUploadNotes(e.target.value)}
                      placeholder="Describe the file…"
                      style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '5px 10px', fontSize: 13 }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 11, color: 'var(--text-dim)' }}>File</label>
                    <label
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        background: uploading ? 'var(--surface2)' : 'var(--primary)',
                        color: '#fff', padding: '6px 14px', borderRadius: 6,
                        cursor: uploading ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600,
                      }}
                    >
                      {uploading ? 'Uploading…' : '📎 Choose File'}
                      <input
                        ref={fileInputRef}
                        type="file"
                        style={{ display: 'none' }}
                        disabled={uploading}
                        onChange={handleFileUpload}
                      />
                    </label>
                  </div>
                </div>
                {uploadError && (
                  <div style={{ color: 'var(--error)', fontSize: 12, marginTop: 8 }}>{uploadError}</div>
                )}
              </div>

              {/* Files table */}
              {uploads.length === 0 ? (
                <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: 24 }}>No attachments yet</div>
              ) : (
                <table className="table" style={{ fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th>File</th>
                      <th>Type</th>
                      <th>Size</th>
                      <th>Notes</th>
                      <th>Uploaded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uploads.map(u => (
                      <tr key={u.id}>
                        <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{u.filename}</td>
                        <td><span className={`badge badge-${u.kind}`}>{u.kind}</span></td>
                        <td style={{ color: 'var(--text-dim)' }}>{fmtBytes(u.file_size)}</td>
                        <td style={{ color: 'var(--text-dim)' }}>{u.notes ?? '—'}</td>
                        <td style={{ color: 'var(--text-dim)' }}>{fmtTime(u.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
