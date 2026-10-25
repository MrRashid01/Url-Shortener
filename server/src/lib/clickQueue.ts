import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { redis } from "./redis";
import { logger } from "./logger";
import { Snowflake } from "../idgen/snowflake";

const QUEUE_KEY = "click:queue";
const MAX_QUEUE = 200_000; // safety valve: past this, we drop the oldest events
const BATCH_SIZE = 1000;
const FLUSH_EVERY_MS = 30_000;
const BUFFER_ENABLED = process.env.CLICK_BUFFER !== "false"; // switch for benchmarking

export type ClickEvent = {
  id: string; // Snowflake id as text (JSON can't hold big numbers safely)
  urlId: number;
  clickedAt: string;
  referrer: string;
  browser: string;
  os: string;
  device: string;
};

type ClickInput = Omit<ClickEvent, "id" | "clickedAt">;

let ids: Snowflake | null = null;
let stopping = false;

// Every server needs its own machine number (0 to 1023) for Snowflake ids
async function resolveMachineId(): Promise<number> {
  if (process.env.MACHINE_ID !== undefined) return Number(process.env.MACHINE_ID);
  try {
    const n = await redis.incr("snowflake:machine-counter");
    return (n - 1) % 1024;
  } catch {
    return Math.floor(Math.random() * 1024);
  }
}

// ONE database statement: save all events AND add to each link's counter
async function writeBatch(events: ClickEvent[]) {
  if (events.length === 0) return;

  const rows = events.map(
    (e) =>
      Prisma.sql`(${e.id}::bigint, ${e.urlId}::int, ${e.clickedAt}::timestamp, ${e.referrer}::text, ${e.browser}::text, ${e.os}::text, ${e.device}::text)`
  );

  await prisma.$executeRaw`
    WITH incoming ("id", "urlId", "clickedAt", "referrer", "browser", "os", "device") AS (
      VALUES ${Prisma.join(rows)}
    ),
    inserted AS (
      INSERT INTO "Click" ("id", "urlId", "clickedAt", "referrer", "browser", "os", "device")
      SELECT i."id", i."urlId", i."clickedAt", i."referrer", i."browser", i."os", i."device"
      FROM incoming i
      WHERE EXISTS (SELECT 1 FROM "Url" u WHERE u."id" = i."urlId")
      ON CONFLICT ("id") DO NOTHING
      RETURNING "urlId"
    )
    UPDATE "Url" AS u
    SET "clicks" = u."clicks" + c."n"
    FROM (SELECT "urlId", COUNT(*)::int AS "n" FROM inserted GROUP BY "urlId") AS c
    WHERE u."id" = c."urlId"`;
}

// Producer: called on every redirect. Must be fast and must never throw.
export async function enqueueClick(input: ClickInput): Promise<void> {
  if (!ids) {
    logger.warn("Click pipeline not started, dropping click");
    return;
  }

  const event: ClickEvent = {
    ...input,
    id: ids.next().toString(),
    clickedAt: new Date().toISOString(),
  };

  try {
    if (!BUFFER_ENABLED) {
      await writeBatch([event]); // old behavior: one write per click
      return;
    }

    const length = await redis.rpush(QUEUE_KEY, JSON.stringify(event));
    if (length > MAX_QUEUE) {
      await redis.ltrim(QUEUE_KEY, -MAX_QUEUE, -1); // keep only the newest MAX_QUEUE
    }
  } catch (err) {
    // Redis problem: don't lose the click, save it directly
    logger.warn({ err }, "Could not queue click, saving it directly");
    try {
      await writeBatch([event]);
    } catch (err2) {
      logger.error({ err: err2 }, "Click lost");
    }
  }
}

// Consumer: take up to BATCH_SIZE events and save them in one statement
async function flushOnce(): Promise<number> {
  // LPOP with a count removes the events from Redis in one step, so several
  // servers can run this at the same time and never get the same event
  const raw = await redis.lpop(QUEUE_KEY, BATCH_SIZE);
  if (!raw || raw.length === 0) return 0;

  const events: ClickEvent[] = [];
  for (const item of raw) {
    try {
      events.push(JSON.parse(item) as ClickEvent);
    } catch {
      logger.warn("Skipping an unreadable click event");
    }
  }

  try {
    await writeBatch(events);
  } catch (err) {
    // Database problem: put the events back so nothing is lost, then try later
    logger.error({ err }, "Click batch failed, putting events back in the queue");
    await redis.rpush(QUEUE_KEY, ...raw);
    throw err;
  }

  return events.length;
}

async function flushLoop() {
  while (!stopping) {
    try {
      const saved = await flushOnce();
      if (saved === BATCH_SIZE) continue; // more are waiting, go again right away
    } catch {
      // already logged. Wait and try again.
    }
    await new Promise((resolve) => setTimeout(resolve, FLUSH_EVERY_MS));
  }
}

export async function startClickPipeline() {
  const machineId = await resolveMachineId();
  ids = new Snowflake(machineId);
  void flushLoop();
  logger.info({ machineId, buffered: BUFFER_ENABLED }, "Click pipeline started");
}

// On shutdown, save what is waiting (events also stay safe in Redis if we skip this)
export async function shutdownClickPipeline() {
  stopping = true;
  for (let i = 0; i < 20; i++) {
    const saved = await flushOnce().catch(() => 0);
    if (saved < BATCH_SIZE) break;
  }
}

export async function clickQueueLength(): Promise<number> {
  return redis.llen(QUEUE_KEY);
}