import React, { useRef, useState } from 'react';
import { ECU } from '../services/api';
import './KanbanBoard.css';

interface KanbanBoardProps {
  ecus: ECU[];
  onSelectECU: (ecu: ECU) => void;
  onAssign: (ecuId: string, expectedVersion: number) => void;
  onRelease: (ecuId: string) => void;
  onChangeStatus: (ecuId: string, newStatus: string, expectedVersion: number) => void;
  selectedId?: string;
  currentUserId?: string;
  loading: boolean;
}

export const COLUMNS: { key: string; label: string; color: string }[] = [
  { key: 'pending',     label: 'Pending',     color: '#6b7280' },
  { key: 'in_progress', label: 'In Progress', color: '#2563eb' },
  { key: 'done',        label: 'Done',        color: '#16a34a' },
  { key: 'blocked',     label: 'Blocked',     color: '#dc2626' },
];

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  done: 'Done',
  blocked: 'Blocked',
};

const ECUCard: React.FC<{
  ecu: ECU;
  selected: boolean;
  isMyECU: boolean;
  onClick: () => void;
  onAssign: () => void;
  onRelease: () => void;
  onChangeStatus: (newStatus: string) => void;
  onDragStart: (e: React.DragEvent) => void;
}> = ({ ecu, selected, isMyECU, onClick, onAssign, onRelease, onChangeStatus, onDragStart }) => {
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  return (
    <div
      className={`kanban-card ${selected ? 'kanban-card--selected' : ''}`}
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
    >
      <div className="kanban-card__header">
        <span className="kanban-card__barcode">{ecu.barcode}</span>
        <div className="kanban-card__badges">
          {ecu.lock_owner_id && <span className="kanban-card__lock" title="Locked">🔒</span>}
          <span className="kanban-card__drag-hint" title="Drag to move">⠿</span>
        </div>
      </div>

      {ecu.serial && (
        <div className="kanban-card__field">
          <span className="kanban-card__label">S/N:</span> {ecu.serial}
        </div>
      )}
      {ecu.hw_part_no && (
        <div className="kanban-card__field">
          <span className="kanban-card__label">HW:</span> {ecu.hw_part_no}
        </div>
      )}

      <div className="kanban-card__footer">
        <span className={`kanban-card__assignee ${ecu.assignee_id ? 'assigned' : 'unassigned'}`}>
          {ecu.assignee_id ? (isMyECU ? '👤 You' : '👤 Assigned') : '— Unassigned'}
        </span>
        <div className="kanban-card__actions">
          {isMyECU ? (
            <button
              className="kanban-card__btn kanban-card__btn--release"
              onClick={(e) => { e.stopPropagation(); onRelease(); }}
            >
              Release
            </button>
          ) : !ecu.assignee_id ? (
            <button
              className="kanban-card__btn kanban-card__btn--assign"
              onClick={(e) => { e.stopPropagation(); onAssign(); }}
            >
              Assign
            </button>
          ) : null}

          {/* Status change button */}
          <div className="kanban-status-menu" onClick={(e) => e.stopPropagation()}>
            <button
              className="kanban-card__btn kanban-card__btn--status"
              onClick={(e) => { e.stopPropagation(); setShowStatusMenu(!showStatusMenu); }}
              title="Change status"
            >
              ↕ Status
            </button>
            {showStatusMenu && (
              <div className="kanban-status-dropdown">
                {COLUMNS.map((col) => (
                  <button
                    key={col.key}
                    className={`kanban-status-option ${ecu.status === col.key ? 'kanban-status-option--active' : ''}`}
                    style={{ '--col-color': col.color } as React.CSSProperties}
                    onClick={() => {
                      if (col.key !== ecu.status) onChangeStatus(col.key);
                      setShowStatusMenu(false);
                    }}
                  >
                    <span className="kanban-status-option__dot" style={{ background: col.color }} />
                    {col.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const KanbanBoard: React.FC<KanbanBoardProps> = ({
  ecus,
  onSelectECU,
  onAssign,
  onRelease,
  onChangeStatus,
  selectedId,
  currentUserId,
  loading,
}) => {
  const dragECU = useRef<{ id: string; version: number } | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  const handleDragStart = (ecu: ECU) => (e: React.DragEvent) => {
    dragECU.current = { id: ecu.id, version: ecu.version };
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (colKey: string) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCol(colKey);
  };

  const handleDrop = (colKey: string) => (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverCol(null);
    if (dragECU.current) {
      onChangeStatus(dragECU.current.id, colKey, dragECU.current.version);
      dragECU.current = null;
    }
  };

  const handleDragLeave = () => setDragOverCol(null);
  const handleDragEnd = () => { dragECU.current = null; setDragOverCol(null); };

  if (loading) {
    return <div className="kanban-loading">Loading ECUs...</div>;
  }

  return (
    <div className="kanban-board">
      {COLUMNS.map((col) => {
        const colEcus = ecus.filter((e) => e.status === col.key);
        const isDragOver = dragOverCol === col.key;
        return (
          <div
            key={col.key}
            className={`kanban-column ${isDragOver ? 'kanban-column--drag-over' : ''}`}
            onDragOver={handleDragOver(col.key)}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop(col.key)}
            onDragEnd={handleDragEnd}
          >
            <div className="kanban-column__header" style={{ borderTopColor: col.color }}>
              <span className="kanban-column__title">{col.label}</span>
              <span className="kanban-column__count" style={{ background: col.color }}>
                {colEcus.length}
              </span>
            </div>
            <div className="kanban-column__cards">
              {colEcus.length === 0 ? (
                <div className={`kanban-column__empty ${isDragOver ? 'kanban-column__empty--over' : ''}`}>
                  {isDragOver ? '⬇ Drop here' : 'No ECUs'}
                </div>
              ) : (
                colEcus.map((ecu) => (
                  <ECUCard
                    key={ecu.id}
                    ecu={ecu}
                    selected={ecu.id === selectedId}
                    isMyECU={ecu.assignee_id === currentUserId}
                    onClick={() => onSelectECU(ecu)}
                    onAssign={() => onAssign(ecu.id, ecu.version)}
                    onRelease={() => onRelease(ecu.id)}
                    onChangeStatus={(newStatus) => onChangeStatus(ecu.id, newStatus, ecu.version)}
                    onDragStart={handleDragStart(ecu)}
                  />
                ))
              )}
              {isDragOver && colEcus.length > 0 && (
                <div className="kanban-drop-indicator">⬇ Drop here</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default KanbanBoard;
