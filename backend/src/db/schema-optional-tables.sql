-- Optional richer data model (Classrooms, Subjects). Not required for core attendance.
-- Run manually or add to migrate.ts if you want to use these tables; schedules currently use room/subject as text.

CREATE TABLE IF NOT EXISTS classrooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  capacity INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Optional: add columns to schedules to reference these (run only if you want to migrate from text to FKs):
-- ALTER TABLE schedules ADD COLUMN IF NOT EXISTS classroom_id UUID REFERENCES classrooms(id);
-- ALTER TABLE schedules ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES subjects(id);
