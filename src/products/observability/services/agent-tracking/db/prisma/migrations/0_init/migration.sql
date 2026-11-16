-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateEnum
CREATE TYPE "AttributionRuleEffect" AS ENUM ('assign', 'exclude');

-- CreateEnum
CREATE TYPE "EntityCardinality" AS ENUM ('single', 'multi');

-- CreateEnum
CREATE TYPE "EntityStatus" AS ENUM ('managed', 'discovered', 'merged', 'archived');

-- CreateEnum
CREATE TYPE "MergeSuggestionStatus" AS ENUM ('open', 'accepted', 'dismissed');

-- CreateEnum
CREATE TYPE "IngestDeviceMode" AS ENUM ('bound', 'ephemeral');

-- CreateEnum
CREATE TYPE "KnowledgeSnapshotStatus" AS ENUM ('current', 'superseded', 'rejected');

-- CreateEnum
CREATE TYPE "KnowledgeEntity" AS ENUM ('organization', 'family', 'model', 'release', 'pointer', 'vendor', 'endpoint', 'offering', 'name', 'agent');

-- CreateEnum
CREATE TYPE "KnowledgeChangeType" AS ENUM ('added', 'changed', 'removed');

-- CreateEnum
CREATE TYPE "KnowledgePriceOrigin" AS ENUM ('bootstrap', 'observed', 'correction');

-- CreateEnum
CREATE TYPE "KnowledgePriceCloseReason" AS ENUM ('changed', 'corrected');

-- CreateEnum
CREATE TYPE "PriceOverrideTarget" AS ENUM ('all', 'lab', 'family', 'model', 'offering', 'vendor', 'agent');

-- CreateEnum
CREATE TYPE "PriceOverrideKind" AS ENUM ('multiplier', 'rates', 'included');

-- CreateEnum
CREATE TYPE "BillingMode" AS ENUM ('included', 'overage', 'api', 'unknown');

-- CreateEnum
CREATE TYPE "RebuildRunStatus" AS ENUM ('queued', 'running', 'completed', 'failed', 'cancelled');

