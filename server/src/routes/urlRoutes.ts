import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { generateCode } from "../utils/generateCode";
import { isValidHttpUrl } from "../utils/validateUrl";
import { normalizeAlias, validateAlias } from "../utils/alias";
import { optionalAuth, requireAuth } from "../middleware/auth";
import { parseBody, createUrlSchema } from "../schemas";
import { cacheUrl, invalidateUrl } from "../lib/urlCache";


const router = Router();
const DAY_MS = 24 * 60 * 60 * 1000;
const warmCache = (doc: { id: number; shortCode: string; originalUrl: string; expiresAt: Date | null }) =>
  cacheUrl(doc.shortCode, {
    id: doc.id,
    originalUrl: doc.originalUrl,
    expiresAt: doc.expiresAt?.toISOString() ?? null,
  });

function toDto(u: {
  id: number;
  originalUrl: string;
  shortCode: string;
  clicks: number;
  createdAt: Date;
  expiresAt: Date | null;
}) {
  return {
    id: u.id,
    originalUrl: u.originalUrl,
    shortCode: u.shortCode,
    shortUrl: `${process.env.BASE_URL}/${u.shortCode}`,
    clicks: u.clicks,
    createdAt: u.createdAt,
    expiresAt: u.expiresAt,
  };
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

// POST /api/urls
router.post("/", optionalAuth, async (req, res) => {
  const data = parseBody(createUrlSchema, req.body, res);
  if (!data) return;
  const { originalUrl } = data;

  const userId: number | null = res.locals.userId ?? null;

  // ---- Optional expiration ----
  let expiresAt: Date | null = null;
  if (data.expiresAt) {
    const parsed = new Date(data.expiresAt);
    const now = Date.now();

    if (isNaN(parsed.getTime()) || parsed.getTime() <= now + 60_000) {
      return res.status(400).json({ error: "Expiration must be a date in the future" });
    }
    if (parsed.getTime() > now + 365 * DAY_MS) {
      return res.status(400).json({ error: "Expiration can be at most 1 year away" });
    }
    expiresAt = parsed;
  }

  // ---- Custom alias: reject on collision ----
  if (data.alias) {
    if (userId === null) {
      return res.status(401).json({ error: "Please log in to use a custom alias" });
    }

    const alias = normalizeAlias(data.alias);
    const problem = validateAlias(alias);
    if (problem) {
      return res.status(400).json({ error: problem });
    }

    try {
      const doc = await prisma.url.create({
        data: { originalUrl, shortCode: alias, userId, expiresAt },
      });
      await warmCache(doc);
      return res.status(201).json(toDto(doc));
    } catch (err) {
      if (isUniqueViolation(err)) {
        return res.status(409).json({ error: "That alias is already taken" });
      }
      throw err;
    }
  }

  // ---- Random code: retry on collision ----
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const doc = await prisma.url.create({
        data: { originalUrl, shortCode: generateCode(), userId, expiresAt },
      });
      await warmCache(doc);
      return res.status(201).json(toDto(doc));
    } catch (err) {
      if (isUniqueViolation(err)) continue;
      throw err;
    }
  }

  res.status(500).json({ error: "Could not generate a unique code. Try again." });
});

// GET /api/urls?search=&status=&page=&limit=
router.get("/", requireAuth, async (req, res) => {
  const userId: number = res.locals.userId;

  const page = Math.max(1, parseInt(String(req.query.page)) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit)) || 10));
  const search =
    typeof req.query.search === "string" ? req.query.search.trim().slice(0, 100) : "";
  const status =
    req.query.status === "active" || req.query.status === "expired" ? req.query.status : "all";

  const now = new Date();
  const and: Prisma.UrlWhereInput[] = [];

  if (search) {
    and.push({
      OR: [
        { originalUrl: { contains: search, mode: "insensitive" } },
        { shortCode: { contains: search, mode: "insensitive" } },
      ],
    });
  }
  if (status === "active") {
    and.push({ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] });
  } else if (status === "expired") {
    and.push({ expiresAt: { lte: now } });
  }

  const where: Prisma.UrlWhereInput = { userId, ...(and.length > 0 ? { AND: and } : {}) };

  const [items, total] = await Promise.all([
    prisma.url.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.url.count({ where }),
  ]);

  res.json({
    items: items.map(toDto),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
});

// DELETE /api/urls/:id
router.delete("/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Invalid id" });
  }

  // Find it (only if it's mine) so we know its code
  const url = await prisma.url.findFirst({
    where: { id, userId: res.locals.userId },
    select: { shortCode: true },
  });
  if (!url) {
    return res.status(404).json({ error: "URL not found" });
  }

  await prisma.url.deleteMany({ where: { id, userId: res.locals.userId } });
  await invalidateUrl(url.shortCode); // throw away the note

  res.json({ ok: true });
});

type Dimension = "referrer" | "browser" | "os" | "device";

async function breakdown(urlId: number, since: Date, dim: Dimension) {
  // dim is one of four fixed strings from our code, never user input
  const col = Prisma.raw(`"${dim}"`);
  return prisma.$queryRaw<{ name: string; count: number }[]>`
    SELECT ${col} AS name, COUNT(*)::int AS "count"
    FROM "Click"
    WHERE "urlId" = ${urlId} AND "clickedAt" >= ${since}
    GROUP BY ${col}
    ORDER BY "count" DESC
    LIMIT 10`;
}

// GET /api/urls/:id/stats?days=30
router.get("/:id/stats", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Invalid id" });
  }

  // Ownership check: only the owner can see analytics
  const url = await prisma.url.findFirst({
    where: { id, userId: res.locals.userId },
  });
  if (!url) {
    return res.status(404).json({ error: "URL not found" });
  }

  const requested = parseInt(String(req.query.days));
  const days = [7, 30, 90].includes(requested) ? requested : 30;

  // Start of the day (UTC), `days - 1` days ago
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - (days - 1));

  const [dailyRows, referrers, browsers, os, devices, recent] = await Promise.all([
    prisma.$queryRaw<{ day: string; count: number }[]>`
      SELECT to_char("clickedAt", 'YYYY-MM-DD') AS day, COUNT(*)::int AS "count"
      FROM "Click"
      WHERE "urlId" = ${id} AND "clickedAt" >= ${since}
      GROUP BY 1
      ORDER BY 1`,
    breakdown(id, since, "referrer"),
    breakdown(id, since, "browser"),
    breakdown(id, since, "os"),
    breakdown(id, since, "device"),
    prisma.click.findMany({
      where: { urlId: id },
      orderBy: { clickedAt: "desc" },
      take: 10,
    }),
  ]);

  // Fill in days with zero clicks so the chart has no gaps
  const counts = new Map(dailyRows.map((r) => [r.day, r.count]));
  const daily = Array.from({ length: days }, (_, i) => {
    const d = new Date(since);
    d.setUTCDate(since.getUTCDate() + i);
    const date = d.toISOString().slice(0, 10);
    return { date, clicks: counts.get(date) ?? 0 };
  });

  res.json({
    url: toDto(url),
    days,
    totalClicks: url.clicks,
    periodClicks: daily.reduce((sum, d) => sum + d.clicks, 0),
    daily,
    referrers,
    browsers,
    os,
    devices,
    recent: recent.map((c) => ({ ...c, id: c.id.toString() })),
  });
});

export default router;