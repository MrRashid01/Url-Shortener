import { Redis } from "ioredis";

export const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: 1,   // don't keep a visitor waiting if Redis is down
  enableOfflineQueue: false, // fail fast instead of piling up commands
});

redis.on("error", (err) => console.error("Redis error:", err.message));