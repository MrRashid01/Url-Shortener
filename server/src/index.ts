import "dotenv/config";
import express from "express";
import cors from "cors";
import urlRoutes from "./routes/urlRoutes";
import { prisma } from "./lib/prisma";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/authRoutes";

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/urls", urlRoutes);

// Redirect route LAST (it matches any single-segment path)
app.get("/:shortCode", async (req, res) => {
  const url = await prisma.url.findUnique({
    where: { shortCode: req.params.shortCode },
  });

  if (!url) {
    return res.status(404).send("Short link not found");
  }

  // Fire-and-forget: don't make the visitor wait for the counter update
  prisma.url
    .update({ where: { id: url.id }, data: { clicks: { increment: 1 } } })
    .catch((err) => console.error("Click count failed:", err));

  res.redirect(302, url.originalUrl);
});

if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not set");

async function start() {
  await prisma.$connect();
  console.log("Postgres connected");

  const port = process.env.PORT || 5000;
  app.listen(port, () => console.log(`Server running on port ${port}`));
}

start().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});