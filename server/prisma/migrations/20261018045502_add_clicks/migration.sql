-- CreateTable
CREATE TABLE "Click" (
    "id" SERIAL NOT NULL,
    "urlId" INTEGER NOT NULL,
    "clickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "referrer" TEXT NOT NULL DEFAULT 'Direct',
    "browser" TEXT NOT NULL DEFAULT 'Unknown',
    "os" TEXT NOT NULL DEFAULT 'Unknown',
    "device" TEXT NOT NULL DEFAULT 'desktop',

    CONSTRAINT "Click_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Click_urlId_clickedAt_idx" ON "Click"("urlId", "clickedAt");

-- AddForeignKey
ALTER TABLE "Click" ADD CONSTRAINT "Click_urlId_fkey" FOREIGN KEY ("urlId") REFERENCES "Url"("id") ON DELETE CASCADE ON UPDATE CASCADE;
