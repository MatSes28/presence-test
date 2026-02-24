#!/usr/bin/env node
/**
 * Create the first admin user (after deploy + migrations).
 * Usage:
 *   RAILWAY_URL=https://your-app.railway.app npm run create-admin
 *   node scripts/create-first-admin.js https://your-app.railway.app
 *   npm run create-admin -- https://your-app.railway.app
 */
const baseUrl = process.env.RAILWAY_URL || process.argv[2];
const email = process.env.ADMIN_EMAIL || 'admin@school.com';
const password = process.env.ADMIN_PASSWORD || 'admin123';
const fullName = process.env.ADMIN_FULL_NAME || 'Admin';

if (!baseUrl) {
  console.error('Usage: RAILWAY_URL=https://your-app.railway.app npm run create-admin');
  console.error('   or: node scripts/create-first-admin.js https://your-app.railway.app');
  process.exit(1);
}

const url = baseUrl.replace(/\/$/, '') + '/api/auth/register';

(async () => {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, full_name: fullName, role: 'admin' }),
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
    if (!res.ok) {
      console.error('Failed to create admin:', res.status, data);
      process.exit(1);
    }
    console.log('Admin created. Log in at:', baseUrl, 'with', email, '/', password);
  } catch (err) {
    console.error('Network error:', err.message);
    process.exit(1);
  }
})();
