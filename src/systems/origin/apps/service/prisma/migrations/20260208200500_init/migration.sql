-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ChangeNotificationType" AS ENUM ('repo_push');

-- CreateEnum
CREATE TYPE "CodeBucketStatus" AS ENUM ('ready', 'importing');

-- CreateEnum
CREATE TYPE "ScmProvider" AS ENUM ('github', 'gitlab');

-- CreateEnum
CREATE TYPE "ScmAccountType" AS ENUM ('user', 'organization');

-- CreateEnum
CREATE TYPE "ScmRepositoryWebhookType" AS ENUM ('push');

-- CreateEnum
CREATE TYPE "ScmBackendType" AS ENUM ('github', 'github_enterprise', 'gitlab', 'gitlab_selfhosted');

-- CreateTable
CREATE TABLE "ChangeNotification" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "type" "ChangeNotificationType" NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "repoOid" BIGINT NOT NULL,
    "repoPushOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChangeNotification_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "CodeBucketPurpose" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CodeBucketPurpose_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "CodeBucket" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "purposeOid" BIGINT NOT NULL,
    "status" "CodeBucketStatus" NOT NULL DEFAULT 'ready',
    "isReadOnly" BOOLEAN NOT NULL DEFAULT false,
    "tenantOid" BIGINT NOT NULL,
    "parentOid" BIGINT,
    "templateOid" BIGINT,
    "repositoryOid" BIGINT,
    "path" TEXT,
    "isSynced" BOOLEAN NOT NULL DEFAULT false,
    "syncRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CodeBucket_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "CodeBucketTemplate" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contents" JSONB NOT NULL,
    "providerBucketOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CodeBucketTemplate_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ScmAccount" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "provider" "ScmProvider" NOT NULL,
    "type" "ScmAccountType" NOT NULL,
    "name" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "backendOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScmAccount_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ScmRepository" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "provider" "ScmProvider" NOT NULL,
    "name" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "externalName" TEXT NOT NULL,
    "externalOwner" TEXT NOT NULL,
    "externalUrl" TEXT NOT NULL,
    "externalIsPrivate" BOOLEAN NOT NULL,
    "defaultBranch" TEXT NOT NULL DEFAULT 'main',
    "backendOid" BIGINT NOT NULL,
    "accountOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "installationOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScmRepository_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ScmInstallation" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "provider" "ScmProvider" NOT NULL,
    "backendOid" BIGINT NOT NULL,
    "ownerActorOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "externalInstallationId" TEXT,
    "accountType" "ScmAccountType",
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "externalAccountId" TEXT NOT NULL,
    "externalAccountLogin" TEXT NOT NULL,
    "externalAccountName" TEXT,
    "externalAccountEmail" TEXT,
    "externalAccountImageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScmInstallation_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ScmRepositoryWebhook" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "type" "ScmRepositoryWebhookType" NOT NULL,
    "repoOid" BIGINT NOT NULL,
    "externalId" TEXT NOT NULL,
    "signingSecret" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScmRepositoryWebhook_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ScmRepositoryWebhookReceivedEvent" (
    "oid" BIGSERIAL NOT NULL,
    "webhookOid" BIGINT NOT NULL,
    "idempotencyKey" TEXT,
    "eventType" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScmRepositoryWebhookReceivedEvent_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ScmRepositoryPush" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "repoOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "pusherName" TEXT,
    "pusherEmail" TEXT,
    "senderIdentifier" TEXT,
    "commitMessage" TEXT,
    "branchName" TEXT NOT NULL,
    "sha" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScmRepositoryPush_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ScmBackend" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "type" "ScmBackendType" NOT NULL,
    "defaultIdentifier" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "apiUrl" TEXT NOT NULL,
    "webUrl" TEXT NOT NULL,
    "appId" TEXT,
    "appSlug" TEXT,
    "appPrivateKey" TEXT,
    "clientId" TEXT,
    "clientSecret" TEXT,
    "tenantOid" BIGINT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScmBackend_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ScmInstallationSession" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "ownerActorOid" BIGINT NOT NULL,
    "installationOid" BIGINT,
    "redirectUrl" TEXT,
    "state" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScmInstallationSession_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ScmBackendSetupSession" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "backendOid" BIGINT,
    "parentInstallationSessionOid" BIGINT,
    "type" "ScmBackendType" NOT NULL,
    "redirectUrl" TEXT,
    "state" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScmBackendSetupSession_pkey" PRIMARY KEY ("oid")
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
CREATE TABLE "Actor" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Actor_pkey" PRIMARY KEY ("oid")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChangeNotification_id_key" ON "ChangeNotification"("id");

-- CreateIndex
CREATE UNIQUE INDEX "CodeBucketPurpose_id_key" ON "CodeBucketPurpose"("id");

-- CreateIndex
CREATE UNIQUE INDEX "CodeBucketPurpose_identifier_key" ON "CodeBucketPurpose"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "CodeBucket_id_key" ON "CodeBucket"("id");

-- CreateIndex
CREATE UNIQUE INDEX "CodeBucketTemplate_id_key" ON "CodeBucketTemplate"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ScmAccount_id_key" ON "ScmAccount"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ScmAccount_tenantOid_backendOid_externalId_key" ON "ScmAccount"("tenantOid", "backendOid", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "ScmRepository_id_key" ON "ScmRepository"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ScmRepository_tenantOid_backendOid_externalId_key" ON "ScmRepository"("tenantOid", "backendOid", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "ScmInstallation_id_key" ON "ScmInstallation"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ScmInstallation_tenantOid_provider_backendOid_externalAccou_key" ON "ScmInstallation"("tenantOid", "provider", "backendOid", "externalAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "ScmRepositoryWebhook_id_key" ON "ScmRepositoryWebhook"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ScmRepositoryWebhook_repoOid_key" ON "ScmRepositoryWebhook"("repoOid");

-- CreateIndex
CREATE UNIQUE INDEX "ScmRepositoryPush_id_key" ON "ScmRepositoryPush"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ScmBackend_id_key" ON "ScmBackend"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ScmBackend_defaultIdentifier_key" ON "ScmBackend"("defaultIdentifier");

-- CreateIndex
CREATE UNIQUE INDEX "ScmInstallationSession_id_key" ON "ScmInstallationSession"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ScmInstallationSession_installationOid_key" ON "ScmInstallationSession"("installationOid");

-- CreateIndex
CREATE UNIQUE INDEX "ScmInstallationSession_state_key" ON "ScmInstallationSession"("state");

-- CreateIndex
CREATE INDEX "ScmInstallationSession_tenantOid_idx" ON "ScmInstallationSession"("tenantOid");

-- CreateIndex
CREATE INDEX "ScmInstallationSession_state_idx" ON "ScmInstallationSession"("state");

-- CreateIndex
CREATE UNIQUE INDEX "ScmBackendSetupSession_id_key" ON "ScmBackendSetupSession"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ScmBackendSetupSession_backendOid_key" ON "ScmBackendSetupSession"("backendOid");

-- CreateIndex
CREATE UNIQUE INDEX "ScmBackendSetupSession_state_key" ON "ScmBackendSetupSession"("state");

-- CreateIndex
CREATE INDEX "ScmBackendSetupSession_tenantOid_idx" ON "ScmBackendSetupSession"("tenantOid");

-- CreateIndex
CREATE INDEX "ScmBackendSetupSession_state_idx" ON "ScmBackendSetupSession"("state");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_id_key" ON "Tenant"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_identifier_key" ON "Tenant"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "Actor_id_key" ON "Actor"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Actor_identifier_key" ON "Actor"("identifier");

-- AddForeignKey
ALTER TABLE "ChangeNotification" ADD CONSTRAINT "ChangeNotification_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeNotification" ADD CONSTRAINT "ChangeNotification_repoOid_fkey" FOREIGN KEY ("repoOid") REFERENCES "ScmRepository"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeNotification" ADD CONSTRAINT "ChangeNotification_repoPushOid_fkey" FOREIGN KEY ("repoPushOid") REFERENCES "ScmRepositoryPush"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodeBucket" ADD CONSTRAINT "CodeBucket_purposeOid_fkey" FOREIGN KEY ("purposeOid") REFERENCES "CodeBucketPurpose"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodeBucket" ADD CONSTRAINT "CodeBucket_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodeBucket" ADD CONSTRAINT "CodeBucket_parentOid_fkey" FOREIGN KEY ("parentOid") REFERENCES "CodeBucket"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodeBucket" ADD CONSTRAINT "CodeBucket_templateOid_fkey" FOREIGN KEY ("templateOid") REFERENCES "CodeBucketTemplate"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodeBucket" ADD CONSTRAINT "CodeBucket_repositoryOid_fkey" FOREIGN KEY ("repositoryOid") REFERENCES "ScmRepository"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodeBucketTemplate" ADD CONSTRAINT "CodeBucketTemplate_providerBucketOid_fkey" FOREIGN KEY ("providerBucketOid") REFERENCES "CodeBucket"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScmAccount" ADD CONSTRAINT "ScmAccount_backendOid_fkey" FOREIGN KEY ("backendOid") REFERENCES "ScmBackend"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScmAccount" ADD CONSTRAINT "ScmAccount_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScmRepository" ADD CONSTRAINT "ScmRepository_backendOid_fkey" FOREIGN KEY ("backendOid") REFERENCES "ScmBackend"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScmRepository" ADD CONSTRAINT "ScmRepository_accountOid_fkey" FOREIGN KEY ("accountOid") REFERENCES "ScmAccount"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScmRepository" ADD CONSTRAINT "ScmRepository_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScmRepository" ADD CONSTRAINT "ScmRepository_installationOid_fkey" FOREIGN KEY ("installationOid") REFERENCES "ScmInstallation"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScmInstallation" ADD CONSTRAINT "ScmInstallation_backendOid_fkey" FOREIGN KEY ("backendOid") REFERENCES "ScmBackend"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScmInstallation" ADD CONSTRAINT "ScmInstallation_ownerActorOid_fkey" FOREIGN KEY ("ownerActorOid") REFERENCES "Actor"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScmInstallation" ADD CONSTRAINT "ScmInstallation_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScmRepositoryWebhook" ADD CONSTRAINT "ScmRepositoryWebhook_repoOid_fkey" FOREIGN KEY ("repoOid") REFERENCES "ScmRepository"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScmRepositoryWebhookReceivedEvent" ADD CONSTRAINT "ScmRepositoryWebhookReceivedEvent_webhookOid_fkey" FOREIGN KEY ("webhookOid") REFERENCES "ScmRepositoryWebhook"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScmRepositoryPush" ADD CONSTRAINT "ScmRepositoryPush_repoOid_fkey" FOREIGN KEY ("repoOid") REFERENCES "ScmRepository"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScmRepositoryPush" ADD CONSTRAINT "ScmRepositoryPush_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScmBackend" ADD CONSTRAINT "ScmBackend_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScmInstallationSession" ADD CONSTRAINT "ScmInstallationSession_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScmInstallationSession" ADD CONSTRAINT "ScmInstallationSession_ownerActorOid_fkey" FOREIGN KEY ("ownerActorOid") REFERENCES "Actor"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScmInstallationSession" ADD CONSTRAINT "ScmInstallationSession_installationOid_fkey" FOREIGN KEY ("installationOid") REFERENCES "ScmInstallation"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScmBackendSetupSession" ADD CONSTRAINT "ScmBackendSetupSession_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScmBackendSetupSession" ADD CONSTRAINT "ScmBackendSetupSession_backendOid_fkey" FOREIGN KEY ("backendOid") REFERENCES "ScmBackend"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScmBackendSetupSession" ADD CONSTRAINT "ScmBackendSetupSession_parentInstallationSessionOid_fkey" FOREIGN KEY ("parentInstallationSessionOid") REFERENCES "ScmInstallationSession"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

