# CLIRDEC:PRESENCE — Architecture & Spec Alignment

Attendance monitoring and classroom engagement system for **Central Luzon State University** — Department of Information Technology (DIT), College of Engineering (BSIT).

---

## Current Stack vs Spec

| Area | Spec | Current | Notes |
|------|------|---------|--------|
| **Frontend** | React 18, TypeScript, Vite | ✅ Same | |
| **Styling** | Tailwind CSS | Custom CSS (vars) | Tailwind can be added later |
| **Routing** | Wouter | React Router | Same behavior, different library |
| **State** | TanStack Query | fetch + useState | Query would improve caching |
| **UI** | Shadcn/ui patterns | Custom components | Can adopt Shadcn later |
| **Backend** | Node, Express, TypeScript | ✅ Same | |
| **Database** | PostgreSQL, Drizzle ORM | PostgreSQL, raw `pg` | Drizzle optional for migrations |
| **Auth** | Session + HTTP-only cookies | JWT (Bearer) | Session/cookies possible later |
| **Real-time** | /ws (clients), /iot (devices) | Single /ws, REST /api/iot/attendance | Separate IoT channel possible |
| **Validation** | 7-second RFID+proximity window | Configurable (env) | Default set to 7s |

---

## Database (Current vs Spec)

**Current tables:** `users`, `rfid_cards`, `schedules`, `class_sessions`, `attendance_events`

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

---

## Optional / Future

- Session-based auth with HTTP-only cookies
- Tailwind CSS + Shadcn/ui
- TanStack Query for server state
- Drizzle ORM and extra tables (Classrooms, Subjects, Enrollments, Computers, IoT Devices, Email Notifications)
- Separate WebSocket channel for IoT devices
- Automatic session creation from academic calendar
- Email notifications to guardians
- Rate limiting, Helmet
