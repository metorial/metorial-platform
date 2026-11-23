-- CreateEnum
CREATE TYPE "CatalogEntryStatus" AS ENUM ('active', 'retired');

-- CreateEnum
CREATE TYPE "ProviderKind" AS ENUM ('metorial', 'first_party', 'cloud', 'inference', 'aggregator', 'subscription');

-- CreateEnum
CREATE TYPE "ModelStatus" AS ENUM ('preview', 'active', 'deprecated', 'retired');

-- CreateEnum
CREATE TYPE "ProviderConnectionStatus" AS ENUM ('pending', 'valid', 'invalid', 'disabled');

-- DropForeignKey
ALTER TABLE "Assistant" DROP CONSTRAINT "Assistant_tenantOid_fkey";

-- DropForeignKey
ALTER TABLE "Assistant" DROP CONSTRAINT "Assistant_implementationOid_fkey";

-- DropForeignKey
ALTER TABLE "AssistantConfig" DROP CONSTRAINT "AssistantConfig_tenantOid_fkey";

-- DropForeignKey
ALTER TABLE "AssistantInstance" DROP CONSTRAINT "AssistantInstance_assistantOid_fkey";

-- DropForeignKey
ALTER TABLE "AssistantInstance" DROP CONSTRAINT "AssistantInstance_tenantOid_fkey";

-- DropForeignKey
ALTER TABLE "AssistantConversation" DROP CONSTRAINT "AssistantConversation_assistantInstanceOid_fkey";

-- DropForeignKey
ALTER TABLE "AssistantConversation" DROP CONSTRAINT "AssistantConversation_assistantOid_fkey";

-- DropForeignKey
ALTER TABLE "AssistantConversation" DROP CONSTRAINT "AssistantConversation_tenantOid_fkey";

-- DropForeignKey
ALTER TABLE "AssistantConversation" DROP CONSTRAINT "AssistantConversation_environmentOid_fkey";

-- DropForeignKey
ALTER TABLE "AssistantConversation" DROP CONSTRAINT "AssistantConversation_createdByTenantActorOid_fkey";

-- DropForeignKey
ALTER TABLE "AssistantConversation" DROP CONSTRAINT "AssistantConversation_rootMessageOid_fkey";

-- DropForeignKey
ALTER TABLE "AssistantConversationParticipant" DROP CONSTRAINT "AssistantConversationParticipant_conversationOid_fkey";

-- DropForeignKey
ALTER TABLE "AssistantConversationParticipant" DROP CONSTRAINT "AssistantConversationParticipant_tenantActorOid_fkey";

-- DropForeignKey
ALTER TABLE "AssistantRequest" DROP CONSTRAINT "AssistantRequest_conversationOid_fkey";

-- DropForeignKey
ALTER TABLE "AssistantRequest" DROP CONSTRAINT "AssistantRequest_assistantInstanceOid_fkey";

-- DropForeignKey
ALTER TABLE "AssistantRequest" DROP CONSTRAINT "AssistantRequest_assistantOid_fkey";

-- DropForeignKey
ALTER TABLE "AssistantRequest" DROP CONSTRAINT "AssistantRequest_modelOid_fkey";

-- DropForeignKey
ALTER TABLE "AssistantRequest" DROP CONSTRAINT "AssistantRequest_messageOid_fkey";

-- DropForeignKey
ALTER TABLE "AssistantRequest" DROP CONSTRAINT "AssistantRequest_tenantActorOid_fkey";

-- DropForeignKey
ALTER TABLE "AssistantMessage" DROP CONSTRAINT "AssistantMessage_runOid_fkey";

-- DropForeignKey
ALTER TABLE "AssistantMessage" DROP CONSTRAINT "AssistantMessage_requestOid_fkey";

-- DropForeignKey
ALTER TABLE "AssistantMessage" DROP CONSTRAINT "AssistantMessage_assistantInstanceOid_fkey";

