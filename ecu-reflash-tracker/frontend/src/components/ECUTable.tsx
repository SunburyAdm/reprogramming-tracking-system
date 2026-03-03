import React from 'react';
import { ECU } from '../services/api';
import { useAuthStore } from '../store';
import './ECUTable.css';

interface ECUTableProps {
  ecus: ECU[];
  onSelectECU: (ecu: ECU) => void;
  onAssign: (ecuId: string, expectedVersion: number) => void;
  onRelease: (ecuId: string) => void;
  selectedId?: string;
  loading?: boolean;
}

export const ECUTable: React.FC<ECUTableProps> = ({
  ecus,
  onSelectECU,
  onAssign,
  onRelease,
  selectedId,
  loading,
}) => {
  const user = useAuthStore((state) => state.user);

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString();
  };

  return (
    <div className="ecu-table-container">
      {loading && <div className="loading">Loading...</div>}
      <table className="ecu-table">
        <thead>
          <tr>
            <th>Barcode</th>
            <th>Serial</th>
            <th>HW PN</th>
            <th>HW Ver</th>
            <th>SW Ver</th>
            <th>Status</th>
            <th>Assignee</th>
            <th>Last Seen</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {ecus.map((ecu) => (
            <tr
              key={ecu.id}
              className={`ecu-row ${selectedId === ecu.id ? 'selected' : ''}`}
              onClick={() => onSelectECU(ecu)}
            >
              <td className="barcode-cell">{ecu.barcode}</td>
              <td>{ecu.serial || '—'}</td>
              <td>{ecu.hw_part_no || '—'}</td>
              <td>{ecu.hw_version || '—'}</td>
              <td>{ecu.sw_version || '—'}</td>
              <td>
                <span className={`badge ${ecu.status}`}>
                  {ecu.status}
                </span>
              </td>
              <td>{ecu.assignee_id ? 'Assigned' : '—'}</td>
              <td className="muted">{formatDate(ecu.last_seen)}</td>
              <td className="actions-cell">
                {ecu.assignee_id === user?.id ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRelease(ecu.id);
                    }}
                    className="btn-small danger"
                  >
                    Release
                  </button>
                ) : !ecu.assignee_id ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAssign(ecu.id, ecu.version);
                    }}
                    className="btn-small"
                  >
                    Take
                  </button>
                ) : (
                  <span className="locked">Locked</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {ecus.length === 0 && !loading && (
        <div className="empty-state">No ECUs found</div>
      )}
    </div>
  );
};
