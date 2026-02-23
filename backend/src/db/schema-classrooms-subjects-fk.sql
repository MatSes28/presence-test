-- Optional: link schedules to classrooms and subjects (run after schema-optional-tables.sql)
-- Keeps backward compatibility: subject and room remain as text; FKs are optional.

ALTER TABLE schedules ADD COLUMN IF NOT EXISTS classroom_id UUID REFERENCES classrooms(id) ON DELETE SET NULL;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_schedules_classroom ON schedules(classroom_id);
CREATE INDEX IF NOT EXISTS idx_schedules_subject ON schedules(subject_id);
