/*
  Warnings:

  - A unique constraint covering the columns `[clientSecretId]` on the table `Session` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE INDEX "ServerListing_rank_idx" ON "ServerListing"("rank");

-- CreateIndex
CREATE UNIQUE INDEX "Session_clientSecretId_key" ON "Session"("clientSecretId");
