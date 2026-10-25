import { env } from "./config"; // loads and checks .env. Must stay the first import.
import express from "express";
import type { NextFunction, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { pinoHttp } from "pino-http";
import authRoutes from "./routes/authRoutes";
import urlRoutes from "./routes/urlRoutes";
import { prisma } from "./lib/prisma";
import { logger } from "./lib/logger";
import { getUrlByCode } from "./lib/urlCache";
import { recordClick, looksLikeBot } from "./utils/analytics";
import { startCleanupJob } from "./jobs/cleanupExpired";
import { rateLimit } from "./middleware/rateLimit";
import { startClickPipeline, shutdownClickPipeline } from "./lib/clickQueue";

const app = express();

// Behind a proxy (Render, Nginx...) the real visitor IP is in a header.
// Without this, every visitor looks like the same IP and shares one rate limit.
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.use(helmet());
app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === "/health" } }));

// CORS: only our own frontend(s) may call the API from a browser.
// CLIENT_URL can hold several origins separated by commas.
const allowedOrigins = (process.env.CLIENT_URL ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
app.use(cors({ origin: allowedOrigins, credentials: true }));

app.use(express.json({ limit: "10kb" })); // reject huge request bodies
app.use(cookieParser());

app.use("/api", (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

app.get("/health", (_req, res) => res.json({ status: "ok" }));

// ---- Rate limits ----
app.use("/api", rateLimit({ name: "api", windowSeconds: 60, max: 100 }));
app.use("/api/auth/login", rateLimit({ name: "login", windowSeconds: 15 * 60, max: 10 }));
app.use("/api/auth/register", rateLimit({ name: "register", windowSeconds: 60 * 60, max: 10 }));
app.post("/api/urls", rateLimit({ name: "create", windowSeconds: 60, max: 20 }));

// ---- API routes ----
app.use("/api/auth", authRoutes);
app.use("/api/urls", urlRoutes);

// Unknown API path → JSON 404
app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));

// What should browsers and CDNs do with a redirect? Returns null = "use the status code's default".
function redirectCacheControl(expiresAt: string | null): string | null {
  const configuredBrowser = env.REDIRECT_BROWSER_CACHE_SECONDS;
  const configuredShared = env.REDIRECT_CDN_CACHE_SECONDS;
  if (configuredBrowser <= 0 && configuredShared <= 0) return null;

  let browser = configuredBrowser;
  let shared = configuredShared;

  if (expiresAt) {
    // A cache must never keep a redirect longer than the link itself lives
    const secondsLeft = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
    browser = Math.min(browser, secondsLeft);
    shared = Math.min(shared, secondsLeft);
  }

  if (browser <= 0 && shared <= 0) return "no-store";

  const parts = [shared > 0 ? "public" : "private", `max-age=${browser}`];
  if (shared > 0) parts.push(`s-maxage=${shared}`);
  return parts.join(", ");
}

// ---- Redirect (must come after the API routes) ----
app.get("/:shortCode", async (req, res) => {
  const { url, source } = await getUrlByCode(req.params.shortCode);

  res.set("X-Cache", source === "cache" ? "HIT" : "MISS"); // this is OUR Redis cache

  if (!url) {
    res.set("Cache-Control", "no-store"); // never let anyone remember "not found"
    return res.status(404).send("Short link not found");
  }

  if (url.expiresAt && new Date(url.expiresAt).getTime() <= Date.now()) {
    res.set("Cache-Control", "no-store");
    return res.status(410).send("This link has expired");
  }

  const userAgent = req.get("user-agent") ?? "";
  if (req.method !== "HEAD" && !looksLikeBot(userAgent)) {
    recordClick(url.id, userAgent, req.get("referer"));
  }

  const cacheControl = redirectCacheControl(url.expiresAt);
  if (cacheControl) res.set("Cache-Control", cacheControl);

  res.redirect(env.REDIRECT_STATUS, url.originalUrl);
});

// ---- Error handler (must be LAST, and must have 4 arguments) ----
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON" });
  }
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ error: "Request is too large" });
  }

  // Log the real error for us, but send the user a safe message
  logger.error({ err, path: req.path }, "Unhandled error");
  res.status(500).json({ error: "Something went wrong" });
});

let server: ReturnType<typeof app.listen> | undefined;

async function start() {
  await prisma.$connect();
  logger.info("Postgres connected");

  await startClickPipeline();

  const port = Number(process.env.PORT) || 5000;
  server = app.listen(port, () => logger.info(`Server running on port ${port}`));
  startCleanupJob();
}

async function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down");
  server?.close(); // stop taking new requests
  await shutdownClickPipeline(); // save clicks that are still waiting
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

start().catch((err) => {
  logger.fatal({ err }, "Failed to start");
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled promise rejection");
});