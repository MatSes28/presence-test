import { useEffect, useRef, useState } from 'react';

export interface AttendanceEvent {
  sessionId: string;
  userId: string;
  full_name: string;
  recorded_at: string;
  attendanceStatus?: 'present' | 'late';
}

export function useWebSocket(onAttendance?: (e: AttendanceEvent) => void) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const onAttendanceRef = useRef(onAttendance);
  onAttendanceRef.current = onAttendance;

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const ws = new WebSocket(`${protocol}//${host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'attendance' && msg.data && onAttendanceRef.current) {
          onAttendanceRef.current(msg.data);
        }
      } catch {}
    };

    const id = setInterval(() => {
      if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'ping' }));
    }, 15000);

    return () => {
      clearInterval(id);
      ws.close();
      wsRef.current = null;
      setConnected(false);
    };
  }, []);

  return { connected };
}
