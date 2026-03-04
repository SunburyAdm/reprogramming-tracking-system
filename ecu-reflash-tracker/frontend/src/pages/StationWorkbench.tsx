import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getStations, listBoxes, claimBox, scanEcu,
  freezeBox, startFlash, finishFlash, startRework, getBoxEcus, getBox, deleteEcu, markEcuScratch,
  createStationSetup, updateStationSetup, deleteStationSetup,
} from '../services/api';
import { useAuthStore, useWorkbenchStore, usePrefsStore, ECUContext, Station, Box, StationSetup } from '../store/index';
import EcuDetailModal from '../components/EcuDetailModal';
import ProfileModal, { AvatarCircle } from '../components/ProfileModal';
import { useT } from '../i18n';

/** Live elapsed-time display for an in-progress flash. */
function FlashTimer({ startedAt }: { startedAt: string | null }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) return;
    const origin = new Date(startedAt + (startedAt.endsWith('Z') ? '' : 'Z')).getTime();
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - origin) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  if (!startedAt) return null;
  const m = Math.floor(elapsed / 60).toString().padStart(2, '0');
  const s = (elapsed % 60).toString().padStart(2, '0');
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontVariantNumeric: 'tabular-nums',
      fontSize: 12, color: '#a78bfa', fontWeight: 600,
    }}>
      <span style={{ fontSize: 11 }}>⏱</span>{m}:{s}
    </span>
  );
}

/** Format a finished duration (seconds) into a readable string. */
function fmtDuration(secs: number | null | undefined): string {
  if (secs == null) return '—';
  const s = Math.round(secs);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r === 0 ? `${m}m` : `${m}m ${r}s`;
}
type Phase = 'select-station' | 'station-dashboard' | 'learning' | 'flashing' | 'blocked' | 'completed';

