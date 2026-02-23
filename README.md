# CLIRDEC: Presence-Proximity and RFID-Enabled Smart Entry

**Notation of Classroom Engagement** — An attendance monitoring system that combines RFID identification with proximity (ultrasonic) verification to ensure physical presence during check-in.

## Features

- **RFID-based identification** — Students authenticate via RFID cards linked to their profiles.
- **Proximity-assisted presence** — Ultrasonic sensing confirms the student is within the entry zone.
- **ESP32 IoT integration** — Hardware (RC522 + ultrasonic) sends validated events to the server.
- **Session-based recording** — Attendance is recorded only during active class sessions.
- **Role-based access** — Admin and faculty dashboards; students use cards only.
- **Real-time updates** — WebSocket feed for live attendance events.
- **Reports** — Attendance logs and session reports for monitoring and evaluation.

## Tech Stack

| Layer | Stack |
|-------|--------|
| Frontend | React, TypeScript, Vite |
| Backend | Node.js, Express |
| Database | PostgreSQL |
| Real-time | WebSocket |
| Hardware | ESP32, RC522 RFID, ultrasonic sensors |

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

### IoT endpoint (ESP32)

POST `http://<server>/api/iot/attendance` with JSON:

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
