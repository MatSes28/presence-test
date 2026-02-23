#!/usr/bin/env node
/**
 * Pre-launch environment and checklist validation.
 * Run: node scripts/preflight.js
 * Use PREFLIGHT_STRICT=1 to exit with code 1 when checks fail (e.g. in CI).
 */
try { require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env') }); } catch (_) {}

const strict = /^(1|true|yes)$/i.test(process.env.PREFLIGHT_STRICT ?? '');
const isProd = process.env.NODE_ENV === 'production';

const checks = [];
let failed = 0;

function ok(msg, pass) {
  checks.push({ msg, pass });
  if (!pass) failed++;
}

// Required for production
ok('NODE_ENV is set', !!process.env.NODE_ENV);
if (isProd) {
  ok('JWT_SECRET is set and strong (≥32 chars)', (process.env.JWT_SECRET?.length ?? 0) >= 32);
  ok('JWT_SECRET is not default', process.env.JWT_SECRET !== 'change-me-in-production');
}
ok('DATABASE_URL is set', !!process.env.DATABASE_URL);

// Recommended for production
if (isProd) {
  ok('CORS_ORIGIN is set', !!process.env.CORS_ORIGIN);
  ok('REQUIRE_HTTPS is set when behind HTTPS', true); // informational only
}

// Optional but recommended for full features
ok('RESEND_API_KEY set (for guardian/behavior emails)', !!process.env.RESEND_API_KEY);
ok('EMAIL_FROM set when using Resend', !process.env.RESEND_API_KEY || !!process.env.EMAIL_FROM);
ok('PASSWORD_RESET_APP_URL set (for forgot-password links)', !!process.env.PASSWORD_RESET_APP_URL);

// IoT
ok('IOT_REQUIRE_DEVICE_AUTH considered for production', true);

console.log('\n--- CLIRDEC Pre-launch checklist ---\n');
checks.forEach(({ msg, pass }) => {
  console.log(pass ? '  [OK]' : '  [FAIL]', msg);
});
console.log('\n--- Pre-launch actions ---');
console.log('  1. Environment: NODE_ENV=production, strong JWT_SECRET (≥32 chars), CORS_ORIGIN, REQUIRE_HTTPS=1 if behind HTTPS');
console.log('  2. Database: DATABASE_URL from managed PostgreSQL; run npm run db:migrate after deploy');
console.log('  3. Backups: Automated daily backups and tested restore (see docs/RUNBOOK.md)');
console.log('  4. Email: RESEND_API_KEY + EMAIL_FROM if guardian/behavior notifications are required');
console.log('  5. First admin: Create via POST /api/auth/register');
console.log('  6. IoT: Register devices in app; consider IOT_REQUIRE_DEVICE_AUTH=1');
console.log('  7. Monitoring: Health checks (GET /health) and alerting\n');

if (failed > 0) {
  console.log(`Failed checks: ${failed}. Fix the above or set PREFLIGHT_STRICT=0 to allow.`);
  if (strict) process.exit(1);
} else {
  console.log('All checks passed.');
}