-- DropForeignKey
ALTER TABLE "AssistantMessage" DROP CONSTRAINT "AssistantMessage_assistantOid_fkey";

-- DropForeignKey
ALTER TABLE "AssistantMessage" DROP CONSTRAINT "AssistantMessage_parentMessageOid_fkey";

-- DropForeignKey
ALTER TABLE "AssistantMessage" DROP CONSTRAINT "AssistantMessage_modelOid_fkey";

-- DropForeignKey
ALTER TABLE "AssistantConversationItem" DROP CONSTRAINT "AssistantConversationItem_conversationOid_fkey";

-- DropForeignKey
ALTER TABLE "AssistantConversationItem" DROP CONSTRAINT "AssistantConversationItem_messageOid_fkey";

-- DropForeignKey
ALTER TABLE "Model" DROP CONSTRAINT "Model_providerOid_fkey";

-- DropForeignKey
ALTER TABLE "ModelRun" DROP CONSTRAINT "ModelRun_tenantOid_fkey";

-- DropForeignKey
ALTER TABLE "ModelRun" DROP CONSTRAINT "ModelRun_requestOid_fkey";

-- DropForeignKey
ALTER TABLE "ModelRun" DROP CONSTRAINT "ModelRun_conversationOid_fkey";

-- DropForeignKey
ALTER TABLE "ModelRun" DROP CONSTRAINT "ModelRun_assistantInstanceOid_fkey";

-- DropForeignKey
ALTER TABLE "ModelRun" DROP CONSTRAINT "ModelRun_assistantOid_fkey";

-- DropForeignKey
ALTER TABLE "ModelRun" DROP CONSTRAINT "ModelRun_modelOid_fkey";

-- DropForeignKey
ALTER TABLE "SubspaceMcpConnection" DROP CONSTRAINT "SubspaceMcpConnection_tenantOid_fkey";

-- DropForeignKey
ALTER TABLE "SubspaceMcpConnection" DROP CONSTRAINT "SubspaceMcpConnection_environmentOid_fkey";

-- DropForeignKey
ALTER TABLE "Environment" DROP CONSTRAINT "Environment_tenantOid_fkey";

-- DropForeignKey
ALTER TABLE "TenantActor" DROP CONSTRAINT "TenantActor_tenantOid_fkey";

-- DropIndex
DROP INDEX "Model_providerOid_idx";

-- DropIndex
DROP INDEX "Model_slug_providerOid_key";

-- AlterTable
ALTER TABLE "Model" DROP COLUMN "contextWindow",
DROP COLUMN "inputCostPerMillionTokens",
DROP COLUMN "outputCostPerMillionTokens",
DROP COLUMN "providerOid",
ADD COLUMN     "capabilities" JSONB NOT NULL,
ADD COLUMN     "contextTokens" INTEGER,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "familySlug" TEXT,
ADD COLUMN     "inputModalities" TEXT[],
ADD COLUMN     "kind" TEXT NOT NULL,
ADD COLUMN     "labOid" BIGINT NOT NULL,
ADD COLUMN     "openWeights" BOOLEAN NOT NULL,
ADD COLUMN     "outputModalities" TEXT[],
ADD COLUMN     "outputTokens" INTEGER,
ADD COLUMN     "releaseDate" DATE,
ADD COLUMN     "removedAt" TIMESTAMP(3),
ADD COLUMN     "status" "ModelStatus" NOT NULL,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- DropTable
DROP TABLE "AssistantImplementation";

-- DropTable
DROP TABLE "Assistant";

-- DropTable
DROP TABLE "AssistantConfig";

-- DropTable
DROP TABLE "AssistantInstance";

-- DropTable
DROP TABLE "AssistantConversation";

-- DropTable
DROP TABLE "AssistantConversationParticipant";

-- DropTable
DROP TABLE "AssistantRequest";

-- DropTable
DROP TABLE "AssistantMessage";

-- DropTable
DROP TABLE "AssistantConversationItem";

-- DropTable
DROP TABLE "ModelProvider";

