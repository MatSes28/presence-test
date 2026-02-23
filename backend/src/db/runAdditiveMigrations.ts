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
  } finally {
    client.release();
  }
}
