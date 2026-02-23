-- IoT device health: last seen timestamp (updated on attendance/heartbeat)
ALTER TABLE iot_devices ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