-- DropTable
DROP TABLE "ModelRun";

-- DropTable
DROP TABLE "SubspaceMcpConnection";

-- DropTable
DROP TABLE "SubspaceMcpToolCache";

-- DropTable
DROP TABLE "Tenant";

-- DropTable
DROP TABLE "Environment";

-- DropTable
DROP TABLE "TenantActor";

-- DropEnum
DROP TYPE "AssistantOwner";

-- DropEnum
DROP TYPE "AssistantRequestStatus";

-- DropEnum
DROP TYPE "AssistantMessageType";

-- DropEnum
DROP TYPE "AssistantMessageStatus";

-- DropEnum
DROP TYPE "AssistantRunStatus";

-- DropEnum
DROP TYPE "EnvironmentType";

-- DropEnum
DROP TYPE "TenantActorType";

-- CreateTable
CREATE TABLE "GatewayToken" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "consumerRef" TEXT,
    "allowedModels" TEXT[],
    "limits" JSONB NOT NULL DEFAULT '{}',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,

    CONSTRAINT "GatewayToken_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "CatalogSync" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "etag" TEXT,
    "fingerprint" TEXT,
    "lastError" TEXT,
    "counts" JSONB,
    "generatedAt" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogSync_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Lab" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "website" TEXT,
    "logo" TEXT,
    "status" "CatalogEntryStatus" NOT NULL,
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lab_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Provider" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "ProviderKind" NOT NULL,
    "website" TEXT,
    "docs" TEXT,
    "logo" TEXT,
    "status" "CatalogEntryStatus" NOT NULL,
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Provider_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ModelOffering" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "catalogId" TEXT NOT NULL,
    "vendorModelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ModelStatus" NOT NULL,
    "apis" TEXT[],
    "pricing" JSONB,
    "pricingHash" TEXT,
    "contextTokens" INTEGER,
    "outputTokens" INTEGER,
    "inputModalities" TEXT[],
    "outputModalities" TEXT[],
    "capabilities" JSONB NOT NULL,
    "variant" JSONB NOT NULL,
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "providerOid" BIGINT NOT NULL,
    "modelOid" BIGINT,

    CONSTRAINT "ModelOffering_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ModelAlias" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "catalogId" TEXT NOT NULL,
    "namespace" TEXT NOT NULL,
    "raw" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "modelOid" BIGINT NOT NULL,

    CONSTRAINT "ModelAlias_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderConnection" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "config" JSONB NOT NULL DEFAULT '{}',
    "features" JSONB NOT NULL DEFAULT '{}',
    "pricingOverride" JSONB,
    "nebulaSecretId" TEXT NOT NULL,
    "credentialHint" TEXT,
    "status" "ProviderConnectionStatus" NOT NULL DEFAULT 'pending',
    "statusMessage" TEXT,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "lastCheckedAt" TIMESTAMP(3),
    "lastValidAt" TIMESTAMP(3),
    "nextCheckAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "providerOid" BIGINT NOT NULL,
    "organizationOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,

    CONSTRAINT "ProviderConnection_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Organization" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "name" TEXT,
    "nebulaTenantId" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Project" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "name" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationOid" BIGINT NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Instance" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "name" TEXT,
    "logRetentionDays" INTEGER NOT NULL DEFAULT 90,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationOid" BIGINT NOT NULL,
    "projectOid" BIGINT NOT NULL,

    CONSTRAINT "Instance_pkey" PRIMARY KEY ("oid")
);

-- CreateIndex
CREATE UNIQUE INDEX "GatewayToken_id_key" ON "GatewayToken"("id");

-- CreateIndex
CREATE UNIQUE INDEX "GatewayToken_prefix_key" ON "GatewayToken"("prefix");

-- CreateIndex
CREATE INDEX "GatewayToken_organizationOid_idx" ON "GatewayToken"("organizationOid");

