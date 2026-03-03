import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getStations, listBoxes, claimBox, scanEcu,
  freezeBox, startFlash, finishFlash, startRework, getBoxEcus,
} from '../services/api';
import { useAuthStore, useWorkbenchStore, ECUContext, Station, Box } from '../store/index';
import EcuDetailModal from '../components/EcuDetailModal';

type Phase = 'select-station' | 'scan-box' | 'learning' | 'flashing' | 'blocked' | 'completed';

export default function StationWorkbench() {
  const { id: sessionId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { stationId, currentBox, ecus, setStation, setCurrentBox, setEcus } = useWorkbenchStore();

  const [phase, setPhase] = useState<Phase>(stationId ? 'scan-box' : 'select-station');
  const [stations, setStations] = useState<Station[]>([]);
  const [allBoxes, setAllBoxes] = useState<Box[]>([]);
  const [boxScan, setBoxScan] = useState('');
  const [ecuScan, setEcuScan] = useState('');
  const [message, setMessage] = useState<{ text: string; ok: boolean }>({ text: '', ok: true });
  const [flashResult, setFlashResult] = useState<Record<string, 'success' | 'failed'>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [selectedEcu, setSelectedEcu] = useState<ECUContext | null>(null);
  const ecuInputRef = useRef<HTMLInputElement>(null);
  const msgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = (text: string, ok = true) => {
    if (msgTimer.current) clearTimeout(msgTimer.current);
    setMessage({ text, ok });
    msgTimer.current = setTimeout(() => setMessage({ text: '', ok: true }), 3500);
  };

  const extractError = (err: any, fallback: string): string => {
    const detail = err?.response?.data?.detail;
    if (!detail) return fallback;
    if (Array.isArray(detail)) return detail.map((e: any) => e.msg ?? JSON.stringify(e)).join(' | ');
    if (typeof detail === 'string') return detail;
    return fallback;
  };

  useEffect(() => {
    if (!sessionId) return;
    Promise.all([getStations(sessionId), listBoxes(sessionId)]).then(([st, bx]) => {
      setStations(st);
      setAllBoxes(bx);
    });
    if (stationId && currentBox) {
      determinePhase(currentBox);
      getBoxEcus(sessionId, currentBox.id).then(setEcus);
    }
  }, [sessionId]);

  const determinePhase = (box: Box) => {
    if (box.status === 'completed') setPhase('completed');
    else if (box.status === 'blocked') setPhase('blocked');
    else if (box.inventory_frozen) setPhase('flashing');
    else if (box.status === 'learning' || box.status === 'in_progress') setPhase('learning');
    else setPhase('scan-box');
  };

  const handleSelectStation = async (sid: string) => {
    setStation(sid);
    setEcus([]);
    // Check if this station already has a box assigned
    try {
      const boxes: Box[] = await listBoxes(sessionId!);
      setAllBoxes(boxes);
      const assigned = boxes.find(b => b.assigned_station_id === sid && b.status !== 'completed');
      if (assigned) {
        setCurrentBox(assigned);
        const ecuList = await getBoxEcus(sessionId!, assigned.id);
        setEcus(ecuList);
        determinePhase(assigned);
      } else {
        setCurrentBox(null);
        setPhase('scan-box');
      }
    } catch {
      setCurrentBox(null);
      setPhase('scan-box');
    }
  };

  const handleClaimBox = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId || !stationId || !boxScan.trim()) return;
    try {
      const boxes: Box[] = await listBoxes(sessionId);
      const found = boxes.find(b => b.box_serial.toLowerCase() === boxScan.trim().toLowerCase());
      if (!found) { notify('Box not found', false); return; }
      const box = await claimBox(sessionId, found.id, stationId);
      setCurrentBox(box);
      const ecuList = await getBoxEcus(sessionId, box.id);
      setEcus(ecuList);
      setBoxScan('');
      determinePhase(box);
    } catch (err: any) {
      notify(extractError(err, 'Error claiming box'), false);
    }
  };

  const handleScanEcu = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId || !currentBox || !ecuScan.trim()) return;
    try {
      await scanEcu(sessionId, currentBox.id, ecuScan.trim());
      const ecuList = await getBoxEcus(sessionId, currentBox.id);
      setEcus(ecuList);
      notify(`✓ ${ecuScan.trim()} learned`);
      setEcuScan('');
      ecuInputRef.current?.focus();
    } catch (err: any) {
      notify(extractError(err, 'Error scanning ECU'), false);
    }
  };

  const handleFreeze = async () => {
    if (!sessionId || !currentBox) return;
    try {
      const box = await freezeBox(sessionId, currentBox.id);
      setCurrentBox(box);
      const ecuList = await getBoxEcus(sessionId, box.id);
      setEcus(ecuList);
      setPhase('flashing');
      notify('Inventory frozen – ready to flash');
    } catch (err: any) {
      notify(extractError(err, 'Error freezing'), false);
    }
  };

  const refreshBox = async () => {
    if (!sessionId || !currentBox) return null;
    const boxes: Box[] = await listBoxes(sessionId);
    return boxes.find(b => b.id === currentBox.id) ?? currentBox;
  };

  const handleStartFlash = async (ecu: ECUContext) => {
    if (!sessionId || !currentBox) return;
    try {
      await startFlash(sessionId, currentBox.id, {
        ecu_code: ecu.ecu_code,
        expected_version: ecu.version,
      });
      const ecuList = await getBoxEcus(sessionId, currentBox.id);
      setEcus(ecuList);
      notify(`Flashing ${ecu.ecu_code}…`);
    } catch (err: any) {
      notify(extractError(err, 'Error starting flash'), false);
    }
  };

  const handleFinishFlash = async (ecu: ECUContext) => {
    if (!sessionId || !currentBox) return;
    const result = flashResult[ecu.id] ?? 'success';
    try {
      await finishFlash(sessionId, currentBox.id, {
        ecu_code: ecu.ecu_code,
        result,
        notes: notes[ecu.id],
        expected_version: ecu.version,
      });
      const box = await refreshBox();
      if (box) { setCurrentBox(box); determinePhase(box); }
      const ecuList = await getBoxEcus(sessionId, currentBox.id);
      setEcus(ecuList);
      notify(result === 'success' ? `✓ ${ecu.ecu_code} success` : `✗ ${ecu.ecu_code} failed`, result === 'success');
    } catch (err: any) {
      notify(extractError(err, 'Error finishing flash'), false);
    }
  };

  const handleRework = async (ecu: ECUContext) => {
    if (!sessionId || !currentBox) return;
    try {
      await startRework(sessionId, currentBox.id, ecu.ecu_code);
      const ecuList = await getBoxEcus(sessionId, currentBox.id);
      setEcus(ecuList);
      notify(`↩ ${ecu.ecu_code} → rework pending`);
      setPhase('flashing');
    } catch (err: any) {
      notify(extractError(err, 'Error'), false);
    }
  };

  const STATUS_COLOR: Record<string, string> = {
    learned: 'var(--primary)',
    flashing: '#a78bfa',
    success: 'var(--success)',
    failed: 'var(--error)',
    rework_pending: 'var(--warn)',
  };

  const currentStationName = stations.find(s => s.id === stationId)?.name ?? stationId;

  return (
    <>
      <nav className="navbar">
        <span
          className="navbar-brand"
          style={{ cursor: 'pointer' }}
          onClick={() => navigate(`/sessions/${sessionId}`)}
        >
          ⚡ ECU Reflash
        </span>
        <span
          className="navbar-link"
          onClick={() => navigate(`/sessions/${sessionId}`)}
          style={{ cursor: 'pointer' }}
        >
          ← Session
        </span>
        <span className="navbar-spacer" />
        {stationId && (
          <span style={{ fontSize: 13, color: 'var(--text-dim)', marginRight: 12 }}>
            🏭 {currentStationName}
          </span>
        )}
        {currentBox && (
          <span style={{ fontSize: 13, marginRight: 12 }}>
            📦 {currentBox.box_serial}
          </span>
        )}
        <span style={{ fontSize: 13, color: 'var(--text-dim)', marginRight: 8 }}>{user?.name}</span>
        {message.text && (
          <span
            style={{
              fontSize: 13,
              padding: '4px 12px',
              background: message.ok ? 'rgba(34,197,94,.15)' : 'rgba(239,68,68,.15)',
              color: message.ok ? 'var(--success)' : 'var(--error)',
              borderRadius: 6,
              marginLeft: 8,
            }}
          >
            {message.text}
          </span>
        )}
      </nav>

      <div className="page" style={{ maxWidth: 960 }}>

        {/* ── Phase: Select Station ─────────────────────────────────────────── */}
        {phase === 'select-station' && (
          <div>
            <h2 style={{ marginBottom: 20 }}>Select Your Station</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
              {stations.map(s => {
                const assignedBox = allBoxes.find(b => b.assigned_station_id === s.id && b.status !== 'completed');
                return (
                <div
                  key={s.id}
                  className="card"
                  style={{ cursor: 'pointer', textAlign: 'center', padding: 28, position: 'relative' }}
                  onClick={() => handleSelectStation(s.id)}
                >
                  {assignedBox && (
                    <div style={{
                      position: 'absolute', top: 10, right: 10,
                      background: assignedBox.inventory_frozen ? 'var(--primary)' : 'var(--warn)',
                      color: assignedBox.inventory_frozen ? '#fff' : '#000',
                      fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 6,
                    }}>
                      {assignedBox.inventory_frozen ? '⚡ Flashing' : '📦 Loading'}
                    </div>
                  )}
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🏭</div>
                  <div style={{ fontWeight: 600, fontSize: 16 }}>{s.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 4 }}>
                    {s.members.map((m: any) => m.name).join(', ') || 'No members'}
                  </div>
                  {assignedBox && (
                    <div style={{ marginTop: 10, fontSize: 13, fontWeight: 500, color: 'var(--primary)' }}>
                      {assignedBox.box_serial} → continuar
                    </div>
                  )}
                </div>
                );
              })}
              {stations.length === 0 && (
                <p style={{ color: 'var(--text-dim)' }}>No stations. Ask admin to create stations first.</p>
              )}
            </div>
          </div>
        )}

        {/* ── Phase: Scan Box ───────────────────────────────────────────────── */}
        {phase === 'scan-box' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <h2>Scan / Enter Box Serial</h2>
              <button
                className="btn btn-ghost"
                style={{ fontSize: 12 }}
                onClick={() => setPhase('select-station')}
              >
                Change Station
              </button>
            </div>
            <form onSubmit={handleClaimBox} style={{ display: 'flex', gap: 12, maxWidth: 440 }}>
              <input
                style={{
                  flex: 1, background: 'var(--surface2)', border: '1px solid var(--border)',
                  color: 'var(--text)', padding: '10px 14px', borderRadius: 8, fontSize: 15,
                }}
                value={boxScan}
                onChange={e => setBoxScan(e.target.value)}
                placeholder="BOX-001"
                autoFocus
              />
              <button type="submit" className="btn btn-primary" style={{ fontSize: 15 }}>Claim</button>
            </form>
          </div>
        )}

        {/* ── Phase: Learning ───────────────────────────────────────────────── */}
        {phase === 'learning' && currentBox && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
              <h2>Learning: {currentBox.box_serial}</h2>
              <span style={{ color: 'var(--text-dim)', fontSize: 14 }}>{ecus.length} ECUs scanned</span>
              <span className="navbar-spacer" />
              <button
                className="btn btn-success"
                onClick={handleFreeze}
                disabled={ecus.length === 0}
              >
                🔒 Freeze Inventory ({ecus.length})
              </button>
            </div>
            <form onSubmit={handleScanEcu} style={{ display: 'flex', gap: 12, maxWidth: 440, marginBottom: 24 }}>
              <input
                ref={ecuInputRef}
                style={{
                  flex: 1, background: 'var(--surface2)', border: '1px solid var(--border)',
                  color: 'var(--text)', padding: '10px 14px', borderRadius: 8, fontSize: 15,
                }}
                value={ecuScan}
                onChange={e => setEcuScan(e.target.value)}
                placeholder="Scan ECU barcode…"
                autoFocus
              />
              <button type="submit" className="btn btn-primary">Add</button>
            </form>
            <table className="table">
              <thead>
                <tr><th>#</th><th>ECU Code</th><th>Status</th></tr>
              </thead>
              <tbody>
                {ecus.map((e, i) => (
                  <tr key={e.id}>
                    <td style={{ color: 'var(--text-dim)' }}>{i + 1}</td>
                    <td>
                      <code
                        style={{ cursor: 'pointer', color: 'var(--primary)', textDecoration: 'underline dotted' }}
                        title="Ver detalles del ECU"
                        onClick={() => setSelectedEcu(e)}
                      >
                        {e.ecu_code}
                      </code>
                    </td>
                    <td><span className={`badge badge-${e.status}`}>{e.status}</span></td>
                  </tr>
                ))}
                {ecus.length === 0 && (
                  <tr><td colSpan={3} style={{ color: 'var(--text-dim)', textAlign: 'center', padding: 24 }}>Scan ECUs to begin</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Phase: Flashing ───────────────────────────────────────────────── */}
        {phase === 'flashing' && currentBox && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
              <h2>Flashing: {currentBox.box_serial}</h2>
              <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>
                {ecus.filter(e => e.status === 'success').length}/{ecus.length} done
              </span>
              {currentBox.status === 'blocked' && (
                <span className="badge badge-blocked" style={{ marginLeft: 8 }}>BLOCKED</span>
              )}
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>ECU Code</th>
                  <th>Status</th>
                  <th>Attempts</th>
                  <th>Result</th>
                  <th>Notes</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {ecus.map(e => (
                  <tr key={e.id}>
                    <td>
                      <code
                        style={{ fontSize: 13, cursor: 'pointer', color: 'var(--primary)', textDecoration: 'underline dotted' }}
                        title="Ver detalles del ECU"
                        onClick={() => setSelectedEcu(e)}
                      >
                        {e.ecu_code}
                      </code>
                    </td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <span
                          className="status-dot"
                          style={{ background: STATUS_COLOR[e.status] ?? '#888' }}
                        />
                        <span className={`badge badge-${e.status}`}>{e.status}</span>
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-dim)' }}>{e.attempts}</td>
                    <td>
                      {e.status === 'flashing' && (
                        <select
                          style={{
                            background: 'var(--surface2)', border: '1px solid var(--border)',
                            color: 'var(--text)', padding: '4px 8px', borderRadius: 6, fontSize: 13,
                          }}
                          value={flashResult[e.id] ?? 'success'}
                          onChange={ev =>
                            setFlashResult(p => ({ ...p, [e.id]: ev.target.value as 'success' | 'failed' }))
                          }
                        >
                          <option value="success">Success</option>
                          <option value="failed">Failed</option>
                        </select>
                      )}
                    </td>
                    <td>
                      {e.status === 'flashing' && (
                        <input
                          style={{
                            background: 'var(--surface2)', border: '1px solid var(--border)',
                            color: 'var(--text)', padding: '4px 8px', borderRadius: 6, fontSize: 13, width: 120,
                          }}
                          placeholder="notes…"
                          value={notes[e.id] ?? ''}
                          onChange={ev => setNotes(p => ({ ...p, [e.id]: ev.target.value }))}
                        />
                      )}
                    </td>
                    <td>
                      {(e.status === 'learned' || e.status === 'rework_pending') && (
                        <button
                          className="btn btn-primary"
                          style={{ padding: '4px 12px', fontSize: 12 }}
                          onClick={() => handleStartFlash(e)}
                        >
                          {e.status === 'rework_pending' ? 'Re-Flash' : 'Start Flash'}
                        </button>
                      )}
                      {e.status === 'flashing' && (
                        <button
                          className="btn btn-success"
                          style={{ padding: '4px 12px', fontSize: 12 }}
                          onClick={() => handleFinishFlash(e)}
                        >
                          Finish
                        </button>
                      )}
                      {e.status === 'failed' && (
                        <button
                          className="btn btn-warn"
                          style={{ padding: '4px 12px', fontSize: 12 }}
                          onClick={() => handleRework(e)}
                        >
                          Rework
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Phase: Blocked ────────────────────────────────────────────────── */}
        {phase === 'blocked' && currentBox && (
          <div className="card" style={{ textAlign: 'center', padding: 56, maxWidth: 480, margin: '60px auto' }}>
            <div style={{ fontSize: 52 }}>🚫</div>
            <h2 style={{ color: 'var(--error)', marginTop: 16 }}>Box Blocked</h2>
            <p style={{ color: 'var(--text-dim)', marginTop: 8 }}>
              {currentBox.box_serial} — one or more ECUs failed. Rework failed units to unblock.
            </p>
            <button className="btn btn-warn" style={{ marginTop: 20 }} onClick={() => setPhase('flashing')}>
              View Flash Table
            </button>
          </div>
        )}

        {/* ── Phase: Completed ──────────────────────────────────────────────── */}
        {phase === 'completed' && currentBox && (
          <div className="card" style={{ textAlign: 'center', padding: 56, maxWidth: 480, margin: '60px auto' }}>
            <div style={{ fontSize: 52 }}>✅</div>
            <h2 style={{ color: 'var(--success)', marginTop: 16 }}>Box Completed!</h2>
            <p style={{ color: 'var(--text-dim)', marginTop: 8 }}>
              {currentBox.box_serial} — all {ecus.length} ECUs flashed successfully.
            </p>
            <button
              className="btn btn-primary"
              style={{ marginTop: 20 }}
              onClick={() => { setCurrentBox(null); setEcus([]); setPhase('scan-box'); }}
            >
              Scan Next Box
            </button>
          </div>
        )}
      </div>

      {selectedEcu && sessionId && (
        <EcuDetailModal
          sessionId={sessionId}
          ecu={selectedEcu}
          onClose={() => setSelectedEcu(null)}
        />
      )}
    </>
  );
}
