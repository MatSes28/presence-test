import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { env } from './config/env.js';
import { attachWebSocket } from './websocket/index.js';
import { attachIotWebSocket } from './websocket/iot.js';
import cron from 'node-cron';
import { ingestAttendance } from './services/attendanceValidation.js';
import { autoCreateSessionsForToday } from './services/sessionService.js';
import authRoutes from './routes/auth.js';
import iotRoutes from './routes/iot.js';
import sessionRoutes from './routes/sessions.js';
import attendanceRoutes from './routes/attendance.js';
import scheduleRoutes from './routes/schedules.js';
import userRoutes from './routes/users.js';
import discrepancyRoutes from './routes/discrepancy.js';
import behaviorRoutes from './routes/behavior.js';
import cookieParser from 'cookie-parser';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Too many requests' },
});
app.use('/api/', apiLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many login attempts' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/iot', iotRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/users', userRoutes);
app.use('/api/discrepancy-flags', discrepancyRoutes);
app.use('/api/behavior', behaviorRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'clirdec-presence' }));

// Production: serve frontend static files and SPA fallback
const publicDir = path.join(__dirname, '..', 'public');
if (env.NODE_ENV === 'production' && fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  app.get('*', (_req, res) => res.sendFile(path.join(publicDir, 'index.html')));
}

const wsBroadcast = attachWebSocket(httpServer);
app.set('wsBroadcast', wsBroadcast);

attachIotWebSocket(httpServer, async (payload) => {
  const result = await ingestAttendance(payload);
  if (result.success && result.broadcast) {
    wsBroadcast.broadcastAttendance(result.broadcast);
  }
});

// Cron: auto-create sessions for today (e.g. 6:00 AM daily). Set AUTO_SESSION_CRON="" to disable.
if (env.AUTO_SESSION_CRON) {
  cron.schedule(env.AUTO_SESSION_CRON, async () => {
    try {
      const result = await autoCreateSessionsForToday();
      if (result.created > 0) {
        console.log(`[cron] Auto-created ${result.created} session(s) for today`);
      }
    } catch (err) {
      console.error('[cron] Auto session create failed:', err);
    }
  });
  console.log(`Auto session cron enabled: ${env.AUTO_SESSION_CRON}`);
}

httpServer.listen(env.PORT, () => {
  console.log(`CLIRDEC backend listening on port ${env.PORT}`);
});

export { wsBroadcast };