-- CreateIndex
CREATE INDEX "GatewayToken_instanceOid_idx" ON "GatewayToken"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogSync_id_key" ON "CatalogSync"("id");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogSync_url_key" ON "CatalogSync"("url");

-- CreateIndex
CREATE UNIQUE INDEX "Lab_id_key" ON "Lab"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Lab_slug_key" ON "Lab"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Provider_id_key" ON "Provider"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Provider_slug_key" ON "Provider"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ModelOffering_id_key" ON "ModelOffering"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ModelOffering_catalogId_key" ON "ModelOffering"("catalogId");

-- CreateIndex
CREATE INDEX "ModelOffering_providerOid_vendorModelId_idx" ON "ModelOffering"("providerOid", "vendorModelId");

-- CreateIndex
CREATE INDEX "ModelOffering_modelOid_idx" ON "ModelOffering"("modelOid");

-- CreateIndex
CREATE UNIQUE INDEX "ModelAlias_id_key" ON "ModelAlias"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ModelAlias_catalogId_key" ON "ModelAlias"("catalogId");

-- CreateIndex
CREATE INDEX "ModelAlias_raw_idx" ON "ModelAlias"("raw");

-- CreateIndex
CREATE INDEX "ModelAlias_key_idx" ON "ModelAlias"("key");

-- CreateIndex
CREATE INDEX "ModelAlias_modelOid_idx" ON "ModelAlias"("modelOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderConnection_id_key" ON "ProviderConnection"("id");

-- CreateIndex
CREATE INDEX "ProviderConnection_instanceOid_status_idx" ON "ProviderConnection"("instanceOid", "status");

-- CreateIndex
CREATE INDEX "ProviderConnection_organizationOid_idx" ON "ProviderConnection"("organizationOid");

-- CreateIndex
CREATE INDEX "ProviderConnection_providerOid_idx" ON "ProviderConnection"("providerOid");

-- CreateIndex
CREATE INDEX "ProviderConnection_nextCheckAt_idx" ON "ProviderConnection"("nextCheckAt");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_id_key" ON "Organization"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_ref_key" ON "Organization"("ref");

-- CreateIndex
CREATE UNIQUE INDEX "Project_id_key" ON "Project"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Project_ref_key" ON "Project"("ref");

-- CreateIndex
CREATE INDEX "Project_organizationOid_idx" ON "Project"("organizationOid");

-- CreateIndex
CREATE UNIQUE INDEX "Instance_id_key" ON "Instance"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Instance_ref_key" ON "Instance"("ref");

-- CreateIndex
CREATE INDEX "Instance_organizationOid_idx" ON "Instance"("organizationOid");

-- CreateIndex
CREATE INDEX "Instance_projectOid_idx" ON "Instance"("projectOid");

-- CreateIndex
CREATE UNIQUE INDEX "Model_slug_key" ON "Model"("slug");

-- CreateIndex
CREATE INDEX "Model_labOid_idx" ON "Model"("labOid");

-- CreateIndex
CREATE INDEX "Model_status_idx" ON "Model"("status");

-- AddForeignKey
ALTER TABLE "GatewayToken" ADD CONSTRAINT "GatewayToken_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GatewayToken" ADD CONSTRAINT "GatewayToken_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Model" ADD CONSTRAINT "Model_labOid_fkey" FOREIGN KEY ("labOid") REFERENCES "Lab"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelOffering" ADD CONSTRAINT "ModelOffering_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelOffering" ADD CONSTRAINT "ModelOffering_modelOid_fkey" FOREIGN KEY ("modelOid") REFERENCES "Model"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelAlias" ADD CONSTRAINT "ModelAlias_modelOid_fkey" FOREIGN KEY ("modelOid") REFERENCES "Model"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderConnection" ADD CONSTRAINT "ProviderConnection_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderConnection" ADD CONSTRAINT "ProviderConnection_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderConnection" ADD CONSTRAINT "ProviderConnection_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Instance" ADD CONSTRAINT "Instance_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Instance" ADD CONSTRAINT "Instance_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;