export default function StationWorkbench() {
  const { id: sessionId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { stationId, currentBox, ecus, setStation, setCurrentBox, setEcus } = useWorkbenchStore();

  const [phase, setPhase] = useState<Phase>(stationId ? 'station-dashboard' : 'select-station');
  const [stations, setStations] = useState<Station[]>([]);
  const [allBoxes, setAllBoxes] = useState<Box[]>([]);
  const [activeBoxes, setActiveBoxes] = useState<Box[]>([]);
  const [boxScan, setBoxScan] = useState('');
  const [ecuScan, setEcuScan] = useState('');
  const [message, setMessage] = useState<{ text: string; ok: boolean }>({ text: '', ok: true });
  const [showProfile, setShowProfile] = useState(false);
  const [flashResult, setFlashResult] = useState<Record<string, 'success' | 'failed'>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [selectedEcu, setSelectedEcu] = useState<ECUContext | null>(null);
  const ecuInputRef = useRef<HTMLInputElement>(null);
  const msgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track boxes whose blocked-banner was dismissed so polling can't re-show it
  const dismissedBlockedRef = useRef<string | null>(null);
  // Prevents polling from auto-navigating away when the tech is reviewing a just-completed flash table
  const awaitingBoxClose = useRef(false);

  // Confirmation dialog for Re-flash
  const [reflashTarget, setReflashTarget] = useState<ECUContext | null>(null);
  const [pendingFlash, setPendingFlash] = useState<Set<string>>(new Set());
  const { confirmReflash } = usePrefsStore();
  const t = useT();

  // Station setups
  const [showSetupForm, setShowSetupForm] = useState(false);
  const [editingSetup, setEditingSetup] = useState<StationSetup | null>(null);
  const [setupName, setSetupName] = useState('');
  const [setupFields, setSetupFields] = useState<{ key: string; value: string }[]>([]);
  const [setupSaving, setSetupSaving] = useState(false);

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

  const determinePhase = (box: Box) => {
    if (box.status === 'completed') setPhase('completed');
    else if (box.status === 'blocked') {
      // Only show the blocked banner once per box; if user dismissed it, go to flashing
      if (dismissedBlockedRef.current === box.id) setPhase('flashing');
      else setPhase('blocked');
    }
    else if (box.inventory_frozen) setPhase('flashing');
    else if (box.status === 'learning' || box.status === 'in_progress') setPhase('learning');
    else setPhase('station-dashboard');
  };

  const refreshWorkbench = async () => {
    if (!sessionId) return;
    const [st, bx] = await Promise.all([getStations(sessionId), listBoxes(sessionId)]);
    setStations(st);
    setAllBoxes(bx);
    // Update active boxes for current station
    const liveStationId = useWorkbenchStore.getState().stationId;
    if (liveStationId) {
      setActiveBoxes(bx.filter((b: Box) => b.assigned_station_id === liveStationId && b.status !== 'completed'));
    }
    // Always read currentBox from Zustand store directly to avoid stale closure
    const liveBox = useWorkbenchStore.getState().currentBox;
    if (liveBox) {
      const updated = bx.find((b: Box) => b.id === liveBox.id);
      if (updated) {
        setCurrentBox(updated);
        // Don't auto-navigate away if the tech is reviewing a completed box before closing
        if (!awaitingBoxClose.current) {
          determinePhase(updated);
        }
        getBoxEcus(sessionId, updated.id).then(setEcus);
      }
    }
  };

  useEffect(() => {
    if (!sessionId) return;
    refreshWorkbench();
    if (stationId && currentBox) {
      determinePhase(currentBox);
      getBoxEcus(sessionId, currentBox.id).then(setEcus);
    }

    const interval = setInterval(refreshWorkbench, 4000);
    return () => clearInterval(interval);
  }, [sessionId]);


  const handleSelectStation = async (sid: string) => {
    setStation(sid);
    setEcus([]);
    setCurrentBox(null);
    try {
      const boxes: Box[] = await listBoxes(sessionId!);
      setAllBoxes(boxes);
      setActiveBoxes(boxes.filter(b => b.assigned_station_id === sid && b.status !== 'completed'));
      setPhase('station-dashboard');
    } catch {
      setPhase('station-dashboard');
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
      const updated = [...boxes.filter(b => b.assigned_station_id === stationId && b.status !== 'completed' && b.id !== box.id), box];
      setActiveBoxes(updated);
      setCurrentBox(box);
      const ecuList = await getBoxEcus(sessionId, box.id);
      setEcus(ecuList);
      setBoxScan('');
      setPhase('learning');
    } catch (err: any) {
      notify(extractError(err, 'Error claiming box'), false);
    }
  };

  const handleOpenBox = async (box: Box) => {
    setCurrentBox(box);
    const ecuList = await getBoxEcus(sessionId!, box.id);
    setEcus(ecuList);
    determinePhase(box);
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

  const handleDeleteEcu = async (ecuId: string, ecuCode: string) => {
    if (!sessionId || !currentBox) return;
    if (!window.confirm(`Delete ECU "${ecuCode}"?\nOnly ECUs in 'learned' state can be deleted.`)) return;
    try {
      await deleteEcu(sessionId, currentBox.id, ecuId);
      const ecuList = await getBoxEcus(sessionId, currentBox.id);
      setEcus(ecuList);
      notify(`✓ ECU ${ecuCode} removed`);
    } catch (err: any) {
      notify(extractError(err, 'Error deleting ECU'), false);
    }
  };

  const handleFreeze = async () => {
    if (!sessionId || !currentBox || !stationId) return;
    // Enforce: only 1 box flashing at a time per station
    const alreadyFlashing = activeBoxes.find(b => b.inventory_frozen && b.status !== 'completed' && b.id !== currentBox.id);
    if (alreadyFlashing) {
      notify(`Finish flashing ${alreadyFlashing.box_serial} before freezing another box`, false);
      return;
    }
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
    if (pendingFlash.has(ecu.id)) return;           // prevent duplicate clicks
    setPendingFlash(p => new Set(p).add(ecu.id));
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
    } finally {
      setPendingFlash(p => { const n = new Set(p); n.delete(ecu.id); return n; });
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
      if (box) {
        setCurrentBox(box);
        if (box.status === 'completed') {
          // Stay on the flash table — let the tech review and click "Finish Box"
          awaitingBoxClose.current = true;
        } else {
          determinePhase(box);
        }
      }
      const ecuList = await getBoxEcus(sessionId, currentBox.id);
      setEcus(ecuList);
      notify(result === 'success' ? `✓ ${ecu.ecu_code} success` : `✗ ${ecu.ecu_code} failed`, result === 'success');
    } catch (err: any) {
      notify(extractError(err, 'Error finishing flash'), false);
    }
  };

  const handleFinishBox = async () => {
    awaitingBoxClose.current = false;
    if (sessionId && stationId) {
      const bx = await listBoxes(sessionId);
      setAllBoxes(bx);
      const active = bx.filter((b: Box) => b.assigned_station_id === stationId && b.status !== 'completed');
      setActiveBoxes(active);
      const learningCount = active.filter((b: Box) => !b.inventory_frozen).length;
      notify(learningCount > 0
        ? `Box completed! 📖 ${learningCount} box${learningCount !== 1 ? 'es' : ''} in learning — open one to continue`
        : '🎉 Box completed!'
      );
    }
    setCurrentBox(null);
    setEcus([]);
    setPhase('station-dashboard');
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
  const handleMarkScratch = async (ecu: ECUContext) => {
    if (!sessionId || !currentBox) return;
    if (!window.confirm(`Mark ${ecu.ecu_code} as SCRATCH?\nThis excludes it from the count and allows closing the box even if it was not flashed correctly.`)) return;
    try {
      await markEcuScratch(sessionId, currentBox.id, ecu.id);
      const [updatedBox, ecuList] = await Promise.all([
        getBox(sessionId, currentBox.id),
        getBoxEcus(sessionId, currentBox.id),
      ]);
      setCurrentBox(updatedBox);
      setEcus(ecuList);
      determinePhase(updatedBox);
      notify(`🗑️ ${ecu.ecu_code} marked as scratch`);
    } catch (err: any) {
      notify(extractError(err, 'Error marking scratch'), false);
    }
  };
  const STATUS_COLOR: Record<string, string> = {
    learned: 'var(--primary)',
    flashing: '#a78bfa',
    success: 'var(--success)',
    failed: 'var(--error)',
    rework_pending: 'var(--warn)',
    scratch: '#6b7280',
  };

  const currentStationName = stations.find(s => s.id === stationId)?.name ?? stationId;
  const currentStation = stations.find(s => s.id === stationId) ?? null;
  const currentSetups: StationSetup[] = currentStation?.setups ?? [];

  const openAddSetup = () => { setEditingSetup(null); setSetupName(''); setSetupFields([]); setShowSetupForm(true); };
  const openEditSetup = (s: StationSetup) => {
    setEditingSetup(s);
    setSetupName(s.name);
    setSetupFields(Object.entries(s.attributes ?? {}).map(([key, value]) => ({ key, value })));
    setShowSetupForm(true);
  };
  const cancelSetupForm = () => { setShowSetupForm(false); setEditingSetup(null); setSetupName(''); setSetupFields([]); };
  const handleSaveSetup = async () => {
    if (!sessionId || !stationId || !setupName.trim()) return;
    setSetupSaving(true);
    try {
      const attributes = Object.fromEntries(setupFields.filter(f => f.key.trim()).map(f => [f.key.trim(), f.value]));
      const payload = { name: setupName.trim(), attributes };
      if (editingSetup) {
        await updateStationSetup(sessionId, stationId, editingSetup.id, payload);
        notify('Setup updated');
      } else {
        await createStationSetup(sessionId, stationId, payload);
        notify('Setup added');
      }
      cancelSetupForm();
      await refreshWorkbench();
    } catch (err: any) {
      notify(extractError(err, 'Error saving setup'), false);
    } finally {
      setSetupSaving(false);
    }
  };
  const handleDeleteSetup = async (sid: string) => {
    if (!sessionId || !stationId) return;
    if (!window.confirm('Delete this setup?')) return;
    try {
      await deleteStationSetup(sessionId, stationId, sid);
      notify('Setup deleted');
      await refreshWorkbench();
    } catch (err: any) {
      notify(extractError(err, 'Error deleting setup'), false);
    }
  };

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
        {currentBox && phase !== 'station-dashboard' && (
          <span style={{ fontSize: 13, marginRight: 12 }}>
            📦 {currentBox.box_serial}
          </span>
        )}
        {user && (
          <button
            onClick={() => setShowProfile(true)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '4px 8px', borderRadius: 8,
              color: 'var(--text)', marginRight: 4,
            }}
            title="View profile"
          >
            <AvatarCircle user={user} size={28} />
            <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>{user.name}</span>
          </button>
        )}
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
                  {(() => {
                    const stnBoxes = allBoxes.filter(b => b.assigned_station_id === s.id && b.status !== 'completed');
                    if (stnBoxes.length === 0) return null;
                    const hasFlashing = stnBoxes.some(b => b.inventory_frozen);
                    return (
                      <div style={{ marginTop: 10, fontSize: 12, fontWeight: 500, color: 'var(--primary)' }}>
                        {stnBoxes.length} box{stnBoxes.length !== 1 ? 'es' : ''} active
                        {hasFlashing && <span style={{ color: '#a78bfa', marginLeft: 6 }}>· ⚡ flashing</span>}
                      </div>
                    );
                  })()}
                </div>
                );
              })}
              {stations.length === 0 && (
                <p style={{ color: 'var(--text-dim)' }}>No stations. Ask admin to create stations first.</p>
              )}
            </div>
          </div>
        )}

        {/* ── Phase: Station Dashboard ─────────────────────────────────────── */}
        {phase === 'station-dashboard' && stationId && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <h2>🏭 {currentStationName}</h2>
              <button
                className="btn btn-ghost"
                style={{ fontSize: 12 }}
                onClick={() => { setStation(''); setCurrentBox(null); setEcus([]); setActiveBoxes([]); setPhase('select-station'); }}
              >
                Change Station
              </button>
            </div>

            {/* Scan new box */}
            {(() => {
              const flashingBox = activeBoxes.find(b => b.inventory_frozen && b.status !== 'completed');
              return (
                <div style={{ marginBottom: 28 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 10 }}>
                    Scan New Box
                    {flashingBox && (
                      <span style={{ marginLeft: 10, fontSize: 12, color: '#f59e0b', fontWeight: 400 }}>
                        ⚠ Finish flashing {flashingBox.box_serial} before starting another flash
                      </span>
                    )}
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
              );
            })()}

            {/* Active box list */}
            {activeBoxes.length === 0 ? (
              <div style={{ color: 'var(--text-dim)', fontSize: 14, padding: '24px 0' }}>
                No active boxes — scan a box serial to begin.
              </div>
            ) : (
              <div>
                {/* Learning boxes */}
                {activeBoxes.filter(b => !b.inventory_frozen).length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#a855f7', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
                      📖 Learning ({activeBoxes.filter(b => !b.inventory_frozen).length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {activeBoxes.filter(b => !b.inventory_frozen).map(b => (
                        <div
                          key={b.id}
                          className="card"
                          style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px', cursor: 'pointer' }}
                          onClick={() => handleOpenBox(b)}
                        >
                          <span style={{ fontWeight: 600, fontSize: 15 }}>📦 {b.box_serial}</span>
                          <span className={`badge badge-${b.status}`}>{b.status}</span>
                          <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>
                            {b.learned_count}{b.expected_ecu_count ? `/${b.expected_ecu_count}` : ''} ECUs
                          </span>
                          <span style={{ flex: 1 }} />
                          <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={ev => { ev.stopPropagation(); handleOpenBox(b); }}>Open →</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Flashing / blocked boxes */}
                {activeBoxes.filter(b => b.inventory_frozen).length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#a78bfa', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
                      ⚡ Flashing ({activeBoxes.filter(b => b.inventory_frozen).length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {activeBoxes.filter(b => b.inventory_frozen).map(b => (
                        <div
                          key={b.id}
                          className="card"
                          style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px', cursor: 'pointer', borderColor: '#a78bfa44' }}
                          onClick={() => handleOpenBox(b)}
                        >
                          <span style={{ fontWeight: 600, fontSize: 15 }}>📦 {b.box_serial}</span>
                          <span className={`badge badge-${b.status}`}>{b.status}</span>
                          <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>
                            {b.learned_count} ECUs
                            {b.failed_count > 0 && <span style={{ color: 'var(--error)', marginLeft: 6 }}>✕ {b.failed_count} failed</span>}
                          </span>
                          <span style={{ flex: 1 }} />
                          <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={ev => { ev.stopPropagation(); handleOpenBox(b); }}>Flash Table →</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Pending boxes reference ───────────────────────────────────── */}
            {allBoxes.filter(b => b.status === 'pending').length > 0 && (
              <div style={{ marginTop: 28 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
                  ⏳ Pending — unassigned ({allBoxes.filter(b => b.status === 'pending').length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {allBoxes.filter(b => b.status === 'pending').map(b => (
                    <div key={b.id} style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '9px 14px', background: 'var(--surface2)',
                      border: '1px solid var(--border)', borderRadius: 8,
                    }}>
                      <span style={{ fontSize: 14 }}>📦</span>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{b.box_serial}</span>
                      <span className="badge badge-pending">pending</span>
                      {b.expected_ecu_count
                        ? <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>{b.expected_ecu_count} ECUs expected</span>
                        : null}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Station Setups ─────────────────────────────────────────────── */}
            <div style={{ marginTop: 32 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: 1 }}>
                  🔧 Station Setups ({currentSetups.length})
                </div>
                {!showSetupForm && (
                  <button className="btn btn-ghost" style={{ fontSize: 12, padding: '3px 10px' }} onClick={openAddSetup}>
                    + Add Setup
                  </button>
                )}
              </div>

              {/* Inline add/edit form */}
              {showSetupForm && (
                <div style={{
                  padding: '16px 18px', marginBottom: 14,
                  background: 'var(--surface2)', border: '1px solid #60a5fa55',
                  borderRadius: 10,
                }}>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, color: '#60a5fa' }}>
                    {editingSetup ? '✏️ Edit Setup' : '➕ New Setup'}
                  </div>

                  {/* Setup name */}
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 11, color: 'var(--text-dim)', display: 'block', marginBottom: 3 }}>Name *</label>
                    <input
                      style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', padding: '7px 10px', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }}
                      value={setupName}
                      onChange={e => setSetupName(e.target.value)}
                      placeholder="e.g. Bay A, Bench 1"
                    />
                  </div>

                  {/* Dynamic key-value fields */}
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>Fields</div>
                    {setupFields.map((f, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                        <input
                          style={{ flex: '0 0 38%', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', padding: '6px 10px', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }}
                          value={f.key}
                          onChange={e => setSetupFields(prev => prev.map((r, j) => j === i ? { ...r, key: e.target.value } : r))}
                          placeholder="Label"
                        />
                        <input
                          style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', padding: '6px 10px', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }}
                          value={f.value}
                          onChange={e => setSetupFields(prev => prev.map((r, j) => j === i ? { ...r, value: e.target.value } : r))}
                          placeholder="Value"
                        />
                        <button
                          className="btn btn-ghost"
                          style={{ fontSize: 14, padding: '4px 8px', color: 'var(--danger)' }}
                          onClick={() => setSetupFields(prev => prev.filter((_, j) => j !== i))}
                          title="Remove field"
                        >×</button>
                      </div>
                    ))}
                    <button
                      className="btn btn-ghost"
                      style={{ fontSize: 12, padding: '4px 12px', marginTop: 2 }}
                      onClick={() => setSetupFields(prev => [...prev, { key: '', value: '' }])}
                    >+ Add Field</button>
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button className="btn btn-primary" style={{ fontSize: 13 }} disabled={!setupName.trim() || setupSaving} onClick={handleSaveSetup}>
                      {setupSaving ? 'Saving…' : 'Save'}
                    </button>
                    <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={cancelSetupForm}>Cancel</button>
                  </div>
                </div>
              )}

              {/* Existing setups */}
              {currentSetups.length === 0 && !showSetupForm && (
                <div style={{ color: 'var(--text-dim)', fontSize: 13, padding: '10px 0' }}>No setups registered — add one to document this station's tools and equipment.</div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {currentSetups.map(s => (
                  <div key={s.id} style={{
                    padding: '12px 16px', background: 'var(--surface2)',
                    border: '1px solid var(--border)', borderRadius: 8,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: Object.keys(s.attributes ?? {}).length > 0 ? 8 : 0 }}>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>🔧 {s.name}</span>
                      <span style={{ flex: 1 }} />
                      <button className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => openEditSetup(s)}>✏️ Edit</button>
                      <button className="btn btn-danger" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => handleDeleteSetup(s.id)}>×</button>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 20px', fontSize: 12, color: 'var(--text-dim)' }}>
                      {Object.entries(s.attributes ?? {}).map(([k, v]) => (
                        <span key={k}><b>{k}:</b> {v}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Phase: Learning ───────────────────────────────────────────────── */}
        {phase === 'learning' && currentBox && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
              <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => { setCurrentBox(null); setEcus([]); setPhase('station-dashboard'); }}>← Back</button>
              <h2>Learning: {currentBox.box_serial}</h2>
              <span style={{
                fontSize: 15, fontWeight: 700,
                color: currentBox.expected_ecu_count
                  ? (ecus.length >= currentBox.expected_ecu_count ? 'var(--success)' : '#f59e0b')
                  : 'var(--text-dim)',
              }}>
                {ecus.length}{currentBox.expected_ecu_count ? `/${currentBox.expected_ecu_count}` : ''} ECUs
              </span>
              {/* Compact setup strip */}
              {currentSetups.length > 0 && (
                <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {currentSetups.map(s => (
                    <span key={s.id} title={Object.entries(s.attributes ?? {}).map(([k, v]) => `${k}: ${v}`).join(' • ')} style={{
                      background: 'var(--surface2)', border: '1px solid #60a5fa44',
                      borderRadius: 6, padding: '2px 9px', fontSize: 11, color: '#60a5fa',
                    }}>
                      🔧 {s.name}
                    </span>
                  ))}
                </span>
              )}
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

            {/* ── ECU progress bar ─────────────────────────────────────────── */}
            {currentBox.expected_ecu_count != null && currentBox.expected_ecu_count > 0 && (
              <div style={{ marginBottom: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-dim)', marginBottom: 5 }}>
                  <span>Scan progress</span>
                  <span style={{ fontWeight: 700, color: ecus.length >= currentBox.expected_ecu_count ? 'var(--success)' : '#f59e0b' }}>
                    {ecus.length} / {currentBox.expected_ecu_count}
                  </span>
                </div>
                <div style={{ height: 6, background: 'var(--surface2)', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 999, transition: 'width .3s ease',
                    background: ecus.length >= currentBox.expected_ecu_count ? 'var(--success)' : '#f59e0b',
                    width: `${Math.min(100, (ecus.length / currentBox.expected_ecu_count) * 100)}%`,
                  }} />
                </div>
              </div>
            )}

            {/* ── Pending boxes reference ──────────────────────────────────── */}
            {allBoxes.filter(b => b.status === 'pending').length > 0 && (
              <div style={{
                marginBottom: 20,
                padding: '10px 14px',
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                borderRadius: 8,
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
                  ⏳ Pending boxes in session ({allBoxes.filter(b => b.status === 'pending').length})
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {allBoxes.filter(b => b.status === 'pending').map(b => (
                    <span key={b.id} style={{
                      background: 'var(--surface)', border: '1px solid var(--border)',
                      borderRadius: 6, padding: '3px 10px', fontSize: 12, color: 'var(--text-dim)',
                    }}>
                      📦 {b.box_serial}{b.expected_ecu_count ? ` (${b.expected_ecu_count})` : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <table className="table">
              <thead>
                <tr><th>#</th><th>ECU Code</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {ecus.map((e, i) => (
                  <tr key={e.id}>
                    <td style={{ color: 'var(--text-dim)' }}>{i + 1}</td>
                    <td>
                      <code
                        style={{ cursor: 'pointer', color: 'var(--primary)', textDecoration: 'underline dotted' }}
                        title="View ECU details"
                        onClick={() => setSelectedEcu(e)}
                      >
                        {e.ecu_code}
                      </code>
                    </td>
                    <td><span className={`badge badge-${e.status}`}>{e.status}</span></td>
                    <td>
                      {e.status === 'learned' && (
                        <button
                          className="btn btn-danger"
                          style={{ padding: '2px 8px', fontSize: 11 }}
                          title="Delete ECU"
                          onClick={() => handleDeleteEcu(e.id, e.ecu_code)}
                        >✕</button>
                      )}
                    </td>
                  </tr>
                ))}
                {ecus.length === 0 && (
                  <tr><td colSpan={4} style={{ color: 'var(--text-dim)', textAlign: 'center', padding: 24 }}>Scan ECUs to begin</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Phase: Flashing ───────────────────────────────────────────────── */}
        {phase === 'flashing' && currentBox && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
              <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => { awaitingBoxClose.current = false; setCurrentBox(null); setEcus([]); setPhase('station-dashboard'); }}>← Back</button>
              <h2>Flashing: {currentBox.box_serial}</h2>
              <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>
                {ecus.filter(e => e.status === 'success' || e.status === 'scratch').length}/{ecus.filter(e => e.status !== 'scratch').length + ecus.filter(e => e.status === 'scratch').length} done
              </span>
              {currentBox.status === 'blocked' && (
                <span className="badge badge-blocked" style={{ marginLeft: 8 }}>BLOCKED</span>
              )}
              <span style={{ flex: 1 }} />
              {currentBox.status === 'completed' && (
                <button
                  className="btn btn-success"
                  style={{ fontWeight: 700, fontSize: 14, padding: '8px 20px' }}
                  onClick={handleFinishBox}
                >
                  ✅ Finish Box
                </button>
              )}
            </div>
            {currentBox.status === 'completed' && (
              <div style={{
                background: 'rgba(34,197,94,.12)', border: '1px solid rgba(34,197,94,.35)',
                borderRadius: 10, padding: '14px 20px', marginBottom: 20,
                display: 'flex', alignItems: 'center', gap: 16,
              }}>
                <span style={{ fontSize: 22 }}>🎉</span>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--success)', fontSize: 15 }}>
                    All ECUs completed — box ready to close
                  </div>
                  {activeBoxes.filter(b => !b.inventory_frozen && b.id !== currentBox.id).length > 0 && (
                    <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 3 }}>
                      📖 {activeBoxes.filter(b => !b.inventory_frozen && b.id !== currentBox.id).length} box
                      {activeBoxes.filter(b => !b.inventory_frozen && b.id !== currentBox.id).length !== 1 ? 'es' : ''} in learning waiting to be frozen
                    </div>
                  )}
                </div>
                <span style={{ flex: 1 }} />
                <button className="btn btn-success" style={{ fontWeight: 700 }} onClick={handleFinishBox}>
                  ✅ Finish Box
                </button>
              </div>
            )}
            <table className="table">
              <thead>
                <tr>
                  <th>ECU Code</th>
                  <th>Status / Time</th>
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
                        title="View ECU details"
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
                      {/* Live timer while flashing */}
                      {e.status === 'flashing' && (
                        <div style={{ marginTop: 4 }}>
                          <FlashTimer startedAt={e.current_attempt_started_at} />
                        </div>
                      )}
                      {/* Final duration once measured */}
                      {(e.status === 'success' || e.status === 'failed' || e.status === 'rework_pending' || e.status === 'scratch') &&
                        e.last_attempt_duration_seconds != null && (
                        <div style={{ marginTop: 3, fontSize: 11, color: e.status === 'success' ? 'var(--success)' : e.status === 'failed' ? 'var(--error)' : e.status === 'scratch' ? '#6b7280' : 'var(--warn)', fontWeight: 600 }}>
                          ⏱ {fmtDuration(e.last_attempt_duration_seconds)}
                        </div>
                      )}
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
                      {e.status === 'learned' && (
                        <button
                          className="btn btn-primary"
                          style={{ padding: '4px 12px', fontSize: 12 }}
                          disabled={pendingFlash.has(e.id)}
                          onClick={() => handleStartFlash(e)}
                        >
                          {pendingFlash.has(e.id) ? '…' : 'Start Flash'}
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
                      {e.status === 'success' && (
                        <button
                          className="btn btn-ghost"
                          style={{ padding: '4px 12px', fontSize: 12, color: 'var(--warn)', border: '1px solid var(--warn)' }}
                          title="Re-flash this ECU — use if Finish was pressed by mistake"
                          onClick={() => {
                            if (confirmReflash) {
                              setReflashTarget(e);
                            } else {
                              handleRework(e);
                            }
                          }}
                        >
                          ↺ Re-flash
                        </button>
                      )}
                      {e.status === 'failed' && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button
                            className="btn btn-warn"
                            style={{ padding: '4px 12px', fontSize: 12 }}
                            onClick={() => handleRework(e)}
                          >
                            Rework
                          </button>
                          <button
                            className="btn btn-ghost"
                            style={{ padding: '4px 10px', fontSize: 12, color: '#6b7280', border: '1px solid #6b7280' }}
                            title="Mark as damaged part (scratch) — excluded from count and allows box to be closed"
                            onClick={() => handleMarkScratch(e)}
                          >
                            🗑 Scratch
                          </button>
                        </div>
                      )}
                      {e.status === 'rework_pending' && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button
                            className="btn btn-primary"
                            style={{ padding: '4px 12px', fontSize: 12 }}
                            disabled={pendingFlash.has(e.id)}
                            onClick={() => handleStartFlash(e)}
                          >
                            {pendingFlash.has(e.id) ? '…' : 'Re-Flash'}
                          </button>
                          <button
                            className="btn btn-ghost"
                            style={{ padding: '4px 10px', fontSize: 12, color: '#6b7280', border: '1px solid #6b7280' }}
                            title="Mark as damaged part (scratch) — excluded from count and allows box to be closed"
                            onClick={() => handleMarkScratch(e)}
                          >
                            🗑 Scratch
                          </button>
                        </div>
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
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20 }}>
              <button className="btn btn-ghost" onClick={() => { awaitingBoxClose.current = false; setCurrentBox(null); setEcus([]); setPhase('station-dashboard'); }}>← Back</button>
              <button className="btn btn-warn" onClick={() => {
                dismissedBlockedRef.current = currentBox.id;
                setPhase('flashing');
              }}>
                View Flash Table
              </button>
            </div>
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
              onClick={() => { setCurrentBox(null); setEcus([]); setPhase('station-dashboard'); }}
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
      {showProfile && (
        <ProfileModal onClose={() => setShowProfile(false)} />
      )}

      {/* ── Re-flash confirmation dialog ─────────────────────────────── */}
      {reflashTarget && (
        <div className="modal-overlay" onClick={() => setReflashTarget(null)}>
          <div
            className="modal"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: 400, width: '100%', padding: 28 }}
          >
            <div style={{ fontSize: 32, textAlign: 'center', marginBottom: 12 }}>↺</div>
            <h2 style={{ textAlign: 'center', fontSize: 18, marginBottom: 8 }}>
              {t.reflashConfirmTitle}
            </h2>
            <p style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
              {t.reflashConfirmBody(reflashTarget.ecu_code)}
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                className="btn btn-ghost"
                style={{ padding: '8px 20px' }}
                onClick={() => setReflashTarget(null)}
              >
                {t.cancel}
              </button>
              <button
                className="btn btn-warn"
                style={{ padding: '8px 20px' }}
                onClick={() => {
                  const ecu = reflashTarget;
                  setReflashTarget(null);
                  handleRework(ecu);
                }}
              >
                {t.reflashConfirmOk}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