-- CreateTable
CREATE TABLE "AttributionRule" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "effect" "AttributionRuleEffect" NOT NULL DEFAULT 'assign',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "match" JSONB NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationOid" BIGINT NOT NULL,
    "targetEntityOid" BIGINT NOT NULL,
    "scopeProjectOid" BIGINT,
    "scopeInstanceOid" BIGINT,

    CONSTRAINT "AttributionRule_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ClassifierLabel" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "sessionKey" TEXT NOT NULL,
    "features" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organizationOid" BIGINT NOT NULL,
    "entityOid" BIGINT NOT NULL,

    CONSTRAINT "ClassifierLabel_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "EntityKind" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cardinality" "EntityCardinality" NOT NULL DEFAULT 'single',
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationOid" BIGINT NOT NULL,

    CONSTRAINT "EntityKind_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Entity" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" "EntityStatus" NOT NULL,
    "source" TEXT,
    "ref" TEXT,
    "slug" TEXT,
    "name" TEXT,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "mergedIntoOid" BIGINT,
    "firstSeenAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationOid" BIGINT NOT NULL,
    "scopeProjectOid" BIGINT,
    "scopeInstanceOid" BIGINT,

    CONSTRAINT "Entity_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "EntityIdentifier" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organizationOid" BIGINT NOT NULL,
    "entityOid" BIGINT NOT NULL,

    CONSTRAINT "EntityIdentifier_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "EntityLink" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "weight" DOUBLE PRECISION,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationOid" BIGINT NOT NULL,
    "fromOid" BIGINT NOT NULL,
    "toOid" BIGINT NOT NULL,

    CONSTRAINT "EntityLink_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "PendingMembership" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "weight" DOUBLE PRECISION,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organizationOid" BIGINT NOT NULL,
    "targetEntityOid" BIGINT NOT NULL,

    CONSTRAINT "PendingMembership_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "MergeSuggestion" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "reasons" TEXT[],
    "status" "MergeSuggestionStatus" NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationOid" BIGINT NOT NULL,
    "discoveredEntityOid" BIGINT NOT NULL,
    "managedEntityOid" BIGINT NOT NULL,

    CONSTRAINT "MergeSuggestion_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "IngestToken" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contentPolicy" JSONB NOT NULL,
    "limits" JSONB NOT NULL,
    "allowedClients" TEXT[],
    "allowedChannels" TEXT[],
    "userRef" TEXT NOT NULL,
    "deviceRef" TEXT,
    "deviceMode" "IngestDeviceMode" NOT NULL DEFAULT 'bound',
    "agentRef" TEXT,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "userEntityOid" BIGINT NOT NULL,
    "deviceEntityOid" BIGINT,
    "agentEntityOid" BIGINT,

    CONSTRAINT "IngestToken_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "IngestSource" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "contentPolicy" JSONB NOT NULL,
    "limits" JSONB NOT NULL,
    "allowedChannels" TEXT[],
    "newUserLimitPerDay" INTEGER NOT NULL DEFAULT 50,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,

    CONSTRAINT "IngestSource_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "KnowledgeSource" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "etag" TEXT,
    "lastFingerprint" TEXT,
    "lastError" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "lastChangedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeSource_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "KnowledgeSnapshot" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "status" "KnowledgeSnapshotStatus" NOT NULL,
    "rejectedReason" TEXT,
    "counts" JSONB NOT NULL,
    "anomalies" JSONB NOT NULL DEFAULT '[]',
    "archive" BYTEA,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sourceOid" BIGINT NOT NULL,

    CONSTRAINT "KnowledgeSnapshot_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "KnowledgeOrganization" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "roles" TEXT[],
    "status" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeOrganization_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "KnowledgeFamily" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "latestModelId" TEXT,
    "data" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeFamily_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "KnowledgeModel" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "familyId" TEXT,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "releaseDate" DATE,
    "openWeights" BOOLEAN NOT NULL,
    "contextTokens" INTEGER,
    "capabilities" TEXT[],
    "inputModalities" TEXT[],
    "outputModalities" TEXT[],
    "data" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeModel_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "KnowledgeRelease" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeRelease_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "KnowledgePointer" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "familyId" TEXT,
    "data" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgePointer_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "KnowledgeVendor" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeVendor_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "KnowledgeEndpoint" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "region" TEXT,
    "baseUrlHost" TEXT,
    "status" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeEndpoint_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "KnowledgeOffering" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "vendorModelId" TEXT NOT NULL,
    "variantKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "free" BOOLEAN NOT NULL,
    "modelId" TEXT,
    "releaseId" TEXT,
    "pointerId" TEXT,
    "pricingHash" TEXT,
    "data" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeOffering_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "KnowledgeName" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "namespace" TEXT NOT NULL,
    "raw" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "targetModelId" TEXT,
    "data" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeName_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "KnowledgeAgent" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "makerId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "openSource" BOOLEAN NOT NULL,
    "surfaces" TEXT[],
    "aliasKeys" TEXT[],
    "defaultVendorId" TEXT,
    "vendorIds" TEXT[],
    "data" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeAgent_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "KnowledgeChange" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "entity" "KnowledgeEntity" NOT NULL,
    "entityId" TEXT NOT NULL,
    "change" "KnowledgeChangeType" NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snapshotOid" BIGINT NOT NULL,

    CONSTRAINT "KnowledgeChange_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "KnowledgePricePeriod" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "modelId" TEXT,
    "pricing" JSONB NOT NULL,
    "pricingHash" TEXT NOT NULL,
    "origin" "KnowledgePriceOrigin" NOT NULL,
    "closeReason" "KnowledgePriceCloseReason",
    "correctionReason" TEXT,
    "correctedBy" TEXT,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "offeringOid" BIGINT NOT NULL,
    "openOfferingOid" BIGINT,
    "openedBySnapshotOid" BIGINT,

    CONSTRAINT "KnowledgePricePeriod_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "PriceOverride" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "reason" TEXT,
    "target" "PriceOverrideTarget" NOT NULL,
    "targetId" TEXT,
    "vendorId" TEXT,
    "billingModes" "BillingMode"[] DEFAULT ARRAY[]::"BillingMode"[],
    "kind" "PriceOverrideKind" NOT NULL,
    "multiplier" DECIMAL(12,6),
    "rates" JSONB,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationOid" BIGINT NOT NULL,
    "projectOid" BIGINT,

    CONSTRAINT "PriceOverride_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "BillingDeclaration" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "reason" TEXT,
    "mode" "BillingMode" NOT NULL,
    "plan" TEXT,
    "agentId" TEXT,
    "createdBy" TEXT,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "userOid" BIGINT,

    CONSTRAINT "BillingDeclaration_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "RebuildRun" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "layers" TEXT[],
    "reason" TEXT NOT NULL,
    "filter" JSONB,
    "rangeFrom" TIMESTAMP(3) NOT NULL,
    "rangeTo" TIMESTAMP(3) NOT NULL,
    "status" "RebuildRunStatus" NOT NULL DEFAULT 'queued',
    "cursor" TEXT,
    "error" TEXT,
    "processed" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "instanceOid" BIGINT,

    CONSTRAINT "RebuildRun_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Organization" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "name" TEXT,
    "hashKeyVersion" INTEGER NOT NULL DEFAULT 1,
    "contentKeyVersion" INTEGER NOT NULL DEFAULT 1,
    "settings" JSONB NOT NULL DEFAULT '{}',
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
    "recordRetentionDays" INTEGER NOT NULL DEFAULT 90,
    "contentRetentionDays" INTEGER NOT NULL DEFAULT 30,
    "usageRetentionDays" INTEGER NOT NULL DEFAULT 400,
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
    "skewBoundSeconds" INTEGER NOT NULL DEFAULT 86400,
    "backfillMaxAgeDays" INTEGER,
    "recordRetentionDays" INTEGER NOT NULL DEFAULT 90,
    "contentRetentionDays" INTEGER NOT NULL DEFAULT 30,
    "usageRetentionDays" INTEGER NOT NULL DEFAULT 400,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationOid" BIGINT NOT NULL,
    "projectOid" BIGINT NOT NULL,

    CONSTRAINT "Instance_pkey" PRIMARY KEY ("oid")
);

