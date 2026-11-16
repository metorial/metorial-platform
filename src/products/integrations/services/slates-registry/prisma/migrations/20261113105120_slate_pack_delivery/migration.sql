-- CreateEnum
CREATE TYPE "SlatePackKind" AS ENUM ('incremental', 'full');

-- CreateEnum
CREATE TYPE "SlatePackImportBatchStatus" AS ENUM ('uploading', 'processing', 'completed');

-- CreateEnum
CREATE TYPE "SlatePackReleaseStatus" AS ENUM ('ready', 'pruned');

-- AlterTable
ALTER TABLE "SlatePackImport" ADD COLUMN     "batchOid" BIGINT,
ADD COLUMN     "channelSubRegistryId" TEXT,
ADD COLUMN     "channelUrl" TEXT,
ADD COLUMN     "coversSequence" INTEGER,
ADD COLUMN     "fullSyncId" TEXT,
ADD COLUMN     "kind" "SlatePackKind",
ADD COLUMN     "manifestVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "part" INTEGER,
ADD COLUMN     "partCount" INTEGER,
ADD COLUMN     "sequence" INTEGER;

-- CreateTable
CREATE TABLE "SlatePackImportBatch" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SlatePackImportBatchStatus" NOT NULL,
    "expectedFileCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "SlatePackImportBatch_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "MirrorPackChannel" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "channelUrl" TEXT NOT NULL,
    "subRegistryId" TEXT NOT NULL,
    "watermark" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MirrorPackChannel_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlatePackChannel" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "subRegistryOid" BIGINT NOT NULL,
    "feedCursorOid" BIGINT,
    "lastSequence" INTEGER NOT NULL DEFAULT 0,
    "lastFullSyncAt" TIMESTAMP(3),
    "lastIncrementalAt" TIMESTAMP(3),
    "lastBuildError" TEXT,
    "lastBuildErrorAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlatePackChannel_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlatePackRelease" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SlatePackReleaseStatus" NOT NULL DEFAULT 'ready',
    "kind" "SlatePackKind" NOT NULL,
    "channelOid" BIGINT NOT NULL,
    "sequence" INTEGER,
    "fullSyncId" TEXT,
    "part" INTEGER,
    "partCount" INTEGER,
    "coversSequence" INTEGER,
    "fileName" TEXT NOT NULL,
    "entryCount" INTEGER NOT NULL,
    "size" BIGINT NOT NULL,
    "sha256" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "prunedAt" TIMESTAMP(3),

    CONSTRAINT "SlatePackRelease_pkey" PRIMARY KEY ("oid")
);

-- CreateIndex
CREATE UNIQUE INDEX "SlatePackImportBatch_id_key" ON "SlatePackImportBatch"("id");

-- CreateIndex
CREATE INDEX "SlatePackImportBatch_status_createdAt_idx" ON "SlatePackImportBatch"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MirrorPackChannel_id_key" ON "MirrorPackChannel"("id");

-- CreateIndex
CREATE UNIQUE INDEX "MirrorPackChannel_channelUrl_subRegistryId_key" ON "MirrorPackChannel"("channelUrl", "subRegistryId");

-- CreateIndex
CREATE UNIQUE INDEX "SlatePackChannel_id_key" ON "SlatePackChannel"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SlatePackChannel_subRegistryOid_key" ON "SlatePackChannel"("subRegistryOid");

-- CreateIndex
CREATE UNIQUE INDEX "SlatePackRelease_id_key" ON "SlatePackRelease"("id");

-- CreateIndex
CREATE INDEX "SlatePackRelease_channelOid_kind_status_idx" ON "SlatePackRelease"("channelOid", "kind", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SlatePackRelease_channelOid_sequence_key" ON "SlatePackRelease"("channelOid", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "SlatePackRelease_channelOid_fullSyncId_part_key" ON "SlatePackRelease"("channelOid", "fullSyncId", "part");

-- CreateIndex
CREATE INDEX "SlatePackImport_batchOid_idx" ON "SlatePackImport"("batchOid");

-- CreateIndex
CREATE INDEX "SlatePackImport_channelUrl_channelSubRegistryId_kind_idx" ON "SlatePackImport"("channelUrl", "channelSubRegistryId", "kind");

-- AddForeignKey
ALTER TABLE "SlatePackImport" ADD CONSTRAINT "SlatePackImport_batchOid_fkey" FOREIGN KEY ("batchOid") REFERENCES "SlatePackImportBatch"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlatePackChannel" ADD CONSTRAINT "SlatePackChannel_subRegistryOid_fkey" FOREIGN KEY ("subRegistryOid") REFERENCES "SubRegistry"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlatePackRelease" ADD CONSTRAINT "SlatePackRelease_channelOid_fkey" FOREIGN KEY ("channelOid") REFERENCES "SlatePackChannel"("oid") ON DELETE CASCADE ON UPDATE CASCADE;
