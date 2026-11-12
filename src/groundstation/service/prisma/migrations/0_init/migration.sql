-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Tenant" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "skewBoundSeconds" INTEGER NOT NULL DEFAULT 86400,
    "backfillMaxAgeDays" INTEGER,
    "hashKeyVersion" INTEGER NOT NULL DEFAULT 1,
    "recordRetentionDays" INTEGER NOT NULL DEFAULT 90,
    "contentRetentionDays" INTEGER NOT NULL DEFAULT 30,
    "contentKeyVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "IngestToken" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "principalRef" TEXT,
    "contentPolicy" JSONB NOT NULL,
    "limits" JSONB NOT NULL,
    "allowedClients" TEXT[],
    "allowedChannels" TEXT[],
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantOid" BIGINT NOT NULL,

    CONSTRAINT "IngestToken_pkey" PRIMARY KEY ("oid")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_id_key" ON "Tenant"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_ref_key" ON "Tenant"("ref");

-- CreateIndex
CREATE UNIQUE INDEX "IngestToken_id_key" ON "IngestToken"("id");

-- CreateIndex
CREATE UNIQUE INDEX "IngestToken_prefix_key" ON "IngestToken"("prefix");

-- CreateIndex
CREATE INDEX "IngestToken_tenantOid_idx" ON "IngestToken"("tenantOid");

-- AddForeignKey
ALTER TABLE "IngestToken" ADD CONSTRAINT "IngestToken_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

