import React, { useState, useEffect } from 'react';
import { ECU, Upload, HistoryEntry, ecuAPI } from '../services/api';
import './ECUDetails.css';

const STATUS_OPTIONS = [
  { value: 'pending',     label: 'Pending',     color: '#6b7280' },
  { value: 'in_progress', label: 'In Progress', color: '#2563eb' },
  { value: 'done',        label: 'Done',        color: '#16a34a' },
  { value: 'blocked',     label: 'Blocked',     color: '#dc2626' },
];

interface ECUDetailsProps {
  ecu: ECU | null;
  onClose: () => void;
  onUpload: (file: File, kind: string, notes: string) => void;
  onChangeStatus: (ecuId: string, newStatus: string, expectedVersion: number) => Promise<void>;
  onEditECU: (ecuId: string, data: { barcode?: string; serial?: string; hw_part_no?: string; status?: string }, expectedVersion: number) => Promise<void>;
  uploadLoading?: boolean;
}

export const ECUDetails: React.FC<ECUDetailsProps> = ({
  ecu,
  onClose,
  onUpload,
  onChangeStatus,
  onEditECU,
  uploadLoading,
}) => {
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Upload form state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadKind, setUploadKind] = useState('dump');
  const [uploadNotes, setUploadNotes] = useState('');

  // Edit mode state
  const [editMode, setEditMode] = useState(false);
  const [editBarcode, setEditBarcode] = useState('');
  const [editSerial, setEditSerial] = useState('');
  const [editHwPartNo, setEditHwPartNo] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // Status quick-change state
  const [statusSaving, setStatusSaving] = useState(false);

  useEffect(() => {
    if (ecu) {
      loadECUData();
      // Reset edit mode when ECU changes
      setEditMode(false);
      setEditError('');
    }
  }, [ecu?.id]);

  const loadECUData = async () => {
    if (!ecu) return;
    setLoadingData(true);
    try {
      const [uploadsRes, historyRes] = await Promise.all([
        ecuAPI.getUploads(ecu.id),
        ecuAPI.getHistory(ecu.id),
      ]);
      setUploads(uploadsRes.data);
      setHistory(historyRes.data);
    } catch (err) {
      console.error('Error loading ECU data:', err);
    } finally {
      setLoadingData(false);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile || !ecu) return;
    await onUpload(uploadFile, uploadKind, uploadNotes);
    setUploadFile(null);
    setUploadNotes('');
    await loadECUData();
  };

  const openEdit = () => {
    if (!ecu) return;
    setEditBarcode(ecu.barcode);
    setEditSerial(ecu.serial || '');
    setEditHwPartNo(ecu.hw_part_no || '');
    setEditStatus(ecu.status);
    setEditError('');
    setEditMode(true);
  };

  const cancelEdit = () => {
    setEditMode(false);
    setEditError('');
  };

  const saveEdit = async () => {
    if (!ecu) return;
    setEditSaving(true);
    setEditError('');
    try {
      await onEditECU(
        ecu.id,
        {
          barcode: editBarcode.trim() || undefined,
          serial: editSerial.trim() || undefined,
          hw_part_no: editHwPartNo.trim() || undefined,
          status: editStatus !== ecu.status ? editStatus : undefined,
        },
        ecu.version,
      );
      setEditMode(false);
      await loadECUData();
    } catch (err: any) {
      setEditError(err.response?.data?.detail || 'Error saving changes');
    } finally {
      setEditSaving(false);
    }
  };

  const handleQuickStatus = async (newStatus: string) => {
    if (!ecu || newStatus === ecu.status) return;
    setStatusSaving(true);
    try {
      await onChangeStatus(ecu.id, newStatus, ecu.version);
    } finally {
      setStatusSaving(false);
    }
  };

  if (!ecu) {
    return null;
  }

  return (
    <div className="ecu-details-overlay" onClick={onClose}>
      <div className="ecu-details-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <h2>{ecu.barcode}</h2>
          <div className="drawer-header-actions">
            {!editMode && (
              <button className="edit-btn" onClick={openEdit} title="Edit ECU fields">
                ✏️ Edit
              </button>
            )}
            <button onClick={onClose} className="close-btn">✕</button>
          </div>
        </div>

        <div className="drawer-content">
          {/* Details Section */}
          <section className="section">
            <h3>Details</h3>

            {editMode ? (
              <div className="edit-form">
                {editError && <div className="edit-error">{editError}</div>}
                <div className="edit-field">
                  <label>Barcode</label>
                  <input
                    value={editBarcode}
                    onChange={(e) => setEditBarcode(e.target.value)}
                    disabled={editSaving}
                    placeholder="Barcode"
                  />
                </div>
                <div className="edit-field">
                  <label>Serial</label>
                  <input
                    value={editSerial}
                    onChange={(e) => setEditSerial(e.target.value)}
                    disabled={editSaving}
                    placeholder="Serial number (optional)"
                  />
                </div>
                <div className="edit-field">
                  <label>HW Part No</label>
                  <input
                    value={editHwPartNo}
                    onChange={(e) => setEditHwPartNo(e.target.value)}
                    disabled={editSaving}
                    placeholder="HW Part number (optional)"
                  />
                </div>
                <div className="edit-field">
                  <label>Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    disabled={editSaving}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div className="edit-actions">
                  <button className="btn-save" onClick={saveEdit} disabled={editSaving || !editBarcode.trim()}>
                    {editSaving ? 'Saving...' : '✓ Save'}
                  </button>
                  <button className="btn-cancel" onClick={cancelEdit} disabled={editSaving}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="details-grid">
                  <div>
                    <label>Barcode</label>
                    <p>{ecu.barcode}</p>
                  </div>
                  <div>
                    <label>Serial</label>
                    <p>{ecu.serial || '—'}</p>
                  </div>
                  <div>
                    <label>HW Part No</label>
                    <p>{ecu.hw_part_no || '—'}</p>
                  </div>
                  <div>
                    <label>Version</label>
                    <p>{ecu.version}</p>
                  </div>
                  <div>
                    <label>Created</label>
                    <p>{new Date(ecu.created_at).toLocaleString()}</p>
                  </div>
                  <div>
                    <label>Updated</label>
                    <p>{new Date(ecu.updated_at).toLocaleString()}</p>
                  </div>
                </div>

                {/* Status quick-change */}
                <div className="status-section">
                  <label className="status-label">Status</label>
                  <div className="status-pills">
                    {STATUS_OPTIONS.map((s) => (
                      <button
                        key={s.value}
                        className={`status-pill ${ecu.status === s.value ? 'status-pill--active' : ''}`}
                        style={ecu.status === s.value ? { background: s.color, color: '#fff', borderColor: s.color } : { borderColor: s.color, color: s.color }}
                        onClick={() => handleQuickStatus(s.value)}
                        disabled={statusSaving || ecu.status === s.value}
                        title={`Set status to ${s.label}`}
                      >
                        {statusSaving && ecu.status !== s.value ? '...' : s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </section>

          {/* Uploads Section */}
          <section className="section">
            <h3>Uploads</h3>
            {loadingData ? (
              <p className="muted">Loading...</p>
            ) : uploads.length > 0 ? (
              <div className="uploads-list">
                {uploads.map((upload) => (
                  <div key={upload.id} className="upload-item">
                    <div>
                      <p className="filename">{upload.filename}</p>
                      <p className="muted">{upload.kind} • {(upload.file_size / 1024).toFixed(2)} KB</p>
                    </div>
                    <p className="date">{new Date(upload.created_at).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">No uploads yet</p>
            )}

            <div className="upload-form">
              <h4>Add Upload</h4>
              <input
                type="file"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                disabled={uploadLoading}
              />
              <select
                value={uploadKind}
                onChange={(e) => setUploadKind(e.target.value)}
                disabled={uploadLoading}
              >
                <option value="dump">Dump</option>
                <option value="log">Log</option>
                <option value="config">Config</option>
              </select>
              <textarea
                placeholder="Notes (optional)"
                value={uploadNotes}
                onChange={(e) => setUploadNotes(e.target.value)}
                rows={2}
                disabled={uploadLoading}
              />
              <button
                onClick={handleUpload}
                disabled={!uploadFile || uploadLoading}
              >
                {uploadLoading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </section>

          {/* History Section */}
          <section className="section">
            <h3>History</h3>
            {loadingData ? (
              <p className="muted">Loading...</p>
            ) : history.length > 0 ? (
              <div className="history-timeline">
                {history.map((entry) => (
                  <div key={entry.id} className="timeline-item">
                    <div className="timeline-dot"></div>
                    <div className="timeline-content">
                      <p className="action">{entry.action.toUpperCase()}</p>
                      <p className="date">{new Date(entry.created_at).toLocaleString()}</p>
                      {entry.data && (
                        <p className="data">{JSON.stringify(entry.data)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">No history</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
