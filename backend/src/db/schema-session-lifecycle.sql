-- Session lifecycle: scheduled -> active -> ended; attendance_status 'absent' for auto-marked absences
-- Run after schema.sql / schema-v2.sql

-- Allow session status 'scheduled' (created by cron; per-minute job sets to 'active' when start time reached)
ALTER TABLE class_sessions DROP CONSTRAINT IF EXISTS class_sessions_status_check;
ALTER TABLE class_sessions ADD CONSTRAINT class_sessions_status_check CHECK (status IN ('scheduled', 'active', 'ended'));

-- Allow attendance_status 'absent' (system sets when session ends and student had no tap)
ALTER TABLE attendance_events DROP CONSTRAINT IF EXISTS attendance_events_attendance_status_check;
ALTER TABLE attendance_events ADD CONSTRAINT attendance_events_attendance_status_check CHECK (attendance_status IN ('present', 'late', 'absent'));
