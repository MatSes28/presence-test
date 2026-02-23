import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { env } from './config/env.js';
import { attachWebSocket } from './websocket/index.js';
import authRoutes from './routes/auth.js';
import iotRoutes from './routes/iot.js';
import sessionRoutes from './routes/sessions.js';
import attendanceRoutes from './routes/attendance.js';
import scheduleRoutes from './routes/schedules.js';
import userRoutes from './routes/users.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/iot', iotRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/users', userRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'clirdec-presence' }));

// Production: serve frontend static files and SPA fallback
const publicDir = path.join(__dirname, '..', 'public');
if (env.NODE_ENV === 'production' && fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  app.get('*', (_req, res) => res.sendFile(path.join(publicDir, 'index.html')));
}

const wsBroadcast = attachWebSocket(httpServer);
app.set('wsBroadcast', wsBroadcast);

httpServer.listen(env.PORT, () => {
  console.log(`CLIRDEC backend listening on port ${env.PORT}`);
});

export { wsBroadcast };
