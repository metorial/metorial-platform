-- CreateEnum
CREATE TYPE "IngestDeviceMode" AS ENUM ('bound', 'ephemeral');

-- CreateEnum
CREATE TYPE "EntityCardinality" AS ENUM ('single', 'multi');

-- CreateEnum
CREATE TYPE "EntityStatus" AS ENUM ('managed', 'discovered', 'merged', 'archived');

-- CreateEnum
CREATE TYPE "AttributionRuleEffect" AS ENUM ('assign', 'exclude');

-- CreateEnum
CREATE TYPE "MergeSuggestionStatus" AS ENUM ('open', 'accepted', 'dismissed');

-- CreateEnum
CREATE TYPE "RebuildRunStatus" AS ENUM ('queued', 'running', 'completed', 'failed', 'cancelled');

-- DropForeignKey
ALTER TABLE "IngestToken" DROP CONSTRAINT "IngestToken_tenantOid_fkey";

-- DropIndex
DROP INDEX "IngestToken_tenantOid_idx";

-- Tokens were bound to tenants, which no longer exist; Metorial reissues them per instance.
DELETE FROM "IngestToken";

-- AlterTable
ALTER TABLE "IngestToken" DROP COLUMN "principalRef",
DROP COLUMN "tenantOid",
ADD COLUMN     "agentEntityOid" BIGINT,
ADD COLUMN     "agentRef" TEXT,
ADD COLUMN     "deviceEntityOid" BIGINT,
ADD COLUMN     "deviceMode" "IngestDeviceMode" NOT NULL DEFAULT 'bound',
ADD COLUMN     "deviceRef" TEXT,
ADD COLUMN     "instanceOid" BIGINT NOT NULL,
ADD COLUMN     "organizationOid" BIGINT NOT NULL,
ADD COLUMN     "tags" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "userEntityOid" BIGINT NOT NULL,
ADD COLUMN     "userRef" TEXT NOT NULL;

-- DropTable
DROP TABLE "Tenant";

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
CREATE TABLE "AttributionRule" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "effect" "AttributionRuleEffect" NOT NULL DEFAULT 'assign',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "match" JSONB NOT NULL,
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
CREATE TABLE "RebuildRun" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "layers" TEXT[],
    "reason" TEXT NOT NULL,
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
CREATE UNIQUE INDEX "IngestSource_id_key" ON "IngestSource"("id");

-- CreateIndex
CREATE UNIQUE INDEX "IngestSource_prefix_key" ON "IngestSource"("prefix");

-- CreateIndex
CREATE INDEX "IngestSource_organizationOid_idx" ON "IngestSource"("organizationOid");

-- CreateIndex
CREATE INDEX "IngestSource_instanceOid_idx" ON "IngestSource"("instanceOid");

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
CREATE UNIQUE INDEX "MergeSuggestion_id_key" ON "MergeSuggestion"("id");

-- CreateIndex
CREATE INDEX "MergeSuggestion_organizationOid_status_idx" ON "MergeSuggestion"("organizationOid", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MergeSuggestion_discoveredEntityOid_managedEntityOid_key" ON "MergeSuggestion"("discoveredEntityOid", "managedEntityOid");

-- CreateIndex
CREATE UNIQUE INDEX "RebuildRun_id_key" ON "RebuildRun"("id");

-- CreateIndex
CREATE INDEX "RebuildRun_organizationOid_createdAt_idx" ON "RebuildRun"("organizationOid", "createdAt");

-- CreateIndex
CREATE INDEX "RebuildRun_status_idx" ON "RebuildRun"("status");

-- CreateIndex
CREATE INDEX "IngestToken_organizationOid_idx" ON "IngestToken"("organizationOid");

-- CreateIndex
CREATE INDEX "IngestToken_instanceOid_idx" ON "IngestToken"("instanceOid");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Instance" ADD CONSTRAINT "Instance_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Instance" ADD CONSTRAINT "Instance_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

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
ALTER TABLE "MergeSuggestion" ADD CONSTRAINT "MergeSuggestion_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MergeSuggestion" ADD CONSTRAINT "MergeSuggestion_discoveredEntityOid_fkey" FOREIGN KEY ("discoveredEntityOid") REFERENCES "Entity"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MergeSuggestion" ADD CONSTRAINT "MergeSuggestion_managedEntityOid_fkey" FOREIGN KEY ("managedEntityOid") REFERENCES "Entity"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RebuildRun" ADD CONSTRAINT "RebuildRun_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RebuildRun" ADD CONSTRAINT "RebuildRun_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RebuildRun" ADD CONSTRAINT "RebuildRun_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;
