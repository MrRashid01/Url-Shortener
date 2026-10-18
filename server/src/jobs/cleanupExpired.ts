import { prisma } from "../lib/prisma";

const GRACE_MS = 30 * 24 * 60 * 60 * 1000; // keep expired links 30 days
const EVERY_MS = 60 * 60 * 1000; // run hourly

export async function cleanupExpired() {
  const cutoff = new Date(Date.now() - GRACE_MS);
  const result = await prisma.url.deleteMany({
    where: { expiresAt: { lt: cutoff } },
  });
  if (result.count > 0) {
    console.log(`Cleanup: removed ${result.count} expired links`);
  }
}

export function startCleanupJob() {
  const run = () =>
    cleanupExpired().catch((err) => console.error("Cleanup failed:", err));
  run();
  setInterval(run, EVERY_MS);
}