/*
  Warnings:

  - A unique constraint covering the columns `[engineErrorId]` on the table `ServerRunError` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[engineEventsId]` on the table `SessionEvent` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[engineMessageId]` on the table `SessionMessage` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "SessionEvent" ADD COLUMN     "engineEventsId" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "ServerRunError_engineErrorId_key" ON "ServerRunError"("engineErrorId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionEvent_engineEventsId_key" ON "SessionEvent"("engineEventsId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionMessage_engineMessageId_key" ON "SessionMessage"("engineMessageId");
