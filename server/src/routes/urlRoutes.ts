import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { generateCode } from "../utils/generateCode";
import { isValidHttpUrl } from "../utils/validateUrl";
import { optionalAuth, requireAuth } from "../middleware/auth";

const router = Router();

// Shape we send to the frontend
function toDto(u: {
  id: number;
  originalUrl: string;
  shortCode: string;
  clicks: number;
  createdAt: Date;
  expiresAt: Date | null;
}) {
  return {
    id: u.id,
    originalUrl: u.originalUrl,
    shortCode: u.shortCode,
    shortUrl: `${process.env.BASE_URL}/${u.shortCode}`,
    clicks: u.clicks,
    createdAt: u.createdAt,
    expiresAt: u.expiresAt,
  };
}

// POST /api/urls: create (works for anonymous and logged-in users)
router.post("/", optionalAuth, async (req, res) => {
  const originalUrl =
    typeof req.body?.originalUrl === "string" ? req.body.originalUrl.trim() : "";

  if (!isValidHttpUrl(originalUrl)) {
    return res
      .status(400)
      .json({ error: "Please enter a valid URL starting with http:// or https://" });
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const doc = await prisma.url.create({
        data: {
          originalUrl,
          shortCode: generateCode(),
          userId: res.locals.userId ?? null,
        },
      });
      return res.status(201).json(toDto(doc));
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        continue;
      }
      throw err;
    }
  }

  res.status(500).json({ error: "Could not generate a unique code. Try again." });
});

// GET /api/urls?search=&page=&limit=: list MY urls
router.get("/", requireAuth, async (req, res) => {
  const userId: number = res.locals.userId;

  const page = Math.max(1, parseInt(String(req.query.page)) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit)) || 10));
  const search =
    typeof req.query.search === "string" ? req.query.search.trim().slice(0, 100) : "";

  const where: Prisma.UrlWhereInput = {
    userId, // ownership is part of the query
    ...(search && {
      OR: [
        { originalUrl: { contains: search, mode: "insensitive" } },
        { shortCode: { contains: search, mode: "insensitive" } },
      ],
    }),
  };

  const [items, total] = await Promise.all([
    prisma.url.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.url.count({ where }),
  ]);

  res.json({
    items: items.map(toDto),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
});

// DELETE /api/urls/:id: delete one of MY urls
router.delete("/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Invalid id" });
  }

  // id AND userId in one query → you can only ever delete your own
  const result = await prisma.url.deleteMany({
    where: { id, userId: res.locals.userId },
  });

  // Same 404 whether it doesn't exist or belongs to someone else,
  // so attackers can't probe which ids exist
  if (result.count === 0) {
    return res.status(404).json({ error: "URL not found" });
  }

  res.json({ ok: true });
});

export default router;