import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { generateCode } from "../utils/generateCode";
import { isValidHttpUrl } from "../utils/validateUrl";

const router = Router();

// POST /api/urls: create a short URL
router.post("/", async (req, res) => {
  const originalUrl =
    typeof req.body?.originalUrl === "string" ? req.body.originalUrl.trim() : "";

  if (!isValidHttpUrl(originalUrl)) {
    return res
      .status(400)
      .json({ error: "Please enter a valid URL starting with http:// or https://" });
  }

  // Try up to 5 times in case of a (very rare) code collision
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const doc = await prisma.url.create({
        data: { originalUrl, shortCode: generateCode() },
      });
      return res.status(201).json({
        originalUrl: doc.originalUrl,
        shortCode: doc.shortCode,
        shortUrl: `${process.env.BASE_URL}/${doc.shortCode}`,
      });
    } catch (err) {
      // P2002 = "unique constraint failed" → generate a new code and retry
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        continue;
      }
      throw err; // anything else is a real problem
    }
  }

  res.status(500).json({ error: "Could not generate a unique code. Try again." });
});

export default router;