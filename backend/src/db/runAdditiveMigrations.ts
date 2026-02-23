/**
 * Run additive migrations on startup so the app works even if `npm run db:migrate`
 * was not run (e.g. fresh deploy). Idempotent: safe to run every time.
 */
import { pool } from './pool.js';

export async function runAdditiveMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    // schema-iot-health: last_seen_at on iot_devices (table created by schema-v2)
    try {
      await client.query(`
        ALTER TABLE iot_devices ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ
      `);
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err?.code !== '42P01') throw e; // 42P01 = undefined_table; ignore if iot_devices missing
    }

    // schema-audit: audit_log table
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
        actor_email VARCHAR(255),
        action VARCHAR(100) NOT NULL,
        resource_type VARCHAR(50),
        resource_id VARCHAR(255),
        details JSONB,
        ip_address VARCHAR(45),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON audit_log(resource_type, resource_id)`);

    // Optional: classrooms, subjects (for schedule FK and API)
    await client.query(`
      CREATE TABLE IF NOT EXISTS classrooms (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL UNIQUE,
        capacity INTEGER,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS subjects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code VARCHAR(50) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    try {
      await client.query(`ALTER TABLE schedules ADD COLUMN IF NOT EXISTS classroom_id UUID REFERENCES classrooms(id) ON DELETE SET NULL`);
      await client.query(`ALTER TABLE schedules ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_schedules_classroom ON schedules(classroom_id)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_schedules_subject ON schedules(subject_id)`);
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err?.code !== '42P01') throw e;
    }

    // Optional: lab computers
    await client.query(`
      CREATE TABLE IF NOT EXISTS computers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        room VARCHAR(100),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_computers_room ON computers(room)`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS computer_assignments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        computer_id UUID NOT NULL REFERENCES computers(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        released_at TIMESTAMPTZ,
        UNIQUE(computer_id)
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_computer_assignments_user ON computer_assignments(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_computer_assignments_computer ON computer_assignments(computer_id)`);

    // Session lifecycle: scheduled -> active -> ended; attendance_status 'absent'
    try {
      await client.query(`ALTER TABLE class_sessions DROP CONSTRAINT IF EXISTS class_sessions_status_check`);
      await client.query(`ALTER TABLE class_sessions ADD CONSTRAINT class_sessions_status_check CHECK (status IN ('scheduled', 'active', 'ended'))`);
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err?.code !== '42P01') throw e;
    }
    try {
      await client.query(`ALTER TABLE attendance_events DROP CONSTRAINT IF EXISTS attendance_events_attendance_status_check`);
      await client.query(`ALTER TABLE attendance_events ADD CONSTRAINT attendance_events_attendance_status_check CHECK (attendance_status IN ('present', 'late', 'absent'))`);
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err?.code !== '42P01') throw e;
    }
  } finally {
    client.release();
  }
}
