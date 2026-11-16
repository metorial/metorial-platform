-- CreateEnum
CREATE TYPE "SlatePackBuildStatus" AS ENUM ('running', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "SlatePackBuildTrigger" AS ENUM ('scheduled', 'manual');

-- CreateTable
CREATE TABLE "SlatePackBuild" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SlatePackBuildStatus" NOT NULL DEFAULT 'running',
    "trigger" "SlatePackBuildTrigger" NOT NULL,
    "channelOid" BIGINT NOT NULL,
    "forceFullSync" BOOLEAN NOT NULL DEFAULT false,
    "reset" BOOLEAN NOT NULL DEFAULT false,
    "rewindFeed" BOOLEAN NOT NULL DEFAULT false,
    "releasesWritten" INTEGER NOT NULL DEFAULT 0,
    "logs" TEXT[],
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "SlatePackBuild_pkey" PRIMARY KEY ("oid")
);

-- CreateIndex
CREATE UNIQUE INDEX "SlatePackBuild_id_key" ON "SlatePackBuild"("id");

-- CreateIndex
CREATE INDEX "SlatePackBuild_channelOid_startedAt_idx" ON "SlatePackBuild"("channelOid", "startedAt");

-- AddForeignKey
ALTER TABLE "SlatePackBuild" ADD CONSTRAINT "SlatePackBuild_channelOid_fkey" FOREIGN KEY ("channelOid") REFERENCES "SlatePackChannel"("oid") ON DELETE CASCADE ON UPDATE CASCADE;
