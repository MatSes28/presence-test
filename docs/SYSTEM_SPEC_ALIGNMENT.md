# CLIRDEC: PRESENCE — Spec Alignment

Alignment with the full system overview (schedule-based validation, Present/Late/Absent, discrepancy detection, behavior monitoring, real-time dashboard).

---

## ✅ Implemented

### Attendance status (schedule-based)
- **Present** — Tap within grace period (configurable, default 10 min) after session start.
- **Late** — Tap after grace but within 60% of session duration (configurable).
- **Invalid** — Tap after 60% of session → rejected and flagged as discrepancy.
- Status stored in `attendance_events.attendance_status`; dashboard and reports show Present/Late.

### Discrepancy detection
- **discrepancy_flags** table: session_id, user_id, flag_type, description, created_at.
- Flag types: `sensor_mismatch` (RFID without valid proximity), `multiple_taps` (duplicate), `invalid_session_tap` (session not active or tap too late).
- **GET /api/discrepancy-flags** — Admin: all flags; Faculty: by session (own sessions). Optional `?sessionId=`.

### Real-time dashboard
- **Live feed** — WebSocket shows Present/Late per tap.
- **Session stats** — **GET /api/attendance/session/:sessionId/stats** → presentCount, lateCount, totalRecorded.
- **Attendance report** — Shows Present/Late counts and Status column (Present/Late) per row.

### Behavior monitoring
- **Formula:** Attendance rate = (Present + 0.5 × Late) / Total sessions × 100.
- **Levels:** Excellent (≥90%), Good (≥80%), Warning (≥70%), Critical (&lt;70%). Configurable in **behavior_config** table.
- **GET /api/behavior/config** (admin) — Thresholds and grace/cooldown.
- **GET /api/behavior/student/:userId** — Summary (totalSessions, present, late, absent, attendanceRate, level). Optional `?from=&to=&scheduleId=`.
- **GET /api/behavior/at-risk** — List of students with critical level (dashboard “At risk” section).
- **7-day alert cooldown** — `shouldSendBehaviorAlert()` and email_notifications support; real email send is optional (SendGrid stub).

### Security & quality
- JWT, bcrypt, Helmet, rate limiting, Zod validation, role-based routes (Admin/Faculty).
- No biometrics, no GPS, no browsing block; attendance and physical validation only.

### Database
- **attendance_events** — attendance_status (present/late).
- **discrepancy_flags** — Flags per session/user.
- **behavior_config** — grace_period_minutes, late_cutoff_pct, threshold_*, alert_cooldown_days.
- **iot_devices** — Table present for future API key validation (optional).

---

## Optional / not implemented

- **Classrooms / Subjects** as separate entities (currently subject/room on schedules).
- **Lab computer assignment** (Computers, Computer_Assignments tables and UI).
- **IoT device API key** enforcement (table ready; validation can be added).
- **Prisma ORM** (using parameterized `pg`; no SQL injection).
- **SendGrid** integration for behavior/parent emails (stub in notificationService).

---

## Run migrations

After pull, run:

```bash
npm run db:migrate
```

This applies `schema.sql`, `schema-guardian-email.sql`, and `schema-v2.sql` (attendance_status, discrepancy_flags, behavior_config, iot_devices).
