import type { NextFunction, Request, Response } from "express";
import { redis } from "../lib/redis";
import { logger } from "../lib/logger";

type Options = { name: string; windowSeconds: number; max: number };

export function rateLimit({ name, windowSeconds, max }: Options) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = `rl:${name}:${req.ip}`;

    try {
      // Add 1 to the counter and read how many seconds it has left, together
      const results = await redis.multi().incr(key).ttl(key).exec();
      const count = Number(results?.[0]?.[1]);
      let ttl = Number(results?.[1]?.[1]);

      // First request in this window: start the countdown
      if (ttl < 0) {
        await redis.expire(key, windowSeconds);
        ttl = windowSeconds;
      }

      res.set("RateLimit-Limit", String(max));
      res.set("RateLimit-Remaining", String(Math.max(0, max - count)));

      if (count > max) {
        res.set("Retry-After", String(ttl));
        return res.status(429).json({ error: "Too many requests. Please try again later." });
      }
    } catch (err) {
      // Redis problem: don't block real users because of our own failure
      logger.warn({ err }, "Rate limiter unavailable, letting request through");
    }

    next();
  };
}