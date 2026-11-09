-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ChangeNotificationType" AS ENUM ('repo_push', 'repository_sync_status_changed');

-- CreateEnum
CREATE TYPE "CodeBucketStatus" AS ENUM ('ready', 'importing', 'failed');

-- CreateEnum
CREATE TYPE "ScmProvider" AS ENUM ('github', 'gitlab', 'bitbucket');

-- CreateEnum
CREATE TYPE "ScmRepositorySyncStatus" AS ENUM ('pending', 'creating_branch', 'syncing_contents', 'creating_pr', 'waiting_for_ci', 'waiting_for_review', 'merging', 'merged', 'failed', 'cancelled', 'complete_unmerged', 'complete_direct_push', 'complete_no_changes');

-- CreateEnum
CREATE TYPE "ScmRepositoryAccessMode" AS ENUM ('pull_request', 'default_branch');

-- CreateEnum
CREATE TYPE "ScmAccountType" AS ENUM ('user', 'organization');

-- CreateEnum
CREATE TYPE "ScmRepositorySyncSourceType" AS ENUM ('code_bucket', 'manifest');

-- CreateEnum
CREATE TYPE "ScmRepositoryWebhookType" AS ENUM ('push');

-- CreateEnum
CREATE TYPE "ScmRepositoryWebhookEvent" AS ENUM ('push', 'pull_request', 'pull_request_review', 'ci_status', 'ci_check');

-- CreateEnum
CREATE TYPE "ScmBackendType" AS ENUM ('github', 'github_enterprise', 'gitlab', 'gitlab_selfhosted', 'bitbucket', 'bitbucket_data_center');

-- CreateEnum
CREATE TYPE "ScmInstallationSessionStatus" AS ENUM ('pending', 'pending_approval', 'succeeded');

