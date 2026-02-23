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
  /** Number of days ahead to create sessions in cron (1 = today only). Max 31. */
  SESSION_CREATE_DAYS: Math.min(31, Math.max(1, parseInt(process.env.SESSION_CREATE_DAYS ?? '1', 10))),
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
  /** Require registered device_id + API key for POST /api/iot/attendance. Set to "1" or "true" for world-class hardening. */
  IOT_REQUIRE_DEVICE_AUTH: /^(1|true|yes)$/i.test(process.env.IOT_REQUIRE_DEVICE_AUTH ?? ''),
  /** Delete audit_log entries older than this many days (0 = disable). Default 365. */
  AUDIT_RETENTION_DAYS: Math.max(0, parseInt(process.env.AUDIT_RETENTION_DAYS ?? '365', 10)),
  /** OIDC SSO: issuer URL (e.g. https://idp.example.com/realms/main). If set, SSO routes are enabled. */
  OIDC_ISSUER: process.env.OIDC_ISSUER ?? '',
  OIDC_CLIENT_ID: process.env.OIDC_CLIENT_ID ?? '',
  OIDC_CLIENT_SECRET: process.env.OIDC_CLIENT_SECRET ?? '',
  OIDC_REDIRECT_URI: process.env.OIDC_REDIRECT_URI ?? '',
  OIDC_SCOPES: process.env.OIDC_SCOPES ?? 'openid profile email',
  /** If 1/true, create user on first SSO login when email not found (default: only existing users). */
  OIDC_CREATE_USER: /^(1|true|yes)$/i.test(process.env.OIDC_CREATE_USER ?? ''),
  /** Base URL of the frontend app for password reset links (e.g. https://presence.example.com). Required for forgot-password email. */
  PASSWORD_RESET_APP_URL: process.env.PASSWORD_RESET_APP_URL ?? process.env.CORS_ORIGIN?.split(',')[0]?.trim() ?? '',
};
