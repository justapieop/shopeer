import type { LoggerOptions } from "pino";

/** Redact structured secrets before logs reach any destination or transport. */
export const logRedaction = {
  paths: [
    'req.headers.cookie',
    'req.headers.authorization',
    'res.headers["set-cookie"]',
    'headers.cookie',
    'headers.authorization',
    'headers["set-cookie"]',
    'req.cookies',
    'req.signedCookies',
    'req.body.password',
    'body.password',
    'password',
  ],
  censor: "[Redacted]",
} satisfies NonNullable<LoggerOptions["redact"]>;
