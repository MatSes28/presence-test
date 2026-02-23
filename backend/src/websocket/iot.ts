import { WebSocketServer } from 'ws';
import type { Server } from 'http';

export type OnIotAttendance = (payload: { card_uid: string; proximity_cm: number; device_id?: string; session_id?: string }) => void;

export function attachIotWebSocket(server: Server, onAttendance?: OnIotAttendance) {
  const wss = new WebSocketServer({ server, path: '/iot' });

  wss.on('connection', (ws) => {
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'ping' || msg.type === 'heartbeat') {
          ws.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
          return;
        }
        if (msg.type === 'attendance' && msg.data && onAttendance) {
          onAttendance(msg.data);
        }
      } catch {
        // ignore
      }
    });
  });

  return {
    getDeviceCount() {
      return wss.clients.size;
    },
  };
}
