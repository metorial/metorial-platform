/*
  Warnings:

  - You are about to drop the column `ipAddress` on the `SessionConnection` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "SessionConnection" DROP COLUMN "ipAddress",
ADD COLUMN     "anonIp" TEXT;
