/*
  Warnings:

  - The primary key for the `Click` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE "Click" DROP CONSTRAINT "Click_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE BIGINT,
ADD CONSTRAINT "Click_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Click_id_seq";
