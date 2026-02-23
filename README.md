# CLIRDEC:PRESENCE

Attendance monitoring and classroom engagement system for **Central Luzon State University** — Department of Information Technology (DIT), College of Engineering (BSIT). Combines RFID identification with proximity (ultrasonic) verification to reduce ghost attendance and support real-time monitoring.

See **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** for system architecture and spec alignment.

## Features

- **RFID-based identification** — Students authenticate via RFID cards linked to their profiles.
- **Proximity-assisted presence** — Ultrasonic sensing confirms the student is within the entry zone.
- **ESP32-S3 IoT integration** — Devices connect over **WiFi** and send validated events (RC522 + ultrasonic) to the server.
- **Session-based recording** — Attendance is recorded only during active class sessions.
- **Role-based access** — Admin and faculty dashboards; students use cards only.
- **Real-time updates** — WebSocket feed for live attendance events.
- **Reports** — Attendance logs, session reports, and **CSV export** for monitoring and evaluation.

## Tech Stack

| Layer | Stack |
|-------|--------|
| Frontend | React, TypeScript, Vite |
| Backend | Node.js, Express |
| Database | PostgreSQL |
| Real-time | WebSocket |
| Hardware | ESP32-S3 (WiFi), RC522 RFID, ultrasonic sensors |

## Local development

### Prerequisites

- Node.js 18+
- PostgreSQL (local or Docker)

### Setup

1. Clone and install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env` in the project root or in `backend/` (see [Environment variables](#environment-variables)).

3. Create the database and run migrations:

   ```bash
   createdb clirdec
   npm run db:migrate
   ```

4. Start backend and frontend:

   ```bash
   npm run dev
   ```

   - Backend: http://localhost:3001  
   - Frontend: http://localhost:5173 (proxies API and WebSocket to backend)

5. **First user (admin):** Register via API (e.g. Postman or curl):

   ```bash
   curl -X POST http://localhost:3001/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@example.com","password":"yourpassword","full_name":"Admin","role":"admin"}'
   ```

   Then sign in at the app with that email and password.

### IoT endpoint (ESP32-S3 over WiFi)

ESP32-S3 units connect to the same network (WiFi) as the server and send attendance via HTTP or WebSocket.

- **REST:** POST `http://<server>/api/iot/attendance` (use `https` in production) with JSON:

```json
{
  "card_uid": "RFID_UID_STRING",
  "proximity_cm": 45,
  "session_id": "optional-uuid-if-multiple-sessions",
  "device_id": "optional-device-id"
}
```

- If `session_id` is omitted, the current **active** session is used (one active session at a time).
- Attendance is accepted only when the card is registered, proximity is within the configured range, and the session is active. Duplicate scans for the same user in the same session are ignored.
- **IoT device registry:** Admins can register devices at **IoT devices** in the app. When `device_id` is sent with attendance, the device’s `last_seen_at` is updated for health monitoring.

## Deployment on Railway

1. Create a new project on [Railway](https://railway.app).

2. Add a **PostgreSQL** service and note the `DATABASE_URL` from the Variables tab.

3. Add a **Web Service** from this repo (GitHub connect or deploy from CLI).

4. Set **root directory** to the repo root (default).

5. Configure environment variables in the Railway service:

   | Variable | Required | Description |
   |----------|----------|-------------|
   | `DATABASE_URL` | Yes | From PostgreSQL service (auto-linked if same project). |
   | `JWT_SECRET` | Yes | Strong secret for session tokens. |
   | `NODE_ENV` | No | Set to `production`. |
   | `PORT` | No | Railway sets this automatically. |
   | `AUTO_SESSION_CRON` | No | Cron expression for auto-creating sessions (default: `0 6 * * *` = 6 AM daily). Set empty to disable. |
   | `RESEND_API_KEY` | No | Resend API key for guardian email notifications. If unset, notifications are logged only. |
   | `EMAIL_FROM` | No | From address for emails (e.g. `notifications@yourdomain.com`). Required when using Resend. |
   | `SESSION_COOKIE_NAME` | No | HTTP-only session cookie name (default: `clirdec_session`). |
   | `CORS_ORIGIN` | No | Comma-separated allowed origins (e.g. `https://your-app.railway.app`). Empty = allow any (dev). |
   | `REQUIRE_HTTPS` | No | Set to `1` or `true` in production to reject non-HTTPS requests (behind proxy). |

6. Build and start:

   - **Build command:** `npm run build` (builds frontend, copies to backend, then builds backend).
   - **Start command:** `npm run start` (runs `node backend/dist/index.js`).

7. Run migrations once after first deploy (Railway run command or one-off):

   ```bash
   npm run db:migrate
   ```

   Ensure `DATABASE_URL` is available when running this.

8. Create the first admin user via `/api/auth/register` as above (use your deployed URL).

---

**CLIRDEC** provides a structured, secure workflow for classroom attendance with identity verification and presence detection, suitable for faculty and administrative reporting.
