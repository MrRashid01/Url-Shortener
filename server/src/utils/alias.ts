const RESERVED = new Set([
  "api", "health", "login", "register", "logout", "dashboard",
  "admin", "static", "assets", "about", "terms", "privacy", "help",
]);

// 3-30 chars, lowercase letters/numbers, "-" and "_" (not at the start)
const ALIAS_RE = /^[a-z0-9][a-z0-9_-]{2,29}$/;

export function normalizeAlias(value: string): string {
  return value.trim().toLowerCase();
}

// Returns an error message, or null if the alias is fine
export function validateAlias(alias: string): string | null {
  if (!ALIAS_RE.test(alias)) {
    return "Alias must be 3-30 characters: letters, numbers, - or _";
  }
  if (RESERVED.has(alias)) {
    return "That alias is reserved";
  }
  return null;
}