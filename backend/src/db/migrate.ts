import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf-8');
  await pool.query(sql);
  const guardianPath = path.join(__dirname, 'schema-guardian-email.sql');
  if (fs.existsSync(guardianPath)) {
    await pool.query(fs.readFileSync(guardianPath, 'utf-8'));
  }
  const v2Path = path.join(__dirname, 'schema-v2.sql');
  if (fs.existsSync(v2Path)) {
    await pool.query(fs.readFileSync(v2Path, 'utf-8'));
  }
  const iotHealthPath = path.join(__dirname, 'schema-iot-health.sql');
  if (fs.existsSync(iotHealthPath)) {
    await pool.query(fs.readFileSync(iotHealthPath, 'utf-8'));
  }
  const auditPath = path.join(__dirname, 'schema-audit.sql');
  if (fs.existsSync(auditPath)) {
    await pool.query(fs.readFileSync(auditPath, 'utf-8'));
  }
  const optionalPath = path.join(__dirname, 'schema-optional-tables.sql');
  if (fs.existsSync(optionalPath)) {
    await pool.query(fs.readFileSync(optionalPath, 'utf-8'));
  }
  const classroomsFkPath = path.join(__dirname, 'schema-classrooms-subjects-fk.sql');
  if (fs.existsSync(classroomsFkPath)) {
    await pool.query(fs.readFileSync(classroomsFkPath, 'utf-8'));
  }
  const labComputersPath = path.join(__dirname, 'schema-lab-computers.sql');
  if (fs.existsSync(labComputersPath)) {
    await pool.query(fs.readFileSync(labComputersPath, 'utf-8'));
  }
  const lifecyclePath = path.join(__dirname, 'schema-session-lifecycle.sql');
  if (fs.existsSync(lifecyclePath)) {
    await pool.query(fs.readFileSync(lifecyclePath, 'utf-8'));
  }
  console.log('Migration completed.');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
