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

-- AlterTable
ALTER TABLE "RebuildRun" ADD COLUMN     "filter" JSONB;

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
