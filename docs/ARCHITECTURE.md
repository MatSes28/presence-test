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
| **Real-time** | /ws (clients), /iot (devices) | /ws (dashboard), /iot (devices) + REST /api/iot/attendance; devices connect over **WiFi** | ✅ |
| **Validation** | 7-second RFID+proximity window | Configurable (env), default 7s | ✅ |
| **Security** | Helmet, rate limiting | Helmet + express-rate-limit | ✅ |

---

## Database (Current vs Spec)

**Current tables:** `users` (with optional `guardian_email`), `rfid_cards`, `schedules`, `class_sessions`, `attendance_events`, `email_notifications`

**Optional / spec alignment:** `schema-optional-tables.sql` adds **classrooms** and **subjects** tables (run manually if desired). Schedules currently use `room` and `subject` as text. Future: Computers, Computer Assignments, Enrollments (student–subject links) can be added similarly. **IoT Devices**, **Email Notifications** are implemented.

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
- **Auto session creation** — Cron creates sessions with status **Scheduled** and `started_at` = schedule start time on that date. A **per-minute scheduler** activates them when the current time reaches the schedule start time (status → **Active**) and auto-completes them when end time is reached (status → **Completed** / ended). No manual activation required unless faculty start/end sessions manually.
- **Time-based IoT window** — ESP32 taps are accepted only when there is an **active** session and the current time is within the schedule’s start time–end time window. Present/Late are computed from the schedule start time (grace period, late cutoff).
- **Auto-absent** — When a session is auto-completed, any student with an RFID card who has no attendance event for that session is marked **Absent** (system-inserted attendance_event with `attendance_status = 'absent'`).
- **Guardian / behavior alerts** — Resend sends guardian emails on attendance and daily behavior alerts for at-risk students (with cooldown).

---

## Optional / Future

- ~~Session-based auth with HTTP-only cookies~~ **Done:** JWT in HTTP-only cookie (`clirdec_session`), cookie or Bearer accepted; `GET /api/auth/me`, `POST /api/auth/logout`.
- ~~Shadcn/ui component library~~ **Done:** Button, Card, Input in `components/ui`; used on Login, Schedules, Users, Dashboard, Sessions, IoT Devices.
- **Optional tables:** `schema-optional-tables.sql` adds Classrooms, Subjects (run manually). Drizzle ORM and Enrollments, Computers remain optional.
- ~~IoT device registry~~ **Done:** `iot_devices` table; `GET/POST/PATCH/DELETE /api/iot/devices` (admin); `last_seen_at` updated on attendance
- ~~Automatic session creation on a schedule (cron calling `/api/sessions/auto-create`)~~ **Done:** `node-cron` runs `AUTO_SESSION_CRON` (default `0 6 * * *`); set to empty to disable.
- ~~Real email sending (Resend/SendGrid)~~ **Done:** Resend in `notifyGuardian()` when `RESEND_API_KEY` and `EMAIL_FROM` are set.
