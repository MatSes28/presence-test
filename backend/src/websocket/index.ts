import { WebSocketServer } from 'ws';
import type { Server } from 'http';

/** WebSocket for dashboard clients (live attendance feed). */
export function attachWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'ping') ws.send(JSON.stringify({ type: 'pong' }));
      } catch {
        // ignore
      }
    });
  });

  return {
    broadcastAttendance(event: { sessionId: string; userId: string; full_name: string; recorded_at: string }) {
      const payload = JSON.stringify({ type: 'attendance', data: event });
      wss.clients.forEach((client) => {
        if (client.readyState === 1) client.send(payload);
      });
    },
  };
}

export type WsBroadcast = ReturnType<typeof attachWebSocket>;
