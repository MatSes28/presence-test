import { pool } from '../db/pool.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export interface IoTDeviceRow {
  id: string;
  device_id: string;
  name: string | null;
  is_active: boolean;
  last_seen_at: string | null;
  created_at: string;
}

/** Update last_seen_at for a device (call on attendance/heartbeat). */
export async function touchDeviceLastSeen(deviceId: string): Promise<void> {
  await pool.query(
    `UPDATE iot_devices SET last_seen_at = NOW() WHERE device_id = $1`,
    [deviceId]
  );
}

/** Verify device by device_id and API key (for world-class auth on attendance endpoint). */
export async function verifyDeviceAuth(deviceId: string, apiKey: string): Promise<boolean> {
  const r = await pool.query(
    `SELECT api_key_hash FROM iot_devices WHERE device_id = $1 AND is_active = true`,
    [deviceId]
  );
  if (r.rows.length === 0) return false;
  return bcrypt.compare(apiKey, r.rows[0].api_key_hash);
}

/** List all registered devices (no API key). */
export async function listDevices(): Promise<IoTDeviceRow[]> {
  const r = await pool.query(
    `SELECT id, device_id, name, is_active, last_seen_at, created_at
     FROM iot_devices ORDER BY created_at DESC`
  );
  return r.rows;
}

/** Create a device; returns the plain API key once (not stored). */
export async function createDevice(params: { device_id: string; name?: string }): Promise<{
  id: string;
  device_id: string;
  name: string | null;
  is_active: boolean;
  api_key: string;
  created_at: string;
}> {
  const apiKey = `clirdec_${crypto.randomBytes(24).toString('hex')}`;
  const apiKeyHash = await bcrypt.hash(apiKey, 10);
  const r = await pool.query(
    `INSERT INTO iot_devices (device_id, api_key_hash, name) VALUES ($1, $2, $3)
     RETURNING id, device_id, name, is_active, created_at`,
    [params.device_id, apiKeyHash, params.name ?? null]
  );
  const row = r.rows[0];
  return {
    id: row.id,
    device_id: row.device_id,
    name: row.name,
    is_active: row.is_active,
    api_key: apiKey,
    created_at: row.created_at,
  };
}

/** Update device name and/or is_active. */
export async function updateDevice(
  id: string,
  updates: { name?: string; is_active?: boolean }
): Promise<IoTDeviceRow | null> {
  const sets: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (updates.name !== undefined) {
    sets.push(`name = $${i++}`);
    values.push(updates.name);
  }
  if (updates.is_active !== undefined) {
    sets.push(`is_active = $${i++}`);
    values.push(updates.is_active);
  }
  if (sets.length === 0) {
    const r = await pool.query(
      `SELECT id, device_id, name, is_active, last_seen_at, created_at FROM iot_devices WHERE id = $1`,
      [id]
    );
    return r.rows[0] ?? null;
  }
  values.push(id);
  const r = await pool.query(
    `UPDATE iot_devices SET ${sets.join(', ')} WHERE id = $${i} RETURNING id, device_id, name, is_active, last_seen_at, created_at`,
    values
  );
  return r.rows[0] ?? null;
}

/** Delete a device. */
export async function deleteDevice(id: string): Promise<boolean> {
  const r = await pool.query('DELETE FROM iot_devices WHERE id = $1 RETURNING id', [id]);
  return r.rowCount !== null && r.rowCount > 0;
}
