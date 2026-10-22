import { redis } from "./redis";
import { prisma } from "./prisma";

const ENABLED = process.env.CACHE_ENABLED !== "false";
const MAX_TTL_SECONDS = 60 * 60;
const NOT_FOUND_TTL_SECONDS = 60;
const NOT_FOUND = "none";

export type CachedUrl = {
  id: number;
  originalUrl: string;
  expiresAt: string | null;
};

const keyFor = (code: string) => `url:${code}`;

// Never keep a note longer than the link itself lives
function ttlFor(url: CachedUrl): number {
  let ttl = MAX_TTL_SECONDS;
  if (url.expiresAt) {
    const secondsLeft = Math.floor((new Date(url.expiresAt).getTime() - Date.now()) / 1000);
    ttl = Math.min(ttl, secondsLeft);
  }
  return ttl;
}

// Write a note into Redis (used on first read AND right after a link is created)
export async function cacheUrl(code: string, url: CachedUrl) {
  if (!ENABLED) return;
  try {
    const ttl = ttlFor(url);
    if (ttl > 0) {
      await redis.set(keyFor(code), JSON.stringify(url), "EX", ttl);
    }
  } catch (err) {
    console.error("Cache write failed:", err);
  }
}

export async function getUrlByCode(
  code: string
): Promise<{ url: CachedUrl | null; source: "cache" | "db" }> {
  if (ENABLED) {
    try {
      const cached = await redis.get(keyFor(code));
      if (cached === NOT_FOUND) return { url: null, source: "cache" };
      if (cached) return { url: JSON.parse(cached) as CachedUrl, source: "cache" };
    } catch (err) {
      console.error("Cache read failed, using database:", err);
    }
  }

  const row = await prisma.url.findUnique({
    where: { shortCode: code },
    select: { id: true, originalUrl: true, expiresAt: true },
  });

  const url: CachedUrl | null = row
    ? { id: row.id, originalUrl: row.originalUrl, expiresAt: row.expiresAt?.toISOString() ?? null }
    : null;

  if (url) {
    await cacheUrl(code, url);
  } else if (ENABLED) {
    try {
      await redis.set(keyFor(code), NOT_FOUND, "EX", NOT_FOUND_TTL_SECONDS);
    } catch (err) {
      console.error("Cache write failed:", err);
    }
  }

  return { url, source: "db" };
}

export async function invalidateUrl(code: string) {
  try {
    await redis.del(keyFor(code));
  } catch (err) {
    console.error("Cache invalidation failed:", err);
  }
}