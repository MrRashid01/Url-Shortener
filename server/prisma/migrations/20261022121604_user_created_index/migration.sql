-- DropIndex
DROP INDEX "Url_userId_idx";

-- CreateIndex
CREATE INDEX "Url_userId_createdAt_idx" ON "Url"("userId", "createdAt" DESC);
