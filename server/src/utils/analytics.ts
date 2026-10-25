import UAParser from "ua-parser-js";
import { enqueueClick } from "../lib/clickQueue";

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

// Fire-and-forget: the redirect does NOT wait for this
export function recordClick(urlId: number, userAgent: string, referer?: string) {
  const ua = new UAParser(userAgent).getResult();

  void enqueueClick({
    urlId,
    referrer: parseReferrer(referer),
    browser: ua.browser.name ?? "Unknown",
    os: ua.os.name ?? "Unknown",
    device: ua.device.type ?? "desktop",
  });
}