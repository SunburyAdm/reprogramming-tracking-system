import { useState, useEffect, useRef, useCallback } from 'react';

export const useWebSocket = (url: string | null, onMessage?: (data: any) => void) => {
  const [isConnected, setIsConnected] = useState(false);
  const ws = useRef<WebSocket | null>(null);
  // Use a ref for the callback to avoid re-creating the WebSocket on every render
  const onMessageRef = useRef(onMessage);
  useEffect(() => {
    onMessageRef.current = onMessage;
  });

  useEffect(() => {
    if (!url) return;

    const wsUrl = url.replace('http://', 'ws://').replace('https://', 'wss://');
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
    };

    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessageRef.current?.(data);
      } catch (err) {
        console.error('WebSocket message parse error:', err);
      }
    };

    ws.current.onerror = () => {
      setIsConnected(false);
    };

    ws.current.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
    };

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [url]); // Only reconnect when URL changes

  const send = useCallback((message: any) => {
    if (ws.current && isConnected) {
      ws.current.send(JSON.stringify(message));
    }
  }, [isConnected]);

  return { isConnected, send };
};
