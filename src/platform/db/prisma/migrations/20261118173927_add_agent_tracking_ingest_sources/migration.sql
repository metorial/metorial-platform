-- CreateEnum
CREATE TYPE "AgentTrackingIngestSourceStatus" AS ENUM ('active', 'revoked');

-- CreateTable
CREATE TABLE "AgentTrackingIngestSource" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "AgentTrackingIngestSourceStatus" NOT NULL DEFAULT 'active',
    "serviceIngestSourceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientFamily" TEXT NOT NULL,
    "secretRedacted" TEXT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "serviceRevokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentTrackingIngestSource_pkey" PRIMARY KEY ("oid")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentTrackingIngestSource_id_key" ON "AgentTrackingIngestSource"("id");

-- CreateIndex
CREATE UNIQUE INDEX "AgentTrackingIngestSource_serviceIngestSourceId_key" ON "AgentTrackingIngestSource"("serviceIngestSourceId");

-- CreateIndex
CREATE INDEX "AgentTrackingIngestSource_instanceOid_status_idx" ON "AgentTrackingIngestSource"("instanceOid", "status");

-- CreateIndex
CREATE INDEX "AgentTrackingIngestSource_status_serviceRevokedAt_idx" ON "AgentTrackingIngestSource"("status", "serviceRevokedAt");

-- AddForeignKey
ALTER TABLE "AgentTrackingIngestSource" ADD CONSTRAINT "AgentTrackingIngestSource_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;
