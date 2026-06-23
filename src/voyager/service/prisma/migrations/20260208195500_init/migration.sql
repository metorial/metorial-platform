-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

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
CREATE TABLE "Source" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Backend" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Backend_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Index" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Index_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Record" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "indexOid" BIGINT NOT NULL,
    "tenantOids" BIGINT[],
    "isTenantSpecific" BOOLEAN NOT NULL,
    "documentId" TEXT NOT NULL,
    "body" JSONB NOT NULL,
    "fields" JSONB NOT NULL,
    "metadata" JSONB NOT NULL,
    "hash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Record_pkey" PRIMARY KEY ("oid")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_id_key" ON "Tenant"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_identifier_key" ON "Tenant"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "Source_id_key" ON "Source"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Source_identifier_key" ON "Source"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "Backend_id_key" ON "Backend"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Backend_identifier_key" ON "Backend"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "Index_id_key" ON "Index"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Index_sourceOid_identifier_key" ON "Index"("sourceOid", "identifier");

-- CreateIndex
CREATE UNIQUE INDEX "Record_id_key" ON "Record"("id");

-- CreateIndex
CREATE INDEX "Record_tenantOids_idx" ON "Record"("tenantOids");

-- CreateIndex
CREATE INDEX "Record_isTenantSpecific_idx" ON "Record"("isTenantSpecific");

-- CreateIndex
CREATE UNIQUE INDEX "Record_indexOid_documentId_key" ON "Record"("indexOid", "documentId");

-- AddForeignKey
ALTER TABLE "Index" ADD CONSTRAINT "Index_sourceOid_fkey" FOREIGN KEY ("sourceOid") REFERENCES "Source"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Record" ADD CONSTRAINT "Record_indexOid_fkey" FOREIGN KEY ("indexOid") REFERENCES "Index"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

