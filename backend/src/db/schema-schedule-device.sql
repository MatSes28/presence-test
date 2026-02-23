-- Link schedule to IoT device (which device is in this room). Optional.
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS device_id VARCHAR(100);
CREATE INDEX IF NOT EXISTS idx_schedules_device_id ON schedules(device_id);
