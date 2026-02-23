-- CLIRDEC: Presence-Proximity and RFID-Enabled Smart Entry
-- ERD-based schema for attendance, sessions, and users

-- Users: admin, faculty, student
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'faculty', 'student')),
  full_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RFID cards linked to users (students)
CREATE TABLE IF NOT EXISTS rfid_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_uid VARCHAR(64) UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Schedules: recurring class slots (subject, room, time, faculty)
CREATE TABLE IF NOT EXISTS schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject VARCHAR(255) NOT NULL,
  room VARCHAR(100) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  faculty_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Class sessions: active instance of a schedule (started/ended)
CREATE TABLE IF NOT EXISTS class_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE RESTRICT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Attendance events: validated RFID + proximity events
CREATE TABLE IF NOT EXISTS attendance_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES class_sessions(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  rfid_uid VARCHAR(64) NOT NULL,
  proximity_valid BOOLEAN NOT NULL,
  distance_cm INTEGER,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status VARCHAR(20) NOT NULL DEFAULT 'recorded' CHECK (status IN ('recorded', 'rejected', 'duplicate')),
  UNIQUE(session_id, user_id)
);

-- Indexes for queries
CREATE INDEX IF NOT EXISTS idx_attendance_events_session ON attendance_events(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_events_user ON attendance_events(user_id);
CREATE INDEX IF NOT EXISTS idx_class_sessions_schedule ON class_sessions(schedule_id);
CREATE INDEX IF NOT EXISTS idx_class_sessions_status ON class_sessions(status);
CREATE INDEX IF NOT EXISTS idx_rfid_cards_uid ON rfid_cards(card_uid);
