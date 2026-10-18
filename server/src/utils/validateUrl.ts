const INTERNAL_NAME_RE = /\.(local|localhost|internal|lan|home)$/i;

function isPrivateIPv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function ownHost(): string | null {
  try {
    return new URL(process.env.BASE_URL ?? "").host;
  } catch {
    return null;
  }
}

export function isValidHttpUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  if (url.username || url.password) return false;

  const host = url.hostname.toLowerCase();
  if (host.startsWith("[")) return false;      // IPv6 addresses
  if (!host.includes(".")) return false;       // "localhost", "intranet", ...
  if (INTERNAL_NAME_RE.test(host)) return false;
  if (isPrivateIPv4(host)) return false;
  if (url.host.toLowerCase() === ownHost()?.toLowerCase()) return false;

  return true;
}