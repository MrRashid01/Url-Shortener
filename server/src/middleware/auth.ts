import type { Request, Response, NextFunction } from "express";
import { COOKIE_NAME, readUserId } from "../utils/auth";

// Attaches res.locals.userId if logged in, but lets anonymous users through
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  res.locals.userId = readUserId(req.cookies?.[COOKIE_NAME]);
  next();
}

// Blocks the request with 401 unless logged in
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const userId = readUserId(req.cookies?.[COOKIE_NAME]);
  if (userId === null) {
    return res.status(401).json({ error: "Please log in" });
  }
  res.locals.userId = userId;
  next();
}