import UAParser from "ua-parser-js";
import { prisma } from "../lib/prisma";

const BOT_RE = /bot|crawler|spider|slurp|preview|facebookexternalhit|headless|monitor/i;

export function looksLikeBot(userAgent: string): boolean {
  return BOT_RE.test(userAgent);
}

function parseReferrer(referer?: string): string {
  if (!referer) return "Direct";
  try {
    const host = new URL(referer).hostname.replace(/^www\./, "");
    return host.slice(0, 100) || "Direct";
  } catch {
    return "Direct";
  }
}

// Fire-and-forget: the caller does NOT await this
export function recordClick(urlId: number, userAgent: string, referer?: string) {
  const ua = new UAParser(userAgent).getResult();

  prisma
    .$transaction([
      prisma.click.create({
        data: {
          urlId,
          referrer: parseReferrer(referer),
          browser: ua.browser.name ?? "Unknown",
          os: ua.os.name ?? "Unknown",
          device: ua.device.type ?? "desktop", // parser returns nothing for desktops
        },
      }),
      prisma.url.update({
        where: { id: urlId },
        data: { clicks: { increment: 1 } },
      }),
    ])
    .catch((err) => console.error("Analytics failed:", err));
}