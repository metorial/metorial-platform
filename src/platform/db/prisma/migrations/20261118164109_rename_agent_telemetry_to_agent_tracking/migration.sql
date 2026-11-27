-- RenameEnum
ALTER TYPE "AgentTelemetryIngestTokenStatus" RENAME TO "AgentTrackingIngestTokenStatus";

-- RenameEnum
ALTER TYPE "AgentTelemetryIngestTokenDeviceMode" RENAME TO "AgentTrackingIngestTokenDeviceMode";

-- RenameTable
ALTER TABLE "AgentTelemetryIngestToken" RENAME TO "AgentTrackingIngestToken";

-- RenameSequence
ALTER SEQUENCE "AgentTelemetryIngestToken_oid_seq" RENAME TO "AgentTrackingIngestToken_oid_seq";

-- RenameColumn
ALTER TABLE "AgentTrackingIngestToken" RENAME COLUMN "groundstationIngestTokenId" TO "serviceIngestTokenId";

-- RenamePrimaryKey
ALTER TABLE "AgentTrackingIngestToken" RENAME CONSTRAINT "AgentTelemetryIngestToken_pkey" TO "AgentTrackingIngestToken_pkey";

-- RenameIndex
ALTER INDEX "AgentTelemetryIngestToken_id_key" RENAME TO "AgentTrackingIngestToken_id_key";

-- RenameIndex
ALTER INDEX "AgentTelemetryIngestToken_groundstationIngestTokenId_key" RENAME TO "AgentTrackingIngestToken_serviceIngestTokenId_key";

-- RenameIndex
ALTER INDEX "AgentTelemetryIngestToken_consumerDeviceOid_status_idx" RENAME TO "AgentTrackingIngestToken_consumerDeviceOid_status_idx";

-- RenameIndex
ALTER INDEX "AgentTelemetryIngestToken_consumerOid_status_idx" RENAME TO "AgentTrackingIngestToken_consumerOid_status_idx";

-- RenameIndex
ALTER INDEX "AgentTelemetryIngestToken_instanceOid_idx" RENAME TO "AgentTrackingIngestToken_instanceOid_idx";

-- RenameForeignKey
ALTER TABLE "AgentTrackingIngestToken" RENAME CONSTRAINT "AgentTelemetryIngestToken_instanceOid_fkey" TO "AgentTrackingIngestToken_instanceOid_fkey";

-- RenameForeignKey
ALTER TABLE "AgentTrackingIngestToken" RENAME CONSTRAINT "AgentTelemetryIngestToken_consumerOid_fkey" TO "AgentTrackingIngestToken_consumerOid_fkey";

-- RenameForeignKey
ALTER TABLE "AgentTrackingIngestToken" RENAME CONSTRAINT "AgentTelemetryIngestToken_consumerDeviceOid_fkey" TO "AgentTrackingIngestToken_consumerDeviceOid_fkey";
