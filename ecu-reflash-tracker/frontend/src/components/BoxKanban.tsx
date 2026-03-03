import { useState } from 'react';
import { format } from 'date-fns';
import { Box } from '../store/index';

interface Props {
  boxes: Box[];
  isAdmin: boolean;
  onCardClick: (box: Box) => void;
  onDelete: (e: React.MouseEvent, boxId: string, boxSerial: string) => void;
  onStatusChange?: (boxId: string, newStatus: string) => void;
}

const COLUMNS: { status: string; label: string; icon: string; color: string; bg: string }[] = [
  { status: 'pending',    label: 'Pending',     icon: '⏳', color: '#8892a4', bg: 'rgba(136,146,164,.08)' },
  { status: 'learning',   label: 'Learning',    icon: '📖', color: '#a855f7', bg: 'rgba(168,85,247,.08)'  },
  { status: 'in_progress',label: 'In Progress', icon: '⚡', color: '#4f8ef7', bg: 'rgba(79,142,247,.08)'  },
  { status: 'blocked',    label: 'Blocked',     icon: '🚫', color: '#ef4444', bg: 'rgba(239,68,68,.08)'   },
  { status: 'completed',  label: 'Completed',   icon: '✅', color: '#22c55e', bg: 'rgba(34,197,94,.08)'   },
];

function BoxCard({ box, isAdmin, onCardClick, onDelete, onDragStart }: {
  box: Box; isAdmin: boolean;
  onCardClick: (b: Box) => void;
  onDelete: (e: React.MouseEvent, id: string, serial: string) => void;
  onDragStart: (e: React.DragEvent, box: Box) => void;
}) {
  const pct = box.expected_ecu_count && box.expected_ecu_count > 0
    ? Math.min(100, Math.round((box.learned_count / box.expected_ecu_count) * 100))
    : null;

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, box)}
      onClick={() => onCardClick(box)}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '12px 14px',
        cursor: 'grab',
        marginBottom: 8,
        transition: 'border-color .15s, opacity .15s',
        userSelect: 'none',
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--primary)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <code style={{ fontSize: 13, fontWeight: 700 }}>{box.box_serial}</code>
        {isAdmin && (
          <button
            className="btn btn-danger"
            style={{ padding: '1px 7px', fontSize: 11 }}
            onClick={e => { e.stopPropagation(); onDelete(e, box.id, box.box_serial); }}
          >✕</button>
        )}
      </div>

      {box.assigned_station_name && (
        <div style={{ fontSize: 11, color: 'var(--primary)', marginBottom: 6, fontWeight: 600 }}>
          📍 {box.assigned_station_name}
        </div>
      )}

      <div style={{ fontSize: 12, color: 'var(--text-dim)', display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
        <span>ECUs: <strong style={{ color: 'var(--text)' }}>{box.learned_count}{box.expected_ecu_count ? `/${box.expected_ecu_count}` : ''}</strong></span>
        <span style={{ color: box.inventory_frozen ? 'var(--success)' : 'var(--text-dim)' }}>
          {box.inventory_frozen ? '🔒 Frozen' : '🔓 Open'}
        </span>
      </div>

      {(box.failed_count > 0 || box.scratch_count > 0) && (
        <div style={{ fontSize: 11, display: 'flex', gap: 10, marginBottom: pct !== null ? 4 : 0 }}>
          {box.failed_count > 0 && (
            <span style={{ color: '#ef4444', fontWeight: 600 }}>✗ {box.failed_count} failed</span>
          )}
          {box.scratch_count > 0 && (
            <span style={{ color: '#6b7280', fontWeight: 600 }}>🗑 {box.scratch_count} scratch</span>
          )}
        </div>
      )}

      {pct !== null && (
        <div style={{ marginTop: 6 }}>
          <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? 'var(--success)' : 'var(--primary)', borderRadius: 2, transition: 'width .3s' }} />
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 3, textAlign: 'right' }}>{pct}%</div>
        </div>
      )}

      {box.completed_at && (
        <div style={{ fontSize: 11, color: 'var(--success)', marginTop: 6 }}>
          ✓ {format(new Date(box.completed_at), 'dd MMM HH:mm')}
        </div>
      )}
    </div>
  );
}

export default function BoxKanban({ boxes, isAdmin, onCardClick, onDelete, onStatusChange }: Props) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, box: Box) => {
    setDraggingId(box.id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('boxId', box.id);
    e.dataTransfer.setData('fromStatus', box.status);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setOverCol(null);
  };

  const handleDragOver = (e: React.DragEvent, colStatus: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setOverCol(colStatus);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setOverCol(null);
    }
  };

  const handleDrop = (e: React.DragEvent, colStatus: string) => {
    e.preventDefault();
    const boxId = e.dataTransfer.getData('boxId');
    const fromStatus = e.dataTransfer.getData('fromStatus');
    setDraggingId(null);
    setOverCol(null);
    if (boxId && fromStatus !== colStatus && onStatusChange) {
      onStatusChange(boxId, colStatus);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, alignItems: 'start', overflowX: 'auto', minWidth: 0 }}>
      {COLUMNS.map(col => {
        const colBoxes = boxes.filter(b => b.status === col.status);
        const isOver = overCol === col.status;
        const draggingBox = boxes.find(b => b.id === draggingId);
        const canDrop = !!draggingBox && draggingBox.status !== col.status;

        return (
          <div key={col.status} style={{ minWidth: 180 }}>
            {/* Column header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 7,
              background: col.bg,
              border: `1px solid ${col.color}28`,
              borderRadius: '8px 8px 0 0',
              padding: '8px 12px',
              marginBottom: 0,
            }}>
              <span style={{ fontSize: 15 }}>{col.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: col.color }}>{col.label}</span>
              <span style={{
                marginLeft: 'auto', background: col.color + '25', color: col.color,
                borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700,
              }}>{colBoxes.length}</span>
            </div>

            {/* Column body / drop zone */}
            <div
              onDragOver={e => handleDragOver(e, col.status)}
              onDragLeave={handleDragLeave}
              onDrop={e => handleDrop(e, col.status)}
              style={{
                background: isOver && canDrop ? `${col.color}18` : col.bg,
                border: `1px solid ${isOver && canDrop ? col.color : col.color + '28'}`,
                borderTop: 'none',
                borderRadius: '0 0 8px 8px',
                padding: 8,
                minHeight: 80,
                transition: 'background .15s, border-color .15s',
                outline: isOver && canDrop ? `2px dashed ${col.color}80` : 'none',
                outlineOffset: -3,
              }}
            >
              {colBoxes.length === 0 && (
                <div style={{ textAlign: 'center', padding: '18px 0', color: 'var(--text-dim)', fontSize: 12 }}>
                  {isOver && canDrop ? '⬇ Drop here' : '—'}
                </div>
              )}
              {colBoxes.map(b => (
                <div
                  key={b.id}
                  style={{ opacity: b.id === draggingId ? 0.35 : 1, transition: 'opacity .15s' }}
                  onDragEnd={handleDragEnd}
                >
                  <BoxCard
                    box={b}
                    isAdmin={isAdmin}
                    onCardClick={onCardClick}
                    onDelete={onDelete}
                    onDragStart={handleDragStart}
                  />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
