-- CreateEnum
CREATE TYPE "ProviderIssueType" AS ENUM ('provider_error', 'auth_error', 'protoguard_warning');

-- CreateEnum
CREATE TYPE "ProviderIssueSeverity" AS ENUM ('warning', 'error', 'critical');

-- CreateEnum
CREATE TYPE "SecurityReviewSubjectType" AS ENUM ('slate_version', 'custom_provider_version', 'skill_version', 'provider_usage');

-- CreateEnum
CREATE TYPE "SecurityReviewScope" AS ENUM ('global', 'tenant');

-- CreateEnum
CREATE TYPE "SecurityReviewStatus" AS ENUM ('active', 'outdated', 'disabled', 'deleted');

-- CreateEnum
CREATE TYPE "SecurityReviewRevisionStatus" AS ENUM ('queued', 'running', 'completed', 'completed_with_gaps', 'failed', 'blocked');

-- CreateEnum
CREATE TYPE "SecurityReviewStage" AS ENUM ('collecting', 'verifying', 'analyzing', 'writing');

-- CreateEnum
CREATE TYPE "SecurityReviewMode" AS ENUM ('ai', 'deterministic');

-- CreateEnum
CREATE TYPE "SecurityReviewTrigger" AS ENUM ('first_use', 'page_open', 'new_version', 'deployment', 'tools_discovered', 'census_changed', 'scheduled', 'prompt_update', 'reassess', 'admin', 'skill_import', 'usage_threshold', 'usage_changed');

-- CreateEnum
CREATE TYPE "SecurityReviewBlockReason" AS ENUM ('billing', 'ai_disabled', 'admin_disabled');

-- CreateEnum
CREATE TYPE "SecurityReviewLevel" AS ENUM ('unknown', 'low', 'moderate', 'high', 'critical');

-- CreateEnum
CREATE TYPE "SecurityReviewConfidence" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "SecurityReviewThoroughness" AS ENUM ('basic', 'standard', 'deep');

-- CreateEnum
CREATE TYPE "SecurityReviewSource" AS ENUM ('agent', 'admin');

-- CreateEnum
CREATE TYPE "SecurityFindingKind" AS ENUM ('security', 'capability', 'positive');

