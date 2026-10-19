import jwt from "jsonwebtoken";
import type { Response } from "express";

export const COOKIE_NAME = "token";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return secret;
}

export function signToken(userId: number): string {
  return jwt.sign({ userId }, getJwtSecret(), { expiresIn: "7d" });
}

// true only when frontend and backend are on different websites (see Part B)
const crossSite = process.env.CROSS_SITE_COOKIES === "true";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: (crossSite ? "none" : "lax") as "none" | "lax",
};

export function setAuthCookie(res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: SEVEN_DAYS_MS });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, cookieOptions);
}

// Returns the user id if the token is valid, otherwise null
export function readUserId(token?: string): number | null {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, getJwtSecret()) as jwt.JwtPayload;
    return typeof payload.userId === "number" ? payload.userId : null;
  } catch {
    return null; // expired, tampered, or malformed
  }
}