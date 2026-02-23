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
import { autoCreateSessionsForNextDays } from './services/sessionService.js';
import { runSessionLifecycle } from './services/sessionLifecycleService.js';
import { purgeOldAuditLog } from './services/retentionService.js';
import { getAtRiskStudentsForAlerts, shouldSendBehaviorAlert } from './services/behaviorService.js';
import { getGuardianEmail, sendBehaviorAlertEmail, recordBehaviorAlert } from './services/notificationService.js';
import { runAdditiveMigrations } from './db/runAdditiveMigrations.js';
import { pool } from './db/pool.js';
import bcrypt from 'bcryptjs';
import authRoutes from './routes/auth.js';
import iotRoutes from './routes/iot.js';
import sessionRoutes from './routes/sessions.js';
import attendanceRoutes from './routes/attendance.js';
import scheduleRoutes from './routes/schedules.js';
import userRoutes from './routes/users.js';
import discrepancyRoutes from './routes/discrepancy.js';
import behaviorRoutes from './routes/behavior.js';
import classroomRoutes from './routes/classrooms.js';
import subjectRoutes from './routes/subjects.js';
import computerRoutes from './routes/computers.js';
import cookieParser from 'cookie-parser';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);

// When behind a proxy (Railway, load balancer), trust X-Forwarded-* so rate limiting and IP logging work correctly
if (env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// CORS: in production restrict to CORS_ORIGIN (comma-separated); else allow any (dev)
const corsOrigin = env.CORS_ORIGIN
  ? env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
  : true;
app.use(cors({
  origin: Array.isArray(corsOrigin) && corsOrigin.length > 0 ? corsOrigin : true,
  credentials: true,
}));

// Optional: require HTTPS in production (set REQUIRE_HTTPS=1)
if (env.NODE_ENV === 'production' && env.REQUIRE_HTTPS) {
  app.use((req, res, next) => {
    const proto = req.headers['x-forwarded-proto'];
    if (proto !== 'https') {
      res.status(403).json({ error: 'HTTPS required' });
      return;
    }
    next();
  });
}

app.use(helmet({ contentSecurityPolicy: false }));
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
app.use('/api/classrooms', classroomRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/computers', computerRoutes);

// Health: basic + DB check for load balancers and monitoring
app.get('/health', async (_req, res) => {
  let db = 'unknown';
  try {
    const { pool } = await import('./db/pool.js');
    await pool.query('SELECT 1');
    db = 'up';
  } catch {
    db = 'down';
  }
  const status = db === 'up' ? 'ok' : 'degraded';
  res.status(db === 'up' ? 200 : 503).json({ status, service: 'clirdec-presence', database: db });
});

// API docs: OpenAPI spec + Swagger UI (spec in dist/openapi.json when built, or ../src/openapi.json in dev)
const openapiPath = fs.existsSync(path.join(__dirname, 'openapi.json'))
  ? path.join(__dirname, 'openapi.json')
  : path.join(__dirname, '..', 'src', 'openapi.json');
app.get('/api-docs/spec.json', (_req, res) => {
  if (!fs.existsSync(openapiPath)) {
    res.status(404).json({ error: 'Spec not found' });
    return;
  }
  res.setHeader('Content-Type', 'application/json');
  res.sendFile(openapiPath);
});
app.get('/api-docs', (_req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>CLIRDEC API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js" crossorigin></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({ url: '/api-docs/spec.json', dom_id: '#swagger-ui' });
    };
  </script>
</body>
</html>
  `);
});

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

// Cron: auto-create sessions (e.g. 6:00 AM daily). Creates sessions with status "scheduled"; lifecycle cron activates them.
if (env.AUTO_SESSION_CRON) {
  cron.schedule(env.AUTO_SESSION_CRON, async () => {
    try {
      const result = await autoCreateSessionsForNextDays(env.SESSION_CREATE_DAYS);
      if (result.created > 0) {
        console.log(`[cron] Auto-created ${result.created} session(s) (scheduled) for next ${env.SESSION_CREATE_DAYS} day(s)`);
      }
    } catch (err) {
      console.error('[cron] Auto session create failed:', err);
    }
  });
  console.log(`Auto session cron enabled: ${env.AUTO_SESSION_CRON} (create ${env.SESSION_CREATE_DAYS} day(s) ahead)`);
}

// Cron: every minute — activate scheduled sessions when start time reached, end active when end time reached, mark absent.
cron.schedule('* * * * *', async () => {
  try {
    const { activated, ended, absentMarked } = await runSessionLifecycle();
    if (activated > 0 || ended > 0 || absentMarked > 0) {
      console.log(`[cron] Session lifecycle: ${activated} activated, ${ended} ended, ${absentMarked} absent marked`);
    }
  } catch (err) {
    console.error('[cron] Session lifecycle failed:', err);
  }
});

// On startup: run lifecycle once so sessions activate/end correctly if server was down (fully time-based).
runSessionLifecycle().then(({ activated, ended, absentMarked }) => {
  if (activated > 0 || ended > 0 || absentMarked > 0) {
    console.log(`[startup] Session lifecycle: ${activated} activated, ${ended} ended, ${absentMarked} absent marked`);
  }
}).catch((err) => console.error('[startup] Session lifecycle failed:', err));

// Cron: purge old audit log (daily at 3 AM). AUDIT_RETENTION_DAYS=0 to disable.
if (env.AUDIT_RETENTION_DAYS > 0) {
  cron.schedule('0 3 * * *', async () => {
    try {
      const { deleted } = await purgeOldAuditLog(env.AUDIT_RETENTION_DAYS);
      if (deleted > 0) {
        console.log(`[cron] Purged ${deleted} old audit log entry(ies)`);
      }
    } catch (err) {
      console.error('[cron] Audit retention purge failed:', err);
    }
  });
}

// Cron: behavior alerts to guardians (daily at 8 AM). Requires RESEND_API_KEY and EMAIL_FROM.
async function runBehaviorAlerts(): Promise<void> {
  const atRisk = await getAtRiskStudentsForAlerts();
  let sent = 0;
  for (const student of atRisk) {
    if (!(await shouldSendBehaviorAlert(student.userId))) continue;
    const guardianEmail = await getGuardianEmail(student.userId);
    if (!guardianEmail) continue;
    const ok = await sendBehaviorAlertEmail({
      recipientEmail: guardianEmail,
      studentName: student.full_name,
      attendanceRate: student.attendanceRate,
      level: student.level,
    });
    await recordBehaviorAlert({
      userId: student.userId,
      recipientEmail: guardianEmail,
      status: ok ? 'sent' : 'failed',
      payload: { attendanceRate: student.attendanceRate, level: student.level },
    });
    if (ok) sent++;
  }
  if (sent > 0) console.log(`[cron] Sent ${sent} behavior alert email(s) to guardians`);
}
cron.schedule('0 8 * * *', () => {
  runBehaviorAlerts().catch((err) => console.error('[cron] Behavior alerts failed:', err));
});

// Production: warn if JWT_SECRET is default or weak
if (env.NODE_ENV === 'production') {
  const secret = process.env.JWT_SECRET ?? '';
  if (!secret || secret === 'change-me-in-production' || secret.length < 32) {
    console.warn('[security] JWT_SECRET should be set to a strong random value (≥32 chars) in production.');
  }
}

// Optional: seed admin user when SEED_ADMIN=1 and no users exist (e.g. CI/E2E)
async function seedAdminIfNeeded(): Promise<void> {
  if (!process.env.SEED_ADMIN || process.env.SEED_ADMIN === '0') return;
  try {
    const r = await pool.query('SELECT 1 FROM users LIMIT 1');
    if (r.rows.length > 0) return;
    const password = process.env.SEED_ADMIN_PASSWORD ?? 'password';
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role) VALUES ($1, $2, $3, 'admin')`,
      ['admin@example.com', hash, 'Admin']
    );
    console.log('[seed] Created admin@example.com for E2E/CI');
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === '42P01') return; // ignore if users table doesn't exist yet
    throw e;
  }
}

// Run additive migrations on startup (last_seen_at, audit_log) so app works if db:migrate wasn't run
runAdditiveMigrations()
  .then(() => seedAdminIfNeeded())
  .then(() => {
    httpServer.listen(env.PORT, () => {
      console.log(`CLIRDEC backend listening on port ${env.PORT}`);
    });
  })
  .catch((err) => {
    console.error('Startup failed:', err);
    process.exit(1);
  });

export { wsBroadcast };
