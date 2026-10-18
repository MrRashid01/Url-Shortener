import { redis } from "./redis";
import { prisma } from "./prisma";

const ENABLED = process.env.CACHE_ENABLED !== "false"; // switch for benchmarking
const MAX_TTL_SECONDS = 60 * 60; // keep a note for 1 hour
const NOT_FOUND_TTL_SECONDS = 60; // remember "doesn't exist" for 1 minute
const NOT_FOUND = "none";

export type CachedUrl = {
  id: number;
  originalUrl: string;
  expiresAt: string | null;
};

const keyFor = (code: string) => `url:${code}`;

export async function getUrlByCode(
  code: string
): Promise<{ url: CachedUrl | null; source: "cache" | "db" }> {
  // 1. Try Redis first
  if (ENABLED) {
    try {
      const cached = await redis.get(keyFor(code));
      if (cached === NOT_FOUND) return { url: null, source: "cache" };
      if (cached) return { url: JSON.parse(cached) as CachedUrl, source: "cache" };
    } catch (err) {
      console.error("Cache read failed, using database:", err);
    }
  }

  // 2. Cache miss: ask Postgres
  const row = await prisma.url.findUnique({
    where: { shortCode: code },
    select: { id: true, originalUrl: true, expiresAt: true },
  });

  const url: CachedUrl | null = row
    ? { id: row.id, originalUrl: row.originalUrl, expiresAt: row.expiresAt?.toISOString() ?? null }
    : null;

  // 3. Save a note in Redis for next time
  if (ENABLED) {
    try {
      if (!url) {
        await redis.set(keyFor(code), NOT_FOUND, "EX", NOT_FOUND_TTL_SECONDS);
      } else {
        let ttl = MAX_TTL_SECONDS;
        if (url.expiresAt) {
          // Never keep a note longer than the link itself lives
          const secondsLeft = Math.floor((new Date(url.expiresAt).getTime() - Date.now()) / 1000);
          ttl = Math.min(ttl, secondsLeft);
        }
        if (ttl > 0) {
          await redis.set(keyFor(code), JSON.stringify(url), "EX", ttl);
        }
      }
    } catch (err) {
      console.error("Cache write failed:", err);
    }
  }

  return { url, source: "db" };
}

// Throw the note away because the real data changed
export async function invalidateUrl(code: string) {
  try {
    await redis.del(keyFor(code));
  } catch (err) {
    console.error("Cache invalidation failed:", err);
  }
}