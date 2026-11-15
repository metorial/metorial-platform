-- CreateEnum
CREATE TYPE "QueryExportStatus" AS ENUM ('queued', 'running', 'completed', 'failed', 'cancelled', 'expired');

-- CreateTable
CREATE TABLE "QueryExport" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "QueryExportStatus" NOT NULL DEFAULT 'queued',
    "format" TEXT NOT NULL,
    "query" JSONB NOT NULL,
    "scope" JSONB NOT NULL,
    "asOf" TIMESTAMP(3) NOT NULL,
    "objectKey" TEXT NOT NULL,
    "uploadId" TEXT,
    "parts" JSONB NOT NULL DEFAULT '[]',
    "cursor" TEXT,
    "rows" BIGINT NOT NULL DEFAULT 0,
    "bytes" BIGINT NOT NULL DEFAULT 0,
    "leaseOwner" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastProgressAt" TIMESTAMP(3),
    "error" TEXT,
    "selectsPersonal" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationOid" BIGINT NOT NULL,

    CONSTRAINT "QueryExport_pkey" PRIMARY KEY ("oid")
);

-- CreateIndex
CREATE UNIQUE INDEX "QueryExport_id_key" ON "QueryExport"("id");

-- CreateIndex
CREATE INDEX "QueryExport_organizationOid_createdAt_idx" ON "QueryExport"("organizationOid", "createdAt");

-- CreateIndex
CREATE INDEX "QueryExport_status_leaseExpiresAt_idx" ON "QueryExport"("status", "leaseExpiresAt");

-- CreateIndex
CREATE INDEX "QueryExport_status_expiresAt_idx" ON "QueryExport"("status", "expiresAt");

-- AddForeignKey
ALTER TABLE "QueryExport" ADD CONSTRAINT "QueryExport_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;
