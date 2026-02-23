# CLIRDEC:PRESENCE — Architecture & Spec Alignment

Attendance monitoring and classroom engagement system for **Central Luzon State University** — Department of Information Technology (DIT), College of Engineering (BSIT).

---

## Current Stack vs Spec

| Area | Spec | Current | Notes |
|------|------|---------|--------|
| **Frontend** | React 18, TypeScript, Vite | ✅ Same | |
| **Styling** | Tailwind CSS | Tailwind + existing CSS vars | ✅ |
| **Routing** | Wouter | React Router | Same behavior, different library |
| **State** | TanStack Query | TanStack Query (sessions, schedules) | ✅ |
| **UI** | Shadcn/ui patterns | Button, Card, Input (shadcn-style) + custom | ✅ |
| **Backend** | Node, Express, TypeScript | ✅ Same | |
| **Database** | PostgreSQL, Drizzle ORM | PostgreSQL, raw `pg` | Drizzle optional for migrations |
| **Auth** | Session + HTTP-only cookies | JWT (Bearer) | Session/cookies possible later |
| **Real-time** | /ws (clients), /iot (devices) | /ws (dashboard), /iot (devices) + REST /api/iot/attendance | ✅ |
| **Validation** | 7-second RFID+proximity window | Configurable (env), default 7s | ✅ |
| **Security** | Helmet, rate limiting | Helmet + express-rate-limit | ✅ |

---

## Database (Current vs Spec)

**Current tables:** `users` (with optional `guardian_email`), `rfid_cards`, `schedules`, `class_sessions`, `attendance_events`, `email_notifications`

**Spec adds (for full alignment):**
- **Students** — extended from users: guardian contact, etc.
- **Classrooms** — designated rooms (we use `schedules.room` as text).
- **Subjects** — course info (we use `schedules.subject` as text).
- **Computers** — lab workstations.
- **Computer Assignments** — student–workstation mapping.
- **IoT Devices** — registered ESP32 devices, health.
- **Email Notifications** — log of sent notifications.
- **Enrollments** — student–subject links.

These can be added as needed for guardian notifications, lab usage, and device monitoring.

---

## Implemented

- Role-based access (Administrator, Faculty)
- RFID + proximity validation (configurable window, default 7s)
- Class sessions from schedules; faculty see only their sessions
- Real-time attendance feed (WebSocket)
- Admin: create users (faculty/student), schedules, view all sessions/reports
- Faculty: view their sessions, start/end, view attendance reports
- CSV export for attendance reports
- **IoT WebSocket** — `/iot` for devices (heartbeat, attendance); REST `/api/iot/attendance` still supported
- **Guardian contact** — `guardian_email` on users (students); `email_notifications` table; real email via Resend when `RESEND_API_KEY` and `EMAIL_FROM` are set
- **Auto session creation** — `POST /api/sessions/auto-create` (admin) creates today’s sessions from schedules

---

## Optional / Future

- ~~Session-based auth with HTTP-only cookies~~ **Done:** JWT in HTTP-only cookie (`clirdec_session`), cookie or Bearer accepted; `GET /api/auth/me`, `POST /api/auth/logout`.
- ~~Shadcn/ui component library~~ **Done:** Button, Card, Input in `components/ui`; used on Login, Schedules, Users, Dashboard, Sessions, IoT Devices.
- Drizzle ORM and extra tables (Classrooms, Subjects, Enrollments, Computers)
- ~~IoT device registry~~ **Done:** `iot_devices` table; `GET/POST/PATCH/DELETE /api/iot/devices` (admin); `last_seen_at` updated on attendance
- ~~Automatic session creation on a schedule (cron calling `/api/sessions/auto-create`)~~ **Done:** `node-cron` runs `AUTO_SESSION_CRON` (default `0 6 * * *`); set to empty to disable.
- ~~Real email sending (Resend/SendGrid)~~ **Done:** Resend in `notifyGuardian()` when `RESEND_API_KEY` and `EMAIL_FROM` are set.
