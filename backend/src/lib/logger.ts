/**
 * Structured logger for world-class observability.
 * In production (NODE_ENV=production) logs JSON; in development logs readable text.
 */
const isProd = process.env.NODE_ENV === 'production';

function formatMessage(level: string, msg: string, meta?: Record<string, unknown>) {
  if (isProd) {
    return JSON.stringify({
      time: new Date().toISOString(),
      level,
      msg,
      ...meta,
    });
  }
  const metaStr = meta && Object.keys(meta).length > 0 ? ' ' + JSON.stringify(meta) : '';
  return `[${new Date().toISOString()}] ${level.toUpperCase()} ${msg}${metaStr}`;
}

export const logger = {
  info(msg: string, meta?: Record<string, unknown>) {
    console.log(formatMessage('info', msg, meta));
  },
  warn(msg: string, meta?: Record<string, unknown>) {
    console.warn(formatMessage('warn', msg, meta));
  },
  error(msg: string, meta?: Record<string, unknown>) {
    console.error(formatMessage('error', msg, meta));
  },
};