-- CreateTable
CREATE TABLE "ChangeNotification" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "type" "ChangeNotificationType" NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "repoOid" BIGINT NOT NULL,
    "repoPushOid" BIGINT,
    "repositorySyncOid" BIGINT,
    "materialHash" TEXT,
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
    "errorMessage" TEXT,
    "isReadOnly" BOOLEAN NOT NULL DEFAULT false,
    "tenantOid" BIGINT NOT NULL,
    "parentOid" BIGINT,
    "templateOid" BIGINT,
    "repositoryOid" BIGINT,
    "path" TEXT,
    "isSynced" BOOLEAN NOT NULL DEFAULT false,
    "syncRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

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
    "webhookReconcileBlockedUntil" TIMESTAMP(3),
    "webhookReconcileBlockedReason" TEXT,
    "webhookReconciledAt" TIMESTAMP(3),
    "backendOid" BIGINT NOT NULL,
    "accountOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "installationOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScmRepository_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ScmRepositorySync" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "ScmRepositorySyncStatus" NOT NULL DEFAULT 'pending',
    "repositoryAccessMode" "ScmRepositoryAccessMode" NOT NULL DEFAULT 'pull_request',
    "requestKey" TEXT,
    "endReason" TEXT,
    "sourceType" "ScmRepositorySyncSourceType" NOT NULL DEFAULT 'code_bucket',
    "sourceKey" TEXT,
    "manifestBucket" TEXT,
    "manifestKey" TEXT,
    "manifestSha256" TEXT,
    "manifestEntryCount" INTEGER,
    "previousManifestBucket" TEXT,
    "previousManifestKey" TEXT,
    "previousManifestSha256" TEXT,
    "deletionGuard" JSONB,
    "allowMassDelete" BOOLEAN NOT NULL DEFAULT false,
    "branchName" TEXT NOT NULL,
    "requestedBranchName" TEXT,
    "baseBranch" TEXT NOT NULL,
    "baseCommitSha" TEXT,
    "lastPushedCommitSha" TEXT,
    "foreignCommitsOnBranch" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "enableAutoMerge" BOOLEAN NOT NULL DEFAULT true,
    "forceMergeOrPush" BOOLEAN NOT NULL DEFAULT false,
    "mergeBeforeChecksPass" BOOLEAN NOT NULL DEFAULT false,
    "deletePaths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "explicitDeletesOnly" BOOLEAN NOT NULL DEFAULT false,
    "gitLfsThresholdBytes" INTEGER,
    "providerPrId" TEXT,
    "providerPrUrl" TEXT,
    "providerMergeSha" TEXT,
    "mergeAttemptSnapshotHashes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "errorMessage" TEXT,
    "errorCode" TEXT,
    "errorDetails" JSONB,
    "waitingReason" TEXT,
    "ciState" TEXT,
    "statusSnapshot" JSONB,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "noProgressSliceCount" INTEGER NOT NULL DEFAULT 0,
    "logs" JSONB[] DEFAULT ARRAY[]::JSONB[],
    "resultStats" JSONB,
    "lastPolledAt" TIMESTAMP(3),
    "nextPollAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "continuedFromSyncOid" BIGINT,
    "supersededBySyncOid" BIGINT,
    "repoOid" BIGINT NOT NULL,
    "codeBucketOid" BIGINT,
    "tenantOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScmRepositorySync_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ScmRepositoryRemoteState" (
    "oid" BIGSERIAL NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "commitSha" TEXT NOT NULL,
    "treeSha" TEXT NOT NULL,
    "listingKey" TEXT NOT NULL,
    "entryCount" INTEGER NOT NULL,
    "repoOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScmRepositoryRemoteState_pkey" PRIMARY KEY ("oid")
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
    "tokensNebulaSecretId" TEXT,
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
    "registeredEvents" "ScmRepositoryWebhookEvent"[] DEFAULT ARRAY[]::"ScmRepositoryWebhookEvent"[],
    "signingSecret" TEXT,
    "signingSecretNebulaSecretId" TEXT,
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
    "webhookReceivedEventOid" BIGINT,
    "webhookDispatchedAt" TIMESTAMP(3),
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
    "appWebhookSecret" TEXT,
    "appPrivateKey" TEXT,
    "appWebhookSecretNebulaSecretId" TEXT,
    "appPrivateKeyNebulaSecretId" TEXT,
    "clientId" TEXT,
    "clientSecret" TEXT,
    "clientSecretNebulaSecretId" TEXT,
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
    "selectedBackendOid" BIGINT,
    "redirectUrl" TEXT,
    "status" "ScmInstallationSessionStatus" NOT NULL DEFAULT 'pending',
    "state" TEXT NOT NULL,
    "githubInstallationRequestId" TEXT,
    "githubPendingAccountId" TEXT,
    "githubPendingAccountLogin" TEXT,
    "githubPendingAccountType" "ScmAccountType",
    "githubPendingRequesterId" TEXT,
    "githubPendingApprovalAt" TIMESTAMP(3),
    "githubInstallationRequestBaselineIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
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
    "nebulaTenantId" TEXT,
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
CREATE INDEX "ChangeNotification_tenantOid_oid_idx" ON "ChangeNotification"("tenantOid", "oid");

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
CREATE INDEX "ScmRepository_webhookReconcileBlockedUntil_oid_idx" ON "ScmRepository"("webhookReconcileBlockedUntil", "oid");

-- CreateIndex
CREATE INDEX "ScmRepository_webhookReconciledAt_oid_idx" ON "ScmRepository"("webhookReconciledAt", "oid");

-- CreateIndex
CREATE UNIQUE INDEX "ScmRepository_tenantOid_backendOid_externalId_key" ON "ScmRepository"("tenantOid", "backendOid", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "ScmRepositorySync_id_key" ON "ScmRepositorySync"("id");

-- CreateIndex
CREATE INDEX "ScmRepositorySync_tenantOid_idx" ON "ScmRepositorySync"("tenantOid");

-- CreateIndex
CREATE INDEX "ScmRepositorySync_repoOid_idx" ON "ScmRepositorySync"("repoOid");

-- CreateIndex
CREATE INDEX "ScmRepositorySync_repoOid_repositoryAccessMode_status_idx" ON "ScmRepositorySync"("repoOid", "repositoryAccessMode", "status");

-- CreateIndex
CREATE INDEX "ScmRepositorySync_codeBucketOid_idx" ON "ScmRepositorySync"("codeBucketOid");

-- CreateIndex
CREATE INDEX "ScmRepositorySync_repoOid_sourceKey_baseBranch_oid_idx" ON "ScmRepositorySync"("repoOid", "sourceKey", "baseBranch", "oid");

-- CreateIndex
CREATE INDEX "ScmRepositorySync_status_idx" ON "ScmRepositorySync"("status");

-- CreateIndex
CREATE INDEX "ScmRepositorySync_status_nextPollAt_idx" ON "ScmRepositorySync"("status", "nextPollAt");

-- CreateIndex
CREATE INDEX "ScmRepositorySync_supersededBySyncOid_idx" ON "ScmRepositorySync"("supersededBySyncOid");

-- CreateIndex
CREATE INDEX "ScmRepositorySync_createdAt_idx" ON "ScmRepositorySync"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ScmRepositorySync_tenantOid_requestKey_key" ON "ScmRepositorySync"("tenantOid", "requestKey");

-- CreateIndex
CREATE INDEX "ScmRepositoryRemoteState_updatedAt_idx" ON "ScmRepositoryRemoteState"("updatedAt");

-- CreateIndex
CREATE INDEX "ScmRepositoryRemoteState_listingKey_idx" ON "ScmRepositoryRemoteState"("listingKey");

-- CreateIndex
CREATE UNIQUE INDEX "ScmRepositoryRemoteState_repoOid_sourceKey_branch_key" ON "ScmRepositoryRemoteState"("repoOid", "sourceKey", "branch");

-- CreateIndex
CREATE UNIQUE INDEX "ScmInstallation_id_key" ON "ScmInstallation"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ScmInstallation_tenantOid_provider_backendOid_externalAccou_key" ON "ScmInstallation"("tenantOid", "provider", "backendOid", "externalAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "ScmRepositoryWebhook_id_key" ON "ScmRepositoryWebhook"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ScmRepositoryWebhook_repoOid_key" ON "ScmRepositoryWebhook"("repoOid");

-- CreateIndex
CREATE INDEX "ScmRepositoryWebhookReceivedEvent_createdAt_idx" ON "ScmRepositoryWebhookReceivedEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ScmRepositoryWebhookReceivedEvent_webhookOid_idempotencyKey_key" ON "ScmRepositoryWebhookReceivedEvent"("webhookOid", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "ScmRepositoryPush_id_key" ON "ScmRepositoryPush"("id");

-- CreateIndex
CREATE INDEX "ScmRepositoryPush_webhookReceivedEventOid_idx" ON "ScmRepositoryPush"("webhookReceivedEventOid");

-- CreateIndex
CREATE UNIQUE INDEX "ScmBackend_id_key" ON "ScmBackend"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ScmBackend_defaultIdentifier_key" ON "ScmBackend"("defaultIdentifier");

-- CreateIndex
CREATE UNIQUE INDEX "ScmInstallationSession_id_key" ON "ScmInstallationSession"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ScmInstallationSession_state_key" ON "ScmInstallationSession"("state");

-- CreateIndex
CREATE INDEX "ScmInstallationSession_tenantOid_idx" ON "ScmInstallationSession"("tenantOid");

-- CreateIndex
CREATE INDEX "ScmInstallationSession_installationOid_idx" ON "ScmInstallationSession"("installationOid");

-- CreateIndex
CREATE INDEX "ScmInstallationSession_selectedBackendOid_idx" ON "ScmInstallationSession"("selectedBackendOid");

-- CreateIndex
CREATE INDEX "ScmInstallationSession_status_selectedBackendOid_githubPend_idx" ON "ScmInstallationSession"("status", "selectedBackendOid", "githubPendingAccountId");

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
ALTER TABLE "ChangeNotification" ADD CONSTRAINT "ChangeNotification_repositorySyncOid_fkey" FOREIGN KEY ("repositorySyncOid") REFERENCES "ScmRepositorySync"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE "ScmRepositorySync" ADD CONSTRAINT "ScmRepositorySync_continuedFromSyncOid_fkey" FOREIGN KEY ("continuedFromSyncOid") REFERENCES "ScmRepositorySync"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScmRepositorySync" ADD CONSTRAINT "ScmRepositorySync_supersededBySyncOid_fkey" FOREIGN KEY ("supersededBySyncOid") REFERENCES "ScmRepositorySync"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScmRepositorySync" ADD CONSTRAINT "ScmRepositorySync_repoOid_fkey" FOREIGN KEY ("repoOid") REFERENCES "ScmRepository"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScmRepositorySync" ADD CONSTRAINT "ScmRepositorySync_codeBucketOid_fkey" FOREIGN KEY ("codeBucketOid") REFERENCES "CodeBucket"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScmRepositorySync" ADD CONSTRAINT "ScmRepositorySync_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScmRepositoryRemoteState" ADD CONSTRAINT "ScmRepositoryRemoteState_repoOid_fkey" FOREIGN KEY ("repoOid") REFERENCES "ScmRepository"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "ScmRepositoryPush" ADD CONSTRAINT "ScmRepositoryPush_webhookReceivedEventOid_fkey" FOREIGN KEY ("webhookReceivedEventOid") REFERENCES "ScmRepositoryWebhookReceivedEvent"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScmBackend" ADD CONSTRAINT "ScmBackend_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScmInstallationSession" ADD CONSTRAINT "ScmInstallationSession_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScmInstallationSession" ADD CONSTRAINT "ScmInstallationSession_ownerActorOid_fkey" FOREIGN KEY ("ownerActorOid") REFERENCES "Actor"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScmInstallationSession" ADD CONSTRAINT "ScmInstallationSession_installationOid_fkey" FOREIGN KEY ("installationOid") REFERENCES "ScmInstallation"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScmInstallationSession" ADD CONSTRAINT "ScmInstallationSession_selectedBackendOid_fkey" FOREIGN KEY ("selectedBackendOid") REFERENCES "ScmBackend"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScmBackendSetupSession" ADD CONSTRAINT "ScmBackendSetupSession_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScmBackendSetupSession" ADD CONSTRAINT "ScmBackendSetupSession_backendOid_fkey" FOREIGN KEY ("backendOid") REFERENCES "ScmBackend"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScmBackendSetupSession" ADD CONSTRAINT "ScmBackendSetupSession_parentInstallationSessionOid_fkey" FOREIGN KEY ("parentInstallationSessionOid") REFERENCES "ScmInstallationSession"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

