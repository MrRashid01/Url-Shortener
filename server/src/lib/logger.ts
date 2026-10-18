import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  // Never write secrets into logs
  redact: ["req.headers.cookie", "req.headers.authorization", "res.headers['set-cookie']"],
  // Pretty colors in development, plain JSON in production
  transport: process.env.NODE_ENV === "production" ? undefined : { target: "pino-pretty" },
});