import 'dotenv/config';

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: parseInt(process.env.PORT ?? '3001', 10),
  DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/clirdec',
  JWT_SECRET: process.env.JWT_SECRET ?? 'change-me-in-production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '7d',
  VALIDATION_WINDOW_MS: parseInt(process.env.VALIDATION_WINDOW_MS ?? '10000', 10), // 10s for RFID + proximity
  PROXIMITY_MAX_CM: parseInt(process.env.PROXIMITY_MAX_CM ?? '80', 10),
};
