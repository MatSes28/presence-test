import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const from = path.join(root, 'frontend', 'dist');
const to = path.join(root, 'backend', 'public');

if (!fs.existsSync(from)) {
  console.warn('Frontend build not found at', from);
  process.exit(0);
}
if (!fs.existsSync(to)) fs.mkdirSync(to, { recursive: true });
const entries = fs.readdirSync(from, { withFileTypes: true });
for (const e of entries) {
  const src = path.join(from, e.name);
  const dest = path.join(to, e.name);
  if (e.isDirectory()) {
    fs.cpSync(src, dest, { recursive: true });
  } else {
    fs.copyFileSync(src, dest);
  }
}
console.log('Copied frontend build to backend/public');
