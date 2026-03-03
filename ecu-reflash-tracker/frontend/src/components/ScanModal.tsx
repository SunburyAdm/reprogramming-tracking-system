import React, { useState } from 'react';
import { useQRScanner } from '../services/qr';
import './ScanModal.css';

interface ScanModalProps {
  onScanResult: (barcode: string) => void;
  onClose: () => void;
}

export const ScanModal: React.FC<ScanModalProps> = ({ onScanResult, onClose }) => {
  const { videoRef, canvasRef, scanning, result, startScanning, stopScanning, setResult } = useQRScanner();
  const [manualInput, setManualInput] = useState('');
  const [useManual, setUseManual] = useState(false);

  const handleScanSuccess = (barcode: string) => {
    onScanResult(barcode);
    setResult(null);
    setManualInput('');
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      handleScanSuccess(manualInput.trim());
      onClose();
    }
  };

  React.useEffect(() => {
    if (result) {
      setTimeout(() => handleScanSuccess(result), 300);
    }
  }, [result]);

  if (useManual) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <h2>Enter Barcode Manually</h2>
          <form onSubmit={handleManualSubmit}>
            <input
              type="text"
              placeholder="Enter barcode..."
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              autoFocus
            />
            <div className="modal-buttons">
              <button type="submit" className="primary">
                Scan
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => setUseManual(false)}
              >
                Use Camera
              </button>
              <button
                type="button"
                className="secondary"
                onClick={onClose}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content scan-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{scanning ? 'Point camera at barcode' : 'Ready to scan'}</h2>
        
        {scanning ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="video-feed"
            />
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </>
        ) : (
          <div className="scan-placeholder">
            <p>Camera off</p>
          </div>
        )}

        <div className="modal-buttons">
          {scanning ? (
            <button onClick={stopScanning} className="danger">
              Stop Scanning
            </button>
          ) : (
            <button onClick={startScanning} className="primary">
              Start Scanning
            </button>
          )}
          <button onClick={() => setUseManual(true)} className="secondary">
            Enter Manually
          </button>
          <button onClick={onClose} className="secondary">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
