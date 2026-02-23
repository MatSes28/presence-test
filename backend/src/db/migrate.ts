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
    const guardianSql = fs.readFileSync(guardianPath, 'utf-8');
    await pool.query(guardianSql);
  }
  console.log('Migration completed.');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
