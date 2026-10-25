import { Redis } from "ioredis";

export const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: 1,   // don't keep a visitor waiting if Redis is down
  enableOfflineQueue: false, // fail fast instead of piling up commands
});

redis.on("error", (err) => console.error("Redis error:", err.message));
// Wait until Redis is connected (or give up after a few seconds)
export async function waitForRedis(timeoutMs = 5000) {
  if (redis.status === "ready") return;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Redis not ready in time")), timeoutMs);
    redis.once("ready", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}