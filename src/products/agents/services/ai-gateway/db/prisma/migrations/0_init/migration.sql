-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AssistantOwner" AS ENUM ('metorial', 'tenant');

-- CreateEnum
CREATE TYPE "AssistantRequestStatus" AS ENUM ('pending', 'waiting_for_user', 'completed', 'cancelled', 'failed');

-- CreateEnum
CREATE TYPE "AssistantMessageType" AS ENUM ('root', 'user', 'assistant');

-- CreateEnum
CREATE TYPE "AssistantMessageStatus" AS ENUM ('pending', 'waiting_for_user', 'completed');

-- CreateEnum
CREATE TYPE "AssistantRunStatus" AS ENUM ('pending', 'running', 'waiting_for_user', 'completed', 'cancelled', 'failed');

-- CreateEnum
CREATE TYPE "EnvironmentType" AS ENUM ('development', 'production');

-- CreateEnum
CREATE TYPE "TenantActorType" AS ENUM ('external', 'system');

-- CreateTable
CREATE TABLE "AssistantImplementation" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantImplementation_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Assistant" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "ownerType" "AssistantOwner" NOT NULL,
    "tenantOid" BIGINT,
    "implementationOid" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "systemIdentifier" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Assistant_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "AssistantConfig" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantConfig_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "AssistantInstance" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "assistantOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantInstance_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "AssistantConversation" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "title" TEXT,
    "input" JSONB,
    "assistantInstanceOid" BIGINT NOT NULL,
    "assistantOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "environmentOid" BIGINT NOT NULL,
    "createdByTenantActorOid" BIGINT NOT NULL,
    "rootMessageOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantConversation_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "AssistantConversationParticipant" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "conversationOid" BIGINT NOT NULL,
    "tenantActorOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantConversationParticipant_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "AssistantRequest" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "AssistantRequestStatus" NOT NULL,
    "conversationOid" BIGINT NOT NULL,
    "assistantInstanceOid" BIGINT NOT NULL,
    "assistantOid" BIGINT NOT NULL,
    "modelOid" BIGINT NOT NULL,
    "messageOid" BIGINT NOT NULL,
    "historySize" INTEGER,
    "tenantActorOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantRequest_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "AssistantMessage" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "AssistantMessageType" NOT NULL,
    "status" "AssistantMessageStatus" NOT NULL DEFAULT 'completed',
    "runOid" BIGINT,
    "requestOid" BIGINT,
    "assistantInstanceOid" BIGINT,
    "assistantOid" BIGINT,
    "parentMessageOid" BIGINT,
    "modelOid" BIGINT,
    "state" JSONB NOT NULL,
    "serialized" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantMessage_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "AssistantConversationItem" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "conversationOid" BIGINT NOT NULL,
    "messageOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantConversationItem_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Model" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "contextWindow" INTEGER NOT NULL,
    "inputCostPerMillionTokens" DOUBLE PRECISION NOT NULL,
    "outputCostPerMillionTokens" DOUBLE PRECISION NOT NULL,
    "providerOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Model_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ModelProvider" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModelProvider_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ModelRun" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "AssistantRunStatus" NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "requestOid" BIGINT,
    "conversationOid" BIGINT,
    "assistantInstanceOid" BIGINT,
    "assistantOid" BIGINT,
    "modelOid" BIGINT NOT NULL,
    "cost" JSONB NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModelRun_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SubspaceMcpConnection" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "solutionId" TEXT NOT NULL,
    "subspaceTenantId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "connectionToken" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3) NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "environmentOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubspaceMcpConnection_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SubspaceMcpToolCache" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "tools" JSONB NOT NULL,
    "cachedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubspaceMcpToolCache_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Tenant" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Environment" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "EnvironmentType" NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Environment_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "TenantActor" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "TenantActorType" NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organizationActorId" TEXT,
    "consumerId" TEXT,
    "tenantOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantActor_pkey" PRIMARY KEY ("oid")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssistantImplementation_id_key" ON "AssistantImplementation"("id");

-- CreateIndex
CREATE UNIQUE INDEX "AssistantImplementation_slug_key" ON "AssistantImplementation"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Assistant_id_key" ON "Assistant"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Assistant_slug_key" ON "Assistant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Assistant_systemIdentifier_key" ON "Assistant"("systemIdentifier");

-- CreateIndex
CREATE INDEX "Assistant_tenantOid_idx" ON "Assistant"("tenantOid");

-- CreateIndex
CREATE INDEX "Assistant_implementationOid_idx" ON "Assistant"("implementationOid");

-- CreateIndex
CREATE UNIQUE INDEX "AssistantConfig_id_key" ON "AssistantConfig"("id");

-- CreateIndex
CREATE UNIQUE INDEX "AssistantConfig_tenantOid_key" ON "AssistantConfig"("tenantOid");

-- CreateIndex
CREATE UNIQUE INDEX "AssistantInstance_id_key" ON "AssistantInstance"("id");

-- CreateIndex
CREATE INDEX "AssistantInstance_tenantOid_idx" ON "AssistantInstance"("tenantOid");

-- CreateIndex
CREATE UNIQUE INDEX "AssistantInstance_assistantOid_tenantOid_key" ON "AssistantInstance"("assistantOid", "tenantOid");

-- CreateIndex
CREATE UNIQUE INDEX "AssistantConversation_id_key" ON "AssistantConversation"("id");

-- CreateIndex
CREATE INDEX "AssistantConversation_tenantOid_environmentOid_idx" ON "AssistantConversation"("tenantOid", "environmentOid");

-- CreateIndex
CREATE INDEX "AssistantConversation_assistantOid_assistantInstanceOid_idx" ON "AssistantConversation"("assistantOid", "assistantInstanceOid");

-- CreateIndex
CREATE INDEX "AssistantConversation_createdByTenantActorOid_idx" ON "AssistantConversation"("createdByTenantActorOid");

-- CreateIndex
CREATE UNIQUE INDEX "AssistantConversationParticipant_id_key" ON "AssistantConversationParticipant"("id");

-- CreateIndex
CREATE INDEX "AssistantConversationParticipant_conversationOid_idx" ON "AssistantConversationParticipant"("conversationOid");

-- CreateIndex
CREATE INDEX "AssistantConversationParticipant_tenantActorOid_idx" ON "AssistantConversationParticipant"("tenantActorOid");

-- CreateIndex
CREATE UNIQUE INDEX "AssistantConversationParticipant_conversationOid_tenantActo_key" ON "AssistantConversationParticipant"("conversationOid", "tenantActorOid");

-- CreateIndex
CREATE UNIQUE INDEX "AssistantRequest_id_key" ON "AssistantRequest"("id");

-- CreateIndex
CREATE INDEX "AssistantRequest_conversationOid_status_idx" ON "AssistantRequest"("conversationOid", "status");

-- CreateIndex
CREATE INDEX "AssistantRequest_assistantInstanceOid_idx" ON "AssistantRequest"("assistantInstanceOid");

-- CreateIndex
CREATE INDEX "AssistantRequest_tenantActorOid_idx" ON "AssistantRequest"("tenantActorOid");

-- CreateIndex
CREATE UNIQUE INDEX "AssistantMessage_id_key" ON "AssistantMessage"("id");

-- CreateIndex
CREATE INDEX "AssistantMessage_runOid_idx" ON "AssistantMessage"("runOid");

-- CreateIndex
CREATE INDEX "AssistantMessage_requestOid_idx" ON "AssistantMessage"("requestOid");

-- CreateIndex
CREATE INDEX "AssistantMessage_assistantInstanceOid_idx" ON "AssistantMessage"("assistantInstanceOid");

-- CreateIndex
CREATE INDEX "AssistantMessage_assistantOid_idx" ON "AssistantMessage"("assistantOid");

-- CreateIndex
CREATE INDEX "AssistantMessage_parentMessageOid_idx" ON "AssistantMessage"("parentMessageOid");

-- CreateIndex
CREATE UNIQUE INDEX "AssistantConversationItem_id_key" ON "AssistantConversationItem"("id");

-- CreateIndex
CREATE INDEX "AssistantConversationItem_conversationOid_idx" ON "AssistantConversationItem"("conversationOid");

-- CreateIndex
CREATE INDEX "AssistantConversationItem_messageOid_idx" ON "AssistantConversationItem"("messageOid");

