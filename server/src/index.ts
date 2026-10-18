import "./config"; // loads .env and checks it. Must stay first.
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

// ---- Redirect (must come after the API routes) ----
app.get("/:shortCode", async (req, res) => {
  const { url, source } = await getUrlByCode(req.params.shortCode);

  res.set("X-Cache", source === "cache" ? "HIT" : "MISS");

  if (!url) {
    return res.status(404).send("Short link not found");
  }

  if (url.expiresAt && new Date(url.expiresAt).getTime() <= Date.now()) {
    return res.status(410).send("This link has expired");
  }

  const userAgent = req.get("user-agent") ?? "";
  if (req.method !== "HEAD" && !looksLikeBot(userAgent)) {
    recordClick(url.id, userAgent, req.get("referer"));
  }

  res.redirect(302, url.originalUrl);
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

async function start() {
  await prisma.$connect();
  logger.info("Postgres connected");

  const port = Number(process.env.PORT) || 5000;
  app.listen(port, () => logger.info(`Server running on port ${port}`));
  startCleanupJob();
}

start().catch((err) => {
  logger.fatal({ err }, "Failed to start");
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled promise rejection");
});