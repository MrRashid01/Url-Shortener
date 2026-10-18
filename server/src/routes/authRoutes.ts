import { Router } from "express";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { signToken, setAuthCookie, clearAuthCookie } from "../utils/auth";

import { parseBody, registerSchema, loginSchema } from "../schemas";
// Computed once at startup. Used so unknown emails take the same time as known ones.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12);

const router = Router();

// POST /api/auth/register
router.post("/register", async (req, res) => {
  const data = parseBody(registerSchema, req.body, res);
  if (!data) return;
  const { email, password } = data;

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const user = await prisma.user.create({ data: { email, passwordHash } });
    setAuthCookie(res, signToken(user.id));
    return res.status(201).json({ user: { id: user.id, email: user.email } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return res.status(409).json({ error: "Email is already registered" });
    }
    throw err;
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const data = parseBody(loginSchema, req.body, res);
  if (!data) return;
  const { email, password } = data;

  const user = await prisma.user.findUnique({ where: { email } });

  // Always run bcrypt, even when the email doesn't exist.
  // Otherwise "unknown email" answers faster, and attackers can use
  // that time difference to find out which emails are registered.
  const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !passwordOk) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  setAuthCookie(res, signToken(user.id));
  res.json({ user: { id: user.id, email: user.email } });
});

// POST /api/auth/logout
router.post("/logout", (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

// GET /api/auth/me: who am I? (protected)
router.get("/me", requireAuth, async (_req, res) => {
  const user = await prisma.user.findUnique({ where: { id: res.locals.userId } });
  if (!user) {
    return res.status(401).json({ error: "Please log in" });
  }
  res.json({ user: { id: user.id, email: user.email } });
});

export default router;