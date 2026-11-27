-- CreateEnum
CREATE TYPE "AgentTelemetryIngestTokenStatus" AS ENUM ('active', 'revoked');

-- CreateEnum
CREATE TYPE "AgentTelemetryIngestTokenDeviceMode" AS ENUM ('bound', 'ephemeral');

-- CreateTable
CREATE TABLE "AgentTelemetryIngestToken" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "AgentTelemetryIngestTokenStatus" NOT NULL DEFAULT 'active',
    "deviceMode" "AgentTelemetryIngestTokenDeviceMode" NOT NULL,
    "groundstationIngestTokenId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "consumerOid" BIGINT NOT NULL,
    "consumerDeviceOid" BIGINT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentTelemetryIngestToken_pkey" PRIMARY KEY ("oid")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentTelemetryIngestToken_id_key" ON "AgentTelemetryIngestToken"("id");

-- CreateIndex
CREATE UNIQUE INDEX "AgentTelemetryIngestToken_groundstationIngestTokenId_key" ON "AgentTelemetryIngestToken"("groundstationIngestTokenId");

-- CreateIndex
CREATE INDEX "AgentTelemetryIngestToken_consumerDeviceOid_status_idx" ON "AgentTelemetryIngestToken"("consumerDeviceOid", "status");

-- CreateIndex
CREATE INDEX "AgentTelemetryIngestToken_consumerOid_status_idx" ON "AgentTelemetryIngestToken"("consumerOid", "status");

-- CreateIndex
CREATE INDEX "AgentTelemetryIngestToken_instanceOid_idx" ON "AgentTelemetryIngestToken"("instanceOid");

-- AddForeignKey
ALTER TABLE "AgentTelemetryIngestToken" ADD CONSTRAINT "AgentTelemetryIngestToken_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentTelemetryIngestToken" ADD CONSTRAINT "AgentTelemetryIngestToken_consumerOid_fkey" FOREIGN KEY ("consumerOid") REFERENCES "Consumer"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentTelemetryIngestToken" ADD CONSTRAINT "AgentTelemetryIngestToken_consumerDeviceOid_fkey" FOREIGN KEY ("consumerDeviceOid") REFERENCES "ConsumerDevice"("oid") ON DELETE SET NULL ON UPDATE CASCADE;
