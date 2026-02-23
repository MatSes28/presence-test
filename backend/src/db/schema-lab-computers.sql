-- Lab computers and assignments (optional feature)
CREATE TABLE IF NOT EXISTS computers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  room VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_computers_room ON computers(room);

CREATE TABLE IF NOT EXISTS computer_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  computer_id UUID NOT NULL REFERENCES computers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  released_at TIMESTAMPTZ,
  UNIQUE(computer_id)
);
CREATE INDEX IF NOT EXISTS idx_computer_assignments_user ON computer_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_computer_assignments_computer ON computer_assignments(computer_id);
