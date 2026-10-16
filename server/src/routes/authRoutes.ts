import { Router } from "express";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { signToken, setAuthCookie, clearAuthCookie } from "../utils/auth";

const router = Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readCredentials(body: any) {
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  return { email, password };
}

// POST /api/auth/register
router.post("/register", async (req, res) => {
  const { email, password } = readCredentials(req.body);

  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: "Please enter a valid email" });
  }
  // bcrypt only uses the first 72 bytes, so we cap the length
  if (password.length < 8 || password.length > 72) {
    return res.status(400).json({ error: "Password must be 8 to 72 characters" });
  }

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
  const { email, password } = readCredentials(req.body);

  const user = await prisma.user.findUnique({ where: { email } });
  const passwordOk = user ? await bcrypt.compare(password, user.passwordHash) : false;

  // Same message for "no such email" and "wrong password" so attackers
  // can't discover which emails are registered
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