import { useCallback, useRef, useState } from 'react';
import jsQR from 'jsqr';

export const useQRScanner = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const startScanning = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      alert('Camera not available');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setScanning(true);
        scanQR();
      }
    } catch (err) {
      console.error('Camera error:', err);
      alert('Failed to access camera');
    }
  }, []);

  const scanQR = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const context = canvasRef.current.getContext('2d');
    if (!context) return;

    const video = videoRef.current;
    canvasRef.current.width = video.videoWidth;
    canvasRef.current.height = video.videoHeight;

    context.drawImage(video, 0, 0);
    const imageData = context.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);

    if (code) {
      setResult(code.data);
      stopScanning();
    } else if (scanning) {
      setTimeout(scanQR, 100);
    }
  };

  const stopScanning = () => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
    }
    setScanning(false);
  };

  return {
    videoRef,
    canvasRef,
    scanning,
    result,
    startScanning,
    stopScanning,
    setResult,
  };
};