-- CreateEnum
CREATE TYPE "SecurityFindingSeverity" AS ENUM ('info', 'low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "SecurityFindingChange" AS ENUM ('new', 'persisting', 'resolved');

-- CreateEnum
CREATE TYPE "SecurityReviewRunStatus" AS ENUM ('running', 'succeeded', 'failed', 'budget_exhausted');

-- CreateEnum
CREATE TYPE "SecurityFileKind" AS ENUM ('text', 'image', 'pdf', 'audio', 'video', 'font', 'archive', 'executable', 'unknown_binary', 'empty');

-- CreateEnum
CREATE TYPE "ProtoGuardRuleStage" AS ENUM ('shadow', 'active', 'deprecated');

-- CreateEnum
CREATE TYPE "ProtoGuardFindingDirection" AS ENUM ('input', 'output', 'session');

-- CreateEnum
CREATE TYPE "ProtoGuardFindingView" AS ENUM ('raw', 'canonical', 'decoded');

-- CreateEnum
CREATE TYPE "ProtoGuardRunCoverage" AS ENUM ('full', 'sampled', 'partial', 'skipped');

-- CreateEnum
CREATE TYPE "ProtoGuardSuppressionStatus" AS ENUM ('active', 'archived');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ProtoGuardIssueType" ADD VALUE 'ascii_smuggling';
ALTER TYPE "ProtoGuardIssueType" ADD VALUE 'exfil_channel';
ALTER TYPE "ProtoGuardIssueType" ADD VALUE 'hidden_content';
ALTER TYPE "ProtoGuardIssueType" ADD VALUE 'cross_tool_reference';
ALTER TYPE "ProtoGuardIssueType" ADD VALUE 'addressed_to_agent';
ALTER TYPE "ProtoGuardIssueType" ADD VALUE 'secret_in_arguments';
ALTER TYPE "ProtoGuardIssueType" ADD VALUE 'tool_poisoning';
ALTER TYPE "ProtoGuardIssueType" ADD VALUE 'tool_shadowing';
ALTER TYPE "ProtoGuardIssueType" ADD VALUE 'tool_rug_pull';
ALTER TYPE "ProtoGuardIssueType" ADD VALUE 'injection_followed_by_sink';

-- AlterEnum
ALTER TYPE "ProtoGuardRunStatus" ADD VALUE 'skipped';

-- AlterTable
ALTER TABLE "ProviderAuthConfigError" ADD COLUMN     "issueOid" BIGINT;

-- AlterTable
ALTER TABLE "Slate" ADD COLUMN     "slateIdOnRegistry" TEXT;

-- AlterTable
ALTER TABLE "SlateVersion" ADD COLUMN     "versionIdOnRegistry" TEXT;

-- AlterTable
ALTER TABLE "SessionError" ADD COLUMN     "issueOid" BIGINT;

-- AlterTable
ALTER TABLE "ProtoGuardFilter" ADD COLUMN     "stage" "ProtoGuardRuleStage" NOT NULL DEFAULT 'active';

-- AlterTable
ALTER TABLE "ProtoGuardTenantSetting" ADD COLUMN     "alertProbabilityThreshold" DOUBLE PRECISION,
ADD COLUMN     "contentHashKey" TEXT,
ADD COLUMN     "enabled" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "alertFilterCountThreshold" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ProtoGuardRun" ADD COLUMN     "coverage" "ProtoGuardRunCoverage",
ADD COLUMN     "durationMs" INTEGER,
ADD COLUMN     "familyScores" JSONB,
ADD COLUMN     "probability" DOUBLE PRECISION,
ADD COLUMN     "retentionLevel" "SessionDataRetentionLevel",
ADD COLUMN     "rulesetVersion" TEXT,
ADD COLUMN     "scannedChars" INTEGER,
ADD COLUMN     "skipReason" TEXT,
ADD COLUMN     "totalChars" INTEGER;

-- AlterTable
ALTER TABLE "ProtoGuardAlert" ADD COLUMN     "dedupKey" TEXT,
ADD COLUMN     "firstSeenAt" TIMESTAMP(3),
ADD COLUMN     "issueOid" BIGINT,
ADD COLUMN     "lastSeenAt" TIMESTAMP(3),
ADD COLUMN     "occurrenceCount" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "ProtoGuardAlertInstance" ADD COLUMN     "contentHmac" TEXT,
ADD COLUMN     "direction" "ProtoGuardFindingDirection",
ADD COLUMN     "isSuppressed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ruleKey" TEXT,
ADD COLUMN     "runOid" BIGINT,
ADD COLUMN     "stage" "ProtoGuardRuleStage" NOT NULL DEFAULT 'active',
ADD COLUMN     "view" "ProtoGuardFindingView",
ALTER COLUMN "matchedText" DROP NOT NULL,
ALTER COLUMN "sampleMarkdown" DROP NOT NULL,
ALTER COLUMN "alertOid" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "aiAnalysisEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "usageReviewsEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ProviderIssue" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "ProviderIssueType" NOT NULL,
    "subtype" TEXT NOT NULL,
    "severity" "ProviderIssueSeverity" NOT NULL,
    "hash" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "occurrenceCount" INTEGER NOT NULL DEFAULT 0,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "providerOid" BIGINT,
    "protoGuardFilterOid" BIGINT,
    "tenantOid" BIGINT NOT NULL,
    "environmentOid" BIGINT NOT NULL,
    "projectOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,

    CONSTRAINT "ProviderIssue_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderIssueOccurrencePeriod" (
    "oid" BIGINT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "occurrenceCount" INTEGER NOT NULL DEFAULT 0,
    "issueOid" BIGINT NOT NULL,

    CONSTRAINT "ProviderIssueOccurrencePeriod_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SecurityReview" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "subjectType" "SecurityReviewSubjectType" NOT NULL,
    "scope" "SecurityReviewScope" NOT NULL,
    "subjectKey" TEXT NOT NULL,
    "globalId" TEXT,
    "status" "SecurityReviewStatus" NOT NULL,
    "isAdminDisabled" BOOLEAN NOT NULL DEFAULT false,
    "lastCheckedAt" TIMESTAMP(3),
    "skillId" TEXT,
    "dismissedAt" TIMESTAMP(3),
    "dismissedByActorId" TEXT,
    "tenantOid" BIGINT,
    "projectOid" BIGINT,
    "providerOid" BIGINT,
    "providerVersionOid" BIGINT,
    "instanceOid" BIGINT,
    "customProviderVersionOid" BIGINT,
    "currentRevisionOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityReview_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SecurityReviewRevision" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "globalId" TEXT,
    "snapshotOfId" TEXT,
    "skillVersionId" TEXT,
    "status" "SecurityReviewRevisionStatus" NOT NULL,
    "stage" "SecurityReviewStage",
    "activity" TEXT,
    "mode" "SecurityReviewMode" NOT NULL,
    "trigger" "SecurityReviewTrigger" NOT NULL,
    "blockReason" "SecurityReviewBlockReason",
    "failureCode" TEXT,
    "report" JSONB,
    "scores" JSONB,
    "usageReport" JSONB,
    "usageScores" JSONB,
    "securityScore" INTEGER,
    "exposure" "SecurityReviewLevel",
    "risk" "SecurityReviewLevel",
    "confidence" "SecurityReviewConfidence",
    "provenanceClass" TEXT,
    "awaitingTools" BOOLEAN NOT NULL DEFAULT false,
    "evidenceHash" TEXT,
    "contentHash" TEXT,
    "rulesVersion" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "thoroughness" "SecurityReviewThoroughness" NOT NULL,
    "source" "SecurityReviewSource" NOT NULL DEFAULT 'agent',
    "census" JSONB,
    "context" JSONB,
    "workspaceKey" TEXT,
    "reviewOid" BIGINT NOT NULL,
    "specificationOid" BIGINT,
    "baseRevisionOid" BIGINT,
    "heartbeatAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityReviewRevision_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SecurityReviewFinding" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "kind" "SecurityFindingKind" NOT NULL,
    "category" TEXT NOT NULL,
    "severity" "SecurityFindingSeverity" NOT NULL,
    "change" "SecurityFindingChange" NOT NULL,
    "origin" TEXT NOT NULL,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "value" JSONB NOT NULL,
    "revisionOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityReviewFinding_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SecurityReviewRun" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SecurityReviewRunStatus" NOT NULL,
    "model" TEXT NOT NULL,
    "steps" INTEGER NOT NULL DEFAULT 0,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "cachedInputTokens" INTEGER NOT NULL DEFAULT 0,
    "costMicros" BIGINT NOT NULL DEFAULT 0,
    "maxCostMicros" BIGINT NOT NULL,
    "errorMessage" TEXT,
    "log" TEXT,
    "isBillable" BOOLEAN NOT NULL DEFAULT false,
    "billedAt" TIMESTAMP(3),
    "revisionOid" BIGINT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "SecurityReviewRun_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SecurityReviewWebDomainUsage" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "dispatched" INTEGER NOT NULL DEFAULT 0,
    "succeeded" INTEGER NOT NULL DEFAULT 0,
    "blocked" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "lastOutcome" TEXT NOT NULL,
    "lastReason" TEXT,
    "retriever" TEXT NOT NULL,
    "lastOperation" TEXT NOT NULL,
    "reputation" TEXT,
    "threatTypes" TEXT[],
    "reputationCheckedAt" TIMESTAMP(3),
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAttemptAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "SecurityReviewWebDomainUsage_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SecurityReviewWebDomainUsageReview" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "domainUsageOid" BIGINT NOT NULL,
    "reviewOid" BIGINT NOT NULL,

    CONSTRAINT "SecurityReviewWebDomainUsageReview_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SecurityReviewFileCheck" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "kind" "SecurityFileKind" NOT NULL,
    "detectedMime" TEXT,
    "extension" TEXT,
    "isDisguised" BOOLEAN NOT NULL DEFAULT false,
    "sizeBytes" BIGINT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityReviewFileCheck_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderToolUsageHourly" (
    "hour" TIMESTAMP(3) NOT NULL,
    "toolKey" TEXT NOT NULL,
    "calls" INTEGER NOT NULL,
    "errors" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "providerOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,

    CONSTRAINT "ProviderToolUsageHourly_pkey" PRIMARY KEY ("instanceOid","providerOid","hour","toolKey")
);

-- CreateTable
CREATE TABLE "ProviderProtoGuardHourly" (
    "hour" TIMESTAMP(3) NOT NULL,
    "toolKey" TEXT NOT NULL,
    "filterKey" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "issueType" "ProtoGuardIssueType" NOT NULL,
    "severity" "ProtoGuardSeverity" NOT NULL,
    "matches" INTEGER NOT NULL,
    "alerts" INTEGER NOT NULL,
    "suppressed" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "providerOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,

    CONSTRAINT "ProviderProtoGuardHourly_pkey" PRIMARY KEY ("instanceOid","providerOid","hour","toolKey","filterKey","direction")
);

-- CreateTable
CREATE TABLE "ProtoGuardSuppression" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "ProtoGuardSuppressionStatus" NOT NULL DEFAULT 'active',
    "reason" TEXT,
    "toolKey" TEXT,
    "contentHmac" TEXT,
    "expiresAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "filterOid" BIGINT NOT NULL,
    "providerOid" BIGINT,

    CONSTRAINT "ProtoGuardSuppression_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProtoGuardToolScan" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "rulesetVersion" TEXT NOT NULL,
    "status" "ProtoGuardRunStatus" NOT NULL,
    "probability" DOUBLE PRECISION NOT NULL,
    "isFlagged" BOOLEAN NOT NULL,
    "findings" JSONB NOT NULL,
    "previousToolHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "providerToolOid" BIGINT NOT NULL,
    "providerOid" BIGINT NOT NULL,

    CONSTRAINT "ProtoGuardToolScan_pkey" PRIMARY KEY ("oid")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProviderIssue_id_key" ON "ProviderIssue"("id");

-- CreateIndex
CREATE INDEX "ProviderIssue_instanceOid_lastSeenAt_idx" ON "ProviderIssue"("instanceOid", "lastSeenAt");

-- CreateIndex
CREATE INDEX "ProviderIssue_instanceOid_type_lastSeenAt_idx" ON "ProviderIssue"("instanceOid", "type", "lastSeenAt");

-- CreateIndex
CREATE INDEX "ProviderIssue_providerOid_idx" ON "ProviderIssue"("providerOid");

-- CreateIndex
CREATE INDEX "ProviderIssue_protoGuardFilterOid_idx" ON "ProviderIssue"("protoGuardFilterOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderIssue_tenantOid_environmentOid_type_hash_key" ON "ProviderIssue"("tenantOid", "environmentOid", "type", "hash");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderIssueOccurrencePeriod_issueOid_startsAt_key" ON "ProviderIssueOccurrencePeriod"("issueOid", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityReview_id_key" ON "SecurityReview"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityReview_subjectKey_key" ON "SecurityReview"("subjectKey");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityReview_globalId_key" ON "SecurityReview"("globalId");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityReview_customProviderVersionOid_key" ON "SecurityReview"("customProviderVersionOid");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityReview_currentRevisionOid_key" ON "SecurityReview"("currentRevisionOid");

-- CreateIndex
CREATE INDEX "SecurityReview_providerOid_idx" ON "SecurityReview"("providerOid");

-- CreateIndex
CREATE INDEX "SecurityReview_providerVersionOid_idx" ON "SecurityReview"("providerVersionOid");

-- CreateIndex
CREATE INDEX "SecurityReview_instanceOid_providerOid_idx" ON "SecurityReview"("instanceOid", "providerOid");

-- CreateIndex
CREATE INDEX "SecurityReview_skillId_idx" ON "SecurityReview"("skillId");

-- CreateIndex
CREATE INDEX "SecurityReview_tenantOid_idx" ON "SecurityReview"("tenantOid");

-- CreateIndex
CREATE INDEX "SecurityReview_status_idx" ON "SecurityReview"("status");

-- CreateIndex
CREATE INDEX "SecurityReview_updatedAt_idx" ON "SecurityReview"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityReviewRevision_id_key" ON "SecurityReviewRevision"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityReviewRevision_globalId_key" ON "SecurityReviewRevision"("globalId");

-- CreateIndex
CREATE INDEX "SecurityReviewRevision_status_idx" ON "SecurityReviewRevision"("status");

-- CreateIndex
CREATE INDEX "SecurityReviewRevision_createdAt_idx" ON "SecurityReviewRevision"("createdAt");

-- CreateIndex
CREATE INDEX "SecurityReviewRevision_snapshotOfId_idx" ON "SecurityReviewRevision"("snapshotOfId");

-- CreateIndex
CREATE INDEX "SecurityReviewRevision_contentHash_idx" ON "SecurityReviewRevision"("contentHash");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityReviewRevision_reviewOid_number_key" ON "SecurityReviewRevision"("reviewOid", "number");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityReviewFinding_id_key" ON "SecurityReviewFinding"("id");

-- CreateIndex
CREATE INDEX "SecurityReviewFinding_kind_idx" ON "SecurityReviewFinding"("kind");

-- CreateIndex
CREATE INDEX "SecurityReviewFinding_severity_idx" ON "SecurityReviewFinding"("severity");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityReviewFinding_revisionOid_key_key" ON "SecurityReviewFinding"("revisionOid", "key");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityReviewRun_id_key" ON "SecurityReviewRun"("id");

-- CreateIndex
CREATE INDEX "SecurityReviewRun_revisionOid_idx" ON "SecurityReviewRun"("revisionOid");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityReviewWebDomainUsage_id_key" ON "SecurityReviewWebDomainUsage"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityReviewWebDomainUsage_domain_key" ON "SecurityReviewWebDomainUsage"("domain");

-- CreateIndex
CREATE INDEX "SecurityReviewWebDomainUsage_lastAttemptAt_idx" ON "SecurityReviewWebDomainUsage"("lastAttemptAt");

-- CreateIndex
CREATE INDEX "SecurityReviewWebDomainUsage_lastOutcome_lastAttemptAt_idx" ON "SecurityReviewWebDomainUsage"("lastOutcome", "lastAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityReviewWebDomainUsageReview_id_key" ON "SecurityReviewWebDomainUsageReview"("id");

-- CreateIndex
CREATE INDEX "SecurityReviewWebDomainUsageReview_reviewOid_idx" ON "SecurityReviewWebDomainUsageReview"("reviewOid");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityReviewWebDomainUsageReview_domainUsageOid_reviewOid_key" ON "SecurityReviewWebDomainUsageReview"("domainUsageOid", "reviewOid");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityReviewFileCheck_id_key" ON "SecurityReviewFileCheck"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityReviewFileCheck_fileId_key" ON "SecurityReviewFileCheck"("fileId");

-- CreateIndex
CREATE INDEX "ProviderToolUsageHourly_tenantOid_hour_idx" ON "ProviderToolUsageHourly"("tenantOid", "hour");

-- CreateIndex
CREATE INDEX "ProviderToolUsageHourly_instanceOid_providerOid_hour_idx" ON "ProviderToolUsageHourly"("instanceOid", "providerOid", "hour");

-- CreateIndex
CREATE INDEX "ProviderProtoGuardHourly_tenantOid_hour_idx" ON "ProviderProtoGuardHourly"("tenantOid", "hour");

-- CreateIndex
CREATE INDEX "ProviderProtoGuardHourly_instanceOid_providerOid_hour_idx" ON "ProviderProtoGuardHourly"("instanceOid", "providerOid", "hour");

-- CreateIndex
CREATE UNIQUE INDEX "ProtoGuardSuppression_id_key" ON "ProtoGuardSuppression"("id");

-- CreateIndex
CREATE INDEX "ProtoGuardSuppression_tenantOid_status_idx" ON "ProtoGuardSuppression"("tenantOid", "status");

-- CreateIndex
CREATE INDEX "ProtoGuardSuppression_projectOid_idx" ON "ProtoGuardSuppression"("projectOid");

-- CreateIndex
CREATE INDEX "ProtoGuardSuppression_filterOid_idx" ON "ProtoGuardSuppression"("filterOid");

-- CreateIndex
CREATE INDEX "ProtoGuardSuppression_providerOid_idx" ON "ProtoGuardSuppression"("providerOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProtoGuardToolScan_id_key" ON "ProtoGuardToolScan"("id");

-- CreateIndex
CREATE INDEX "ProtoGuardToolScan_providerOid_isFlagged_idx" ON "ProtoGuardToolScan"("providerOid", "isFlagged");

-- CreateIndex
CREATE INDEX "ProtoGuardToolScan_createdAt_idx" ON "ProtoGuardToolScan"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProtoGuardToolScan_providerToolOid_rulesetVersion_key" ON "ProtoGuardToolScan"("providerToolOid", "rulesetVersion");

-- CreateIndex
CREATE INDEX "ProviderAuthConfig_instanceOid_providerOid_status_idx" ON "ProviderAuthConfig"("instanceOid", "providerOid", "status");

-- CreateIndex
CREATE INDEX "ProviderAuthConfigError_issueOid_idx" ON "ProviderAuthConfigError"("issueOid");

-- CreateIndex
CREATE INDEX "SessionError_issueOid_idx" ON "SessionError"("issueOid");

-- CreateIndex
CREATE INDEX "ProtoGuardAlert_tenantOid_dedupKey_lastSeenAt_idx" ON "ProtoGuardAlert"("tenantOid", "dedupKey", "lastSeenAt");

-- CreateIndex
CREATE INDEX "ProtoGuardAlert_issueOid_idx" ON "ProtoGuardAlert"("issueOid");

-- CreateIndex
CREATE INDEX "ProtoGuardAlertInstance_runOid_idx" ON "ProtoGuardAlertInstance"("runOid");

-- CreateIndex
CREATE INDEX "ProviderRun_metorialInstanceOid_providerOid_createdAt_idx" ON "ProviderRun"("metorialInstanceOid", "providerOid", "createdAt");

-- AddForeignKey
ALTER TABLE "ProviderAuthConfigError" ADD CONSTRAINT "ProviderAuthConfigError_issueOid_fkey" FOREIGN KEY ("issueOid") REFERENCES "ProviderIssue"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderIssue" ADD CONSTRAINT "ProviderIssue_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderIssue" ADD CONSTRAINT "ProviderIssue_protoGuardFilterOid_fkey" FOREIGN KEY ("protoGuardFilterOid") REFERENCES "ProtoGuardFilter"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderIssue" ADD CONSTRAINT "ProviderIssue_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderIssue" ADD CONSTRAINT "ProviderIssue_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderIssue" ADD CONSTRAINT "ProviderIssue_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderIssue" ADD CONSTRAINT "ProviderIssue_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderIssueOccurrencePeriod" ADD CONSTRAINT "ProviderIssueOccurrencePeriod_issueOid_fkey" FOREIGN KEY ("issueOid") REFERENCES "ProviderIssue"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityReview" ADD CONSTRAINT "SecurityReview_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityReview" ADD CONSTRAINT "SecurityReview_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityReview" ADD CONSTRAINT "SecurityReview_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityReview" ADD CONSTRAINT "SecurityReview_providerVersionOid_fkey" FOREIGN KEY ("providerVersionOid") REFERENCES "ProviderVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityReview" ADD CONSTRAINT "SecurityReview_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityReview" ADD CONSTRAINT "SecurityReview_customProviderVersionOid_fkey" FOREIGN KEY ("customProviderVersionOid") REFERENCES "CustomProviderVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityReview" ADD CONSTRAINT "SecurityReview_currentRevisionOid_fkey" FOREIGN KEY ("currentRevisionOid") REFERENCES "SecurityReviewRevision"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityReviewRevision" ADD CONSTRAINT "SecurityReviewRevision_reviewOid_fkey" FOREIGN KEY ("reviewOid") REFERENCES "SecurityReview"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityReviewRevision" ADD CONSTRAINT "SecurityReviewRevision_specificationOid_fkey" FOREIGN KEY ("specificationOid") REFERENCES "ProviderSpecification"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityReviewRevision" ADD CONSTRAINT "SecurityReviewRevision_baseRevisionOid_fkey" FOREIGN KEY ("baseRevisionOid") REFERENCES "SecurityReviewRevision"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityReviewFinding" ADD CONSTRAINT "SecurityReviewFinding_revisionOid_fkey" FOREIGN KEY ("revisionOid") REFERENCES "SecurityReviewRevision"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityReviewRun" ADD CONSTRAINT "SecurityReviewRun_revisionOid_fkey" FOREIGN KEY ("revisionOid") REFERENCES "SecurityReviewRevision"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityReviewWebDomainUsageReview" ADD CONSTRAINT "SecurityReviewWebDomainUsageReview_domainUsageOid_fkey" FOREIGN KEY ("domainUsageOid") REFERENCES "SecurityReviewWebDomainUsage"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityReviewWebDomainUsageReview" ADD CONSTRAINT "SecurityReviewWebDomainUsageReview_reviewOid_fkey" FOREIGN KEY ("reviewOid") REFERENCES "SecurityReview"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderToolUsageHourly" ADD CONSTRAINT "ProviderToolUsageHourly_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderToolUsageHourly" ADD CONSTRAINT "ProviderToolUsageHourly_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderToolUsageHourly" ADD CONSTRAINT "ProviderToolUsageHourly_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderToolUsageHourly" ADD CONSTRAINT "ProviderToolUsageHourly_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderProtoGuardHourly" ADD CONSTRAINT "ProviderProtoGuardHourly_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderProtoGuardHourly" ADD CONSTRAINT "ProviderProtoGuardHourly_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderProtoGuardHourly" ADD CONSTRAINT "ProviderProtoGuardHourly_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderProtoGuardHourly" ADD CONSTRAINT "ProviderProtoGuardHourly_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionError" ADD CONSTRAINT "SessionError_issueOid_fkey" FOREIGN KEY ("issueOid") REFERENCES "ProviderIssue"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtoGuardAlert" ADD CONSTRAINT "ProtoGuardAlert_issueOid_fkey" FOREIGN KEY ("issueOid") REFERENCES "ProviderIssue"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtoGuardAlertInstance" ADD CONSTRAINT "ProtoGuardAlertInstance_runOid_fkey" FOREIGN KEY ("runOid") REFERENCES "ProtoGuardRun"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtoGuardSuppression" ADD CONSTRAINT "ProtoGuardSuppression_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtoGuardSuppression" ADD CONSTRAINT "ProtoGuardSuppression_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtoGuardSuppression" ADD CONSTRAINT "ProtoGuardSuppression_filterOid_fkey" FOREIGN KEY ("filterOid") REFERENCES "ProtoGuardFilter"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtoGuardSuppression" ADD CONSTRAINT "ProtoGuardSuppression_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtoGuardToolScan" ADD CONSTRAINT "ProtoGuardToolScan_providerToolOid_fkey" FOREIGN KEY ("providerToolOid") REFERENCES "ProviderTool"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtoGuardToolScan" ADD CONSTRAINT "ProtoGuardToolScan_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE CASCADE ON UPDATE CASCADE;
