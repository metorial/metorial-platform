-- CreateEnum
CREATE TYPE "AiToolPolicyStatus" AS ENUM ('sanctioned', 'not_sanctioned', 'unreviewed');

-- CreateEnum
CREATE TYPE "ConsumerDeviceDetectionState" AS ENUM ('installed', 'running');

-- CreateEnum
CREATE TYPE "ConsumerDeviceDetectionConfidence" AS ENUM ('high', 'medium', 'low');

-- CreateEnum
CREATE TYPE "ConsumerDeviceDetectionSignalKind" AS ENUM ('config_dir', 'app', 'path', 'ide_extension', 'process');

-- AlterTable
ALTER TABLE "ConsumerDevice" ADD COLUMN     "detectionReportedAt" TIMESTAMP(3),
ADD COLUMN     "detectionSeq" INTEGER;

-- CreateTable
CREATE TABLE "AiToolPolicy" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "toolKey" TEXT NOT NULL,
    "status" "AiToolPolicyStatus" NOT NULL,
    "note" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "instanceOid" BIGINT NOT NULL,
    "decidedByActorOid" BIGINT,

    CONSTRAINT "AiToolPolicy_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ConsumerDeviceSettings" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "aiToolDetectionEnabled" BOOLEAN NOT NULL DEFAULT false,
    "privacyNoticeAcceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "instanceOid" BIGINT NOT NULL,
    "privacyNoticeAcceptedByActorOid" BIGINT,

    CONSTRAINT "ConsumerDeviceSettings_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ConsumerDeviceDetection" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "toolKey" TEXT NOT NULL,
    "state" "ConsumerDeviceDetectionState" NOT NULL,
    "confidence" "ConsumerDeviceDetectionConfidence" NOT NULL,
    "signalKinds" "ConsumerDeviceDetectionSignalKind"[],
    "version" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "goneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumerDeviceOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,

    CONSTRAINT "ConsumerDeviceDetection_pkey" PRIMARY KEY ("oid")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiToolPolicy_id_key" ON "AiToolPolicy"("id");

-- CreateIndex
CREATE UNIQUE INDEX "AiToolPolicy_instanceOid_toolKey_key" ON "AiToolPolicy"("instanceOid", "toolKey");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerDeviceSettings_id_key" ON "ConsumerDeviceSettings"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerDeviceSettings_instanceOid_key" ON "ConsumerDeviceSettings"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerDeviceDetection_id_key" ON "ConsumerDeviceDetection"("id");

-- CreateIndex
CREATE INDEX "ConsumerDeviceDetection_instanceOid_toolKey_goneAt_idx" ON "ConsumerDeviceDetection"("instanceOid", "toolKey", "goneAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerDeviceDetection_consumerDeviceOid_toolKey_key" ON "ConsumerDeviceDetection"("consumerDeviceOid", "toolKey");

-- AddForeignKey
ALTER TABLE "AiToolPolicy" ADD CONSTRAINT "AiToolPolicy_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiToolPolicy" ADD CONSTRAINT "AiToolPolicy_decidedByActorOid_fkey" FOREIGN KEY ("decidedByActorOid") REFERENCES "OrganizationActor"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerDeviceSettings" ADD CONSTRAINT "ConsumerDeviceSettings_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerDeviceSettings" ADD CONSTRAINT "ConsumerDeviceSettings_privacyNoticeAcceptedByActorOid_fkey" FOREIGN KEY ("privacyNoticeAcceptedByActorOid") REFERENCES "OrganizationActor"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerDeviceDetection" ADD CONSTRAINT "ConsumerDeviceDetection_consumerDeviceOid_fkey" FOREIGN KEY ("consumerDeviceOid") REFERENCES "ConsumerDevice"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerDeviceDetection" ADD CONSTRAINT "ConsumerDeviceDetection_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;
