-- Guardian contact + email notification audit (optional migration)
-- Run after schema.sql

ALTER TABLE users ADD COLUMN IF NOT EXISTS guardian_email VARCHAR(255);

CREATE TABLE IF NOT EXISTS email_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES class_sessions(id) ON DELETE SET NULL,
  kind VARCHAR(50) NOT NULL,
  recipient VARCHAR(255) NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  status VARCHAR(20) NOT NULL DEFAULT 'sent',
  payload JSONB
);

CREATE INDEX IF NOT EXISTS idx_email_notifications_user ON email_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_email_notifications_sent ON email_notifications(sent_at);
