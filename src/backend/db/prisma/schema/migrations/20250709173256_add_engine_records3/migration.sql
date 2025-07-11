/*
  Warnings:

  - Added the required column `lastSyncAt` to the `EngineRun` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lastSyncAt` to the `EngineSession` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "EngineRun" ADD COLUMN     "lastSyncAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "EngineSession" ADD COLUMN     "lastSyncAt" TIMESTAMP(3) NOT NULL;
