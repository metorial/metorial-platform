-- CreateEnum
CREATE TYPE "ConsumerDeviceStatus" AS ENUM ('active', 'signed_out', 'revoked');

-- AlterTable
ALTER TABLE "MagicMcpToken" ADD COLUMN     "consumerDeviceOid" BIGINT;

-- CreateTable
CREATE TABLE "ConsumerDevice" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "ConsumerDeviceStatus" NOT NULL DEFAULT 'active',
    "installationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "os" TEXT NOT NULL,
    "arch" TEXT NOT NULL,
    "appVersion" TEXT NOT NULL,
    "consumerProfileOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "oauthTokenOid" BIGINT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsumerDevice_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "McpClientType" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "McpClientType_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ConsumerDeviceClient" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "detected" BOOLEAN NOT NULL,
    "installable" BOOLEAN NOT NULL,
    "supportsSkills" BOOLEAN NOT NULL,
    "reported" BOOLEAN NOT NULL DEFAULT true,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "consumerDeviceOid" BIGINT NOT NULL,
    "mcpClientTypeOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsumerDeviceClient_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ConsumerDeviceClientExcludedMagicMcpServer" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "consumerDeviceClientOid" BIGINT NOT NULL,
    "magicMcpServerOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsumerDeviceClientExcludedMagicMcpServer_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ConsumerDeviceClientExcludedSkill" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "consumerDeviceClientOid" BIGINT NOT NULL,
    "skillOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsumerDeviceClientExcludedSkill_pkey" PRIMARY KEY ("oid")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerDevice_id_key" ON "ConsumerDevice"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerDevice_oauthTokenOid_key" ON "ConsumerDevice"("oauthTokenOid");

-- CreateIndex
CREATE INDEX "ConsumerDevice_instanceOid_consumerProfileOid_idx" ON "ConsumerDevice"("instanceOid", "consumerProfileOid");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerDevice_consumerProfileOid_installationId_key" ON "ConsumerDevice"("consumerProfileOid", "installationId");

-- CreateIndex
CREATE UNIQUE INDEX "McpClientType_id_key" ON "McpClientType"("id");

-- CreateIndex
CREATE UNIQUE INDEX "McpClientType_key_key" ON "McpClientType"("key");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerDeviceClient_id_key" ON "ConsumerDeviceClient"("id");

-- CreateIndex
CREATE INDEX "ConsumerDeviceClient_mcpClientTypeOid_idx" ON "ConsumerDeviceClient"("mcpClientTypeOid");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerDeviceClient_consumerDeviceOid_mcpClientTypeOid_key" ON "ConsumerDeviceClient"("consumerDeviceOid", "mcpClientTypeOid");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerDeviceClientExcludedMagicMcpServer_id_key" ON "ConsumerDeviceClientExcludedMagicMcpServer"("id");

-- CreateIndex
CREATE INDEX "ConsumerDeviceClientExcludedMagicMcpServer_magicMcpServerOi_idx" ON "ConsumerDeviceClientExcludedMagicMcpServer"("magicMcpServerOid");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerDeviceClientExcludedMagicMcpServer_consumerDeviceCl_key" ON "ConsumerDeviceClientExcludedMagicMcpServer"("consumerDeviceClientOid", "magicMcpServerOid");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerDeviceClientExcludedSkill_id_key" ON "ConsumerDeviceClientExcludedSkill"("id");

-- CreateIndex
CREATE INDEX "ConsumerDeviceClientExcludedSkill_skillOid_idx" ON "ConsumerDeviceClientExcludedSkill"("skillOid");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerDeviceClientExcludedSkill_consumerDeviceClientOid_s_key" ON "ConsumerDeviceClientExcludedSkill"("consumerDeviceClientOid", "skillOid");

-- CreateIndex
CREATE INDEX "MagicMcpToken_consumerDeviceOid_idx" ON "MagicMcpToken"("consumerDeviceOid");

-- AddForeignKey
ALTER TABLE "ConsumerDevice" ADD CONSTRAINT "ConsumerDevice_consumerProfileOid_fkey" FOREIGN KEY ("consumerProfileOid") REFERENCES "ConsumerProfile"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerDevice" ADD CONSTRAINT "ConsumerDevice_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerDevice" ADD CONSTRAINT "ConsumerDevice_oauthTokenOid_fkey" FOREIGN KEY ("oauthTokenOid") REFERENCES "OAuthToken"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerDeviceClient" ADD CONSTRAINT "ConsumerDeviceClient_consumerDeviceOid_fkey" FOREIGN KEY ("consumerDeviceOid") REFERENCES "ConsumerDevice"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerDeviceClient" ADD CONSTRAINT "ConsumerDeviceClient_mcpClientTypeOid_fkey" FOREIGN KEY ("mcpClientTypeOid") REFERENCES "McpClientType"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerDeviceClientExcludedMagicMcpServer" ADD CONSTRAINT "ConsumerDeviceClientExcludedMagicMcpServer_consumerDeviceC_fkey" FOREIGN KEY ("consumerDeviceClientOid") REFERENCES "ConsumerDeviceClient"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerDeviceClientExcludedMagicMcpServer" ADD CONSTRAINT "ConsumerDeviceClientExcludedMagicMcpServer_magicMcpServerO_fkey" FOREIGN KEY ("magicMcpServerOid") REFERENCES "MagicMcpServer"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerDeviceClientExcludedSkill" ADD CONSTRAINT "ConsumerDeviceClientExcludedSkill_consumerDeviceClientOid_fkey" FOREIGN KEY ("consumerDeviceClientOid") REFERENCES "ConsumerDeviceClient"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerDeviceClientExcludedSkill" ADD CONSTRAINT "ConsumerDeviceClientExcludedSkill_skillOid_fkey" FOREIGN KEY ("skillOid") REFERENCES "Skill"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MagicMcpToken" ADD CONSTRAINT "MagicMcpToken_consumerDeviceOid_fkey" FOREIGN KEY ("consumerDeviceOid") REFERENCES "ConsumerDevice"("oid") ON DELETE SET NULL ON UPDATE CASCADE;
