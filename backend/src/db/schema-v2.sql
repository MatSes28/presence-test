-- CLIRDEC: PRESENCE — Spec alignment (attendance status, discrepancies, behavior, IoT devices)
-- Run after schema.sql (or with existing DB)

-- Attendance status: present (within grace), late (after grace but within 60% of session)
ALTER TABLE attendance_events ADD COLUMN IF NOT EXISTS attendance_status VARCHAR(20) DEFAULT 'present' CHECK (attendance_status IN ('present', 'late'));

-- Discrepancy flags (ghost attendance, sensor mismatch, multiple taps, invalid session tap)
CREATE TABLE IF NOT EXISTS discrepancy_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES class_sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  flag_type VARCHAR(50) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_discrepancy_flags_session ON discrepancy_flags(session_id);
CREATE INDEX IF NOT EXISTS idx_discrepancy_flags_created ON discrepancy_flags(created_at);

-- Configurable behavior thresholds (admin)
CREATE TABLE IF NOT EXISTS behavior_config (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO behavior_config (key, value) VALUES
  ('grace_period_minutes', '10'::jsonb),
  ('late_cutoff_pct', '60'::jsonb),
  ('threshold_excellent_min', '90'::jsonb),
  ('threshold_good_min', '80'::jsonb),
  ('threshold_warning_min', '70'::jsonb),
  ('critical_below', '70'::jsonb),
  ('alert_cooldown_days', '7'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- IoT devices (API key validation)
CREATE TABLE IF NOT EXISTS iot_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id VARCHAR(100) UNIQUE NOT NULL,
  api_key_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_iot_devices_device_id ON iot_devices(device_id);