-- CreateIndex
CREATE UNIQUE INDEX "AttributionRule_id_key" ON "AttributionRule"("id");

-- CreateIndex
CREATE INDEX "AttributionRule_organizationOid_enabled_idx" ON "AttributionRule"("organizationOid", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "ClassifierLabel_id_key" ON "ClassifierLabel"("id");

-- CreateIndex
CREATE INDEX "ClassifierLabel_organizationOid_kind_createdAt_idx" ON "ClassifierLabel"("organizationOid", "kind", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClassifierLabel_organizationOid_kind_sessionKey_key" ON "ClassifierLabel"("organizationOid", "kind", "sessionKey");

-- CreateIndex
CREATE UNIQUE INDEX "EntityKind_id_key" ON "EntityKind"("id");

-- CreateIndex
CREATE UNIQUE INDEX "EntityKind_organizationOid_key_key" ON "EntityKind"("organizationOid", "key");

-- CreateIndex
CREATE UNIQUE INDEX "Entity_id_key" ON "Entity"("id");

-- CreateIndex
CREATE INDEX "Entity_organizationOid_kind_status_lastSeenAt_idx" ON "Entity"("organizationOid", "kind", "status", "lastSeenAt");

-- CreateIndex
CREATE INDEX "Entity_mergedIntoOid_idx" ON "Entity"("mergedIntoOid");

-- CreateIndex
CREATE UNIQUE INDEX "Entity_organizationOid_kind_source_ref_key" ON "Entity"("organizationOid", "kind", "source", "ref");

-- CreateIndex
CREATE UNIQUE INDEX "Entity_organizationOid_kind_slug_key" ON "Entity"("organizationOid", "kind", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "EntityIdentifier_id_key" ON "EntityIdentifier"("id");

-- CreateIndex
CREATE INDEX "EntityIdentifier_entityOid_idx" ON "EntityIdentifier"("entityOid");

-- CreateIndex
CREATE UNIQUE INDEX "EntityIdentifier_organizationOid_kind_type_value_key" ON "EntityIdentifier"("organizationOid", "kind", "type", "value");

-- CreateIndex
CREATE UNIQUE INDEX "EntityLink_id_key" ON "EntityLink"("id");

-- CreateIndex
CREATE INDEX "EntityLink_organizationOid_type_idx" ON "EntityLink"("organizationOid", "type");

-- CreateIndex
CREATE INDEX "EntityLink_fromOid_type_validFrom_idx" ON "EntityLink"("fromOid", "type", "validFrom");

-- CreateIndex
CREATE INDEX "EntityLink_toOid_type_validFrom_idx" ON "EntityLink"("toOid", "type", "validFrom");

-- CreateIndex
CREATE UNIQUE INDEX "PendingMembership_id_key" ON "PendingMembership"("id");

-- CreateIndex
CREATE UNIQUE INDEX "PendingMembership_organizationOid_email_targetEntityOid_typ_key" ON "PendingMembership"("organizationOid", "email", "targetEntityOid", "type");

-- CreateIndex
CREATE UNIQUE INDEX "MergeSuggestion_id_key" ON "MergeSuggestion"("id");

-- CreateIndex
CREATE INDEX "MergeSuggestion_organizationOid_status_idx" ON "MergeSuggestion"("organizationOid", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MergeSuggestion_discoveredEntityOid_managedEntityOid_key" ON "MergeSuggestion"("discoveredEntityOid", "managedEntityOid");

-- CreateIndex
CREATE UNIQUE INDEX "IngestToken_id_key" ON "IngestToken"("id");

-- CreateIndex
CREATE UNIQUE INDEX "IngestToken_prefix_key" ON "IngestToken"("prefix");

-- CreateIndex
CREATE INDEX "IngestToken_organizationOid_idx" ON "IngestToken"("organizationOid");

-- CreateIndex
CREATE INDEX "IngestToken_instanceOid_idx" ON "IngestToken"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "IngestSource_id_key" ON "IngestSource"("id");

-- CreateIndex
CREATE UNIQUE INDEX "IngestSource_prefix_key" ON "IngestSource"("prefix");

-- CreateIndex
CREATE INDEX "IngestSource_organizationOid_idx" ON "IngestSource"("organizationOid");

-- CreateIndex
CREATE INDEX "IngestSource_instanceOid_idx" ON "IngestSource"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeSource_id_key" ON "KnowledgeSource"("id");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeSource_url_key" ON "KnowledgeSource"("url");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeSnapshot_id_key" ON "KnowledgeSnapshot"("id");

-- CreateIndex
CREATE INDEX "KnowledgeSnapshot_status_generatedAt_idx" ON "KnowledgeSnapshot"("status", "generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeSnapshot_sourceOid_fingerprint_key" ON "KnowledgeSnapshot"("sourceOid", "fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeOrganization_id_key" ON "KnowledgeOrganization"("id");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeFamily_id_key" ON "KnowledgeFamily"("id");

-- CreateIndex
CREATE INDEX "KnowledgeFamily_labId_idx" ON "KnowledgeFamily"("labId");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeModel_id_key" ON "KnowledgeModel"("id");

-- CreateIndex
CREATE INDEX "KnowledgeModel_labId_idx" ON "KnowledgeModel"("labId");

-- CreateIndex
CREATE INDEX "KnowledgeModel_familyId_idx" ON "KnowledgeModel"("familyId");

-- CreateIndex
CREATE INDEX "KnowledgeModel_kind_status_idx" ON "KnowledgeModel"("kind", "status");

-- CreateIndex
CREATE INDEX "KnowledgeModel_name_trgm_idx" ON "KnowledgeModel" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "KnowledgeModel_id_trgm_idx" ON "KnowledgeModel" USING GIN ("id" gin_trgm_ops);

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeRelease_id_key" ON "KnowledgeRelease"("id");

-- CreateIndex
CREATE INDEX "KnowledgeRelease_modelId_idx" ON "KnowledgeRelease"("modelId");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgePointer_id_key" ON "KnowledgePointer"("id");

-- CreateIndex
CREATE INDEX "KnowledgePointer_labId_idx" ON "KnowledgePointer"("labId");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeVendor_id_key" ON "KnowledgeVendor"("id");

-- CreateIndex
CREATE INDEX "KnowledgeVendor_organizationId_idx" ON "KnowledgeVendor"("organizationId");

-- CreateIndex
CREATE INDEX "KnowledgeVendor_kind_idx" ON "KnowledgeVendor"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeEndpoint_id_key" ON "KnowledgeEndpoint"("id");

-- CreateIndex
CREATE INDEX "KnowledgeEndpoint_vendorId_idx" ON "KnowledgeEndpoint"("vendorId");

-- CreateIndex
CREATE INDEX "KnowledgeEndpoint_baseUrlHost_idx" ON "KnowledgeEndpoint"("baseUrlHost");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeOffering_id_key" ON "KnowledgeOffering"("id");

-- CreateIndex
CREATE INDEX "KnowledgeOffering_vendorId_vendorModelId_idx" ON "KnowledgeOffering"("vendorId", "vendorModelId");

-- CreateIndex
CREATE INDEX "KnowledgeOffering_modelId_idx" ON "KnowledgeOffering"("modelId");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeName_id_key" ON "KnowledgeName"("id");

-- CreateIndex
CREATE INDEX "KnowledgeName_raw_idx" ON "KnowledgeName"("raw");

-- CreateIndex
CREATE INDEX "KnowledgeName_key_idx" ON "KnowledgeName"("key");

-- CreateIndex
CREATE INDEX "KnowledgeName_targetModelId_idx" ON "KnowledgeName"("targetModelId");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeAgent_id_key" ON "KnowledgeAgent"("id");

-- CreateIndex
CREATE INDEX "KnowledgeAgent_makerId_idx" ON "KnowledgeAgent"("makerId");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeChange_id_key" ON "KnowledgeChange"("id");

-- CreateIndex
CREATE INDEX "KnowledgeChange_entity_entityId_createdAt_idx" ON "KnowledgeChange"("entity", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "KnowledgeChange_snapshotOid_idx" ON "KnowledgeChange"("snapshotOid");

-- CreateIndex
CREATE INDEX "KnowledgeChange_createdAt_idx" ON "KnowledgeChange"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgePricePeriod_id_key" ON "KnowledgePricePeriod"("id");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgePricePeriod_openOfferingOid_key" ON "KnowledgePricePeriod"("openOfferingOid");

-- CreateIndex
CREATE INDEX "KnowledgePricePeriod_offeringOid_validFrom_idx" ON "KnowledgePricePeriod"("offeringOid", "validFrom");

-- CreateIndex
CREATE INDEX "KnowledgePricePeriod_modelId_validFrom_idx" ON "KnowledgePricePeriod"("modelId", "validFrom");

-- CreateIndex
CREATE INDEX "KnowledgePricePeriod_vendorId_validFrom_idx" ON "KnowledgePricePeriod"("vendorId", "validFrom");

-- CreateIndex
CREATE UNIQUE INDEX "PriceOverride_id_key" ON "PriceOverride"("id");

-- CreateIndex
CREATE INDEX "PriceOverride_organizationOid_archivedAt_idx" ON "PriceOverride"("organizationOid", "archivedAt");

-- CreateIndex
CREATE INDEX "PriceOverride_projectOid_idx" ON "PriceOverride"("projectOid");

-- CreateIndex
CREATE UNIQUE INDEX "BillingDeclaration_id_key" ON "BillingDeclaration"("id");

-- CreateIndex
CREATE INDEX "BillingDeclaration_organizationOid_archivedAt_idx" ON "BillingDeclaration"("organizationOid", "archivedAt");

-- CreateIndex
CREATE INDEX "BillingDeclaration_projectOid_idx" ON "BillingDeclaration"("projectOid");

-- CreateIndex
CREATE INDEX "BillingDeclaration_userOid_idx" ON "BillingDeclaration"("userOid");

-- CreateIndex
CREATE UNIQUE INDEX "RebuildRun_id_key" ON "RebuildRun"("id");

-- CreateIndex
CREATE INDEX "RebuildRun_organizationOid_createdAt_idx" ON "RebuildRun"("organizationOid", "createdAt");

-- CreateIndex
CREATE INDEX "RebuildRun_status_idx" ON "RebuildRun"("status");

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

-- AddForeignKey
ALTER TABLE "AttributionRule" ADD CONSTRAINT "AttributionRule_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributionRule" ADD CONSTRAINT "AttributionRule_targetEntityOid_fkey" FOREIGN KEY ("targetEntityOid") REFERENCES "Entity"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributionRule" ADD CONSTRAINT "AttributionRule_scopeProjectOid_fkey" FOREIGN KEY ("scopeProjectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributionRule" ADD CONSTRAINT "AttributionRule_scopeInstanceOid_fkey" FOREIGN KEY ("scopeInstanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassifierLabel" ADD CONSTRAINT "ClassifierLabel_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassifierLabel" ADD CONSTRAINT "ClassifierLabel_entityOid_fkey" FOREIGN KEY ("entityOid") REFERENCES "Entity"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityKind" ADD CONSTRAINT "EntityKind_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entity" ADD CONSTRAINT "Entity_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entity" ADD CONSTRAINT "Entity_scopeProjectOid_fkey" FOREIGN KEY ("scopeProjectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entity" ADD CONSTRAINT "Entity_scopeInstanceOid_fkey" FOREIGN KEY ("scopeInstanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityIdentifier" ADD CONSTRAINT "EntityIdentifier_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityIdentifier" ADD CONSTRAINT "EntityIdentifier_entityOid_fkey" FOREIGN KEY ("entityOid") REFERENCES "Entity"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityLink" ADD CONSTRAINT "EntityLink_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityLink" ADD CONSTRAINT "EntityLink_fromOid_fkey" FOREIGN KEY ("fromOid") REFERENCES "Entity"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityLink" ADD CONSTRAINT "EntityLink_toOid_fkey" FOREIGN KEY ("toOid") REFERENCES "Entity"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingMembership" ADD CONSTRAINT "PendingMembership_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingMembership" ADD CONSTRAINT "PendingMembership_targetEntityOid_fkey" FOREIGN KEY ("targetEntityOid") REFERENCES "Entity"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MergeSuggestion" ADD CONSTRAINT "MergeSuggestion_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MergeSuggestion" ADD CONSTRAINT "MergeSuggestion_discoveredEntityOid_fkey" FOREIGN KEY ("discoveredEntityOid") REFERENCES "Entity"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MergeSuggestion" ADD CONSTRAINT "MergeSuggestion_managedEntityOid_fkey" FOREIGN KEY ("managedEntityOid") REFERENCES "Entity"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestToken" ADD CONSTRAINT "IngestToken_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestToken" ADD CONSTRAINT "IngestToken_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestToken" ADD CONSTRAINT "IngestToken_userEntityOid_fkey" FOREIGN KEY ("userEntityOid") REFERENCES "Entity"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestToken" ADD CONSTRAINT "IngestToken_deviceEntityOid_fkey" FOREIGN KEY ("deviceEntityOid") REFERENCES "Entity"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestToken" ADD CONSTRAINT "IngestToken_agentEntityOid_fkey" FOREIGN KEY ("agentEntityOid") REFERENCES "Entity"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestSource" ADD CONSTRAINT "IngestSource_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestSource" ADD CONSTRAINT "IngestSource_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeSnapshot" ADD CONSTRAINT "KnowledgeSnapshot_sourceOid_fkey" FOREIGN KEY ("sourceOid") REFERENCES "KnowledgeSource"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeChange" ADD CONSTRAINT "KnowledgeChange_snapshotOid_fkey" FOREIGN KEY ("snapshotOid") REFERENCES "KnowledgeSnapshot"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgePricePeriod" ADD CONSTRAINT "KnowledgePricePeriod_offeringOid_fkey" FOREIGN KEY ("offeringOid") REFERENCES "KnowledgeOffering"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgePricePeriod" ADD CONSTRAINT "KnowledgePricePeriod_openOfferingOid_fkey" FOREIGN KEY ("openOfferingOid") REFERENCES "KnowledgeOffering"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgePricePeriod" ADD CONSTRAINT "KnowledgePricePeriod_openedBySnapshotOid_fkey" FOREIGN KEY ("openedBySnapshotOid") REFERENCES "KnowledgeSnapshot"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceOverride" ADD CONSTRAINT "PriceOverride_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceOverride" ADD CONSTRAINT "PriceOverride_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingDeclaration" ADD CONSTRAINT "BillingDeclaration_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingDeclaration" ADD CONSTRAINT "BillingDeclaration_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingDeclaration" ADD CONSTRAINT "BillingDeclaration_userOid_fkey" FOREIGN KEY ("userOid") REFERENCES "Entity"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RebuildRun" ADD CONSTRAINT "RebuildRun_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RebuildRun" ADD CONSTRAINT "RebuildRun_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RebuildRun" ADD CONSTRAINT "RebuildRun_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Instance" ADD CONSTRAINT "Instance_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Instance" ADD CONSTRAINT "Instance_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;