-- CreateIndex
CREATE UNIQUE INDEX "Model_id_key" ON "Model"("id");

-- CreateIndex
CREATE INDEX "Model_providerOid_idx" ON "Model"("providerOid");

-- CreateIndex
CREATE UNIQUE INDEX "Model_slug_providerOid_key" ON "Model"("slug", "providerOid");

-- CreateIndex
CREATE UNIQUE INDEX "ModelProvider_id_key" ON "ModelProvider"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ModelProvider_slug_key" ON "ModelProvider"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ModelRun_id_key" ON "ModelRun"("id");

-- CreateIndex
CREATE INDEX "ModelRun_requestOid_idx" ON "ModelRun"("requestOid");

-- CreateIndex
CREATE INDEX "ModelRun_conversationOid_status_idx" ON "ModelRun"("conversationOid", "status");

-- CreateIndex
CREATE INDEX "ModelRun_assistantInstanceOid_idx" ON "ModelRun"("assistantInstanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "SubspaceMcpConnection_id_key" ON "SubspaceMcpConnection"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SubspaceMcpConnection_connectionId_key" ON "SubspaceMcpConnection"("connectionId");

-- CreateIndex
CREATE INDEX "SubspaceMcpConnection_tenantOid_environmentOid_idx" ON "SubspaceMcpConnection"("tenantOid", "environmentOid");

-- CreateIndex
CREATE INDEX "SubspaceMcpConnection_lastUsedAt_idx" ON "SubspaceMcpConnection"("lastUsedAt");

-- CreateIndex
CREATE INDEX "SubspaceMcpConnection_createdAt_idx" ON "SubspaceMcpConnection"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SubspaceMcpConnection_tenantOid_environmentOid_sessionId_key" ON "SubspaceMcpConnection"("tenantOid", "environmentOid", "sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "SubspaceMcpToolCache_id_key" ON "SubspaceMcpToolCache"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SubspaceMcpToolCache_connectionId_key" ON "SubspaceMcpToolCache"("connectionId");

-- CreateIndex
CREATE INDEX "SubspaceMcpToolCache_expiresAt_idx" ON "SubspaceMcpToolCache"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_id_key" ON "Tenant"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_identifier_key" ON "Tenant"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "Environment_id_key" ON "Environment"("id");

-- CreateIndex
CREATE INDEX "Environment_tenantOid_idx" ON "Environment"("tenantOid");

-- CreateIndex
CREATE UNIQUE INDEX "Environment_tenantOid_identifier_key" ON "Environment"("tenantOid", "identifier");

-- CreateIndex
CREATE UNIQUE INDEX "TenantActor_id_key" ON "TenantActor"("id");

-- CreateIndex
CREATE INDEX "TenantActor_tenantOid_idx" ON "TenantActor"("tenantOid");

-- CreateIndex
CREATE UNIQUE INDEX "TenantActor_tenantOid_identifier_key" ON "TenantActor"("tenantOid", "identifier");

-- AddForeignKey
ALTER TABLE "Assistant" ADD CONSTRAINT "Assistant_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assistant" ADD CONSTRAINT "Assistant_implementationOid_fkey" FOREIGN KEY ("implementationOid") REFERENCES "AssistantImplementation"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantConfig" ADD CONSTRAINT "AssistantConfig_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantInstance" ADD CONSTRAINT "AssistantInstance_assistantOid_fkey" FOREIGN KEY ("assistantOid") REFERENCES "Assistant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantInstance" ADD CONSTRAINT "AssistantInstance_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantConversation" ADD CONSTRAINT "AssistantConversation_assistantInstanceOid_fkey" FOREIGN KEY ("assistantInstanceOid") REFERENCES "AssistantInstance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantConversation" ADD CONSTRAINT "AssistantConversation_assistantOid_fkey" FOREIGN KEY ("assistantOid") REFERENCES "Assistant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantConversation" ADD CONSTRAINT "AssistantConversation_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantConversation" ADD CONSTRAINT "AssistantConversation_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantConversation" ADD CONSTRAINT "AssistantConversation_createdByTenantActorOid_fkey" FOREIGN KEY ("createdByTenantActorOid") REFERENCES "TenantActor"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantConversation" ADD CONSTRAINT "AssistantConversation_rootMessageOid_fkey" FOREIGN KEY ("rootMessageOid") REFERENCES "AssistantMessage"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantConversationParticipant" ADD CONSTRAINT "AssistantConversationParticipant_conversationOid_fkey" FOREIGN KEY ("conversationOid") REFERENCES "AssistantConversation"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantConversationParticipant" ADD CONSTRAINT "AssistantConversationParticipant_tenantActorOid_fkey" FOREIGN KEY ("tenantActorOid") REFERENCES "TenantActor"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantRequest" ADD CONSTRAINT "AssistantRequest_conversationOid_fkey" FOREIGN KEY ("conversationOid") REFERENCES "AssistantConversation"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantRequest" ADD CONSTRAINT "AssistantRequest_assistantInstanceOid_fkey" FOREIGN KEY ("assistantInstanceOid") REFERENCES "AssistantInstance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantRequest" ADD CONSTRAINT "AssistantRequest_assistantOid_fkey" FOREIGN KEY ("assistantOid") REFERENCES "Assistant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantRequest" ADD CONSTRAINT "AssistantRequest_modelOid_fkey" FOREIGN KEY ("modelOid") REFERENCES "Model"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantRequest" ADD CONSTRAINT "AssistantRequest_messageOid_fkey" FOREIGN KEY ("messageOid") REFERENCES "AssistantMessage"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantRequest" ADD CONSTRAINT "AssistantRequest_tenantActorOid_fkey" FOREIGN KEY ("tenantActorOid") REFERENCES "TenantActor"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantMessage" ADD CONSTRAINT "AssistantMessage_runOid_fkey" FOREIGN KEY ("runOid") REFERENCES "ModelRun"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantMessage" ADD CONSTRAINT "AssistantMessage_requestOid_fkey" FOREIGN KEY ("requestOid") REFERENCES "AssistantRequest"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantMessage" ADD CONSTRAINT "AssistantMessage_assistantInstanceOid_fkey" FOREIGN KEY ("assistantInstanceOid") REFERENCES "AssistantInstance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantMessage" ADD CONSTRAINT "AssistantMessage_assistantOid_fkey" FOREIGN KEY ("assistantOid") REFERENCES "Assistant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantMessage" ADD CONSTRAINT "AssistantMessage_parentMessageOid_fkey" FOREIGN KEY ("parentMessageOid") REFERENCES "AssistantMessage"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantMessage" ADD CONSTRAINT "AssistantMessage_modelOid_fkey" FOREIGN KEY ("modelOid") REFERENCES "Model"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantConversationItem" ADD CONSTRAINT "AssistantConversationItem_conversationOid_fkey" FOREIGN KEY ("conversationOid") REFERENCES "AssistantConversation"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantConversationItem" ADD CONSTRAINT "AssistantConversationItem_messageOid_fkey" FOREIGN KEY ("messageOid") REFERENCES "AssistantMessage"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Model" ADD CONSTRAINT "Model_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "ModelProvider"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelRun" ADD CONSTRAINT "ModelRun_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelRun" ADD CONSTRAINT "ModelRun_requestOid_fkey" FOREIGN KEY ("requestOid") REFERENCES "AssistantRequest"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelRun" ADD CONSTRAINT "ModelRun_conversationOid_fkey" FOREIGN KEY ("conversationOid") REFERENCES "AssistantConversation"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelRun" ADD CONSTRAINT "ModelRun_assistantInstanceOid_fkey" FOREIGN KEY ("assistantInstanceOid") REFERENCES "AssistantInstance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelRun" ADD CONSTRAINT "ModelRun_assistantOid_fkey" FOREIGN KEY ("assistantOid") REFERENCES "Assistant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelRun" ADD CONSTRAINT "ModelRun_modelOid_fkey" FOREIGN KEY ("modelOid") REFERENCES "Model"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubspaceMcpConnection" ADD CONSTRAINT "SubspaceMcpConnection_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubspaceMcpConnection" ADD CONSTRAINT "SubspaceMcpConnection_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Environment" ADD CONSTRAINT "Environment_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantActor" ADD CONSTRAINT "TenantActor_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

