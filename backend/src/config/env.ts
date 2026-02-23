import 'dotenv/config';

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: parseInt(process.env.PORT ?? '3001', 10),
  DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/clirdec',
  JWT_SECRET: process.env.JWT_SECRET ?? 'change-me-in-production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '7d',
  VALIDATION_WINDOW_MS: parseInt(process.env.VALIDATION_WINDOW_MS ?? '7000', 10), // 7s RFID+proximity correlation (spec)
  PROXIMITY_MAX_CM: parseInt(process.env.PROXIMITY_MAX_CM ?? '80', 10),
  GRACE_PERIOD_MINUTES: parseInt(process.env.GRACE_PERIOD_MINUTES ?? '10', 10),
  LATE_CUTOFF_PCT: parseInt(process.env.LATE_CUTOFF_PCT ?? '60', 10),
  /** Cron expression for auto session creation (default: 6:00 AM daily). Set to empty to disable. */
  AUTO_SESSION_CRON: process.env.AUTO_SESSION_CRON ?? '0 6 * * *',
  /** Resend API key for guardian emails. If unset, notifications are logged only. */
  RESEND_API_KEY: process.env.RESEND_API_KEY ?? '',
  /** From address for transactional email (e.g. notifications@yourdomain.com). Required when RESEND_API_KEY is set. */
  EMAIL_FROM: process.env.EMAIL_FROM ?? '',
  /** Session cookie name for HTTP-only JWT. */
  SESSION_COOKIE_NAME: process.env.SESSION_COOKIE_NAME ?? 'clirdec_session',
  /** Allowed CORS origins (comma-separated). In production set to your frontend URL(s). Empty = allow any (dev). */
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? '',
  /** In production, require HTTPS (reject or redirect). Set to "1" or "true" to enable. */
  REQUIRE_HTTPS: /^(1|true|yes)$/i.test(process.env.REQUIRE_HTTPS ?? ''),
};
