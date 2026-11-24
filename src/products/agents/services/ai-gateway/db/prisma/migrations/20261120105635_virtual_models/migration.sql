-- AlterEnum
ALTER TYPE "ProviderKind" ADD VALUE 'decision';

-- CreateTable
CREATE TABLE "VirtualModel" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "currentVersionOid" BIGINT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,

    CONSTRAINT "VirtualModel_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "VirtualModelVersion" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "definition" JSONB NOT NULL,
    "targetModelSlugs" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "virtualModelOid" BIGINT NOT NULL,

    CONSTRAINT "VirtualModelVersion_pkey" PRIMARY KEY ("oid")
);

-- CreateIndex
CREATE UNIQUE INDEX "VirtualModel_id_key" ON "VirtualModel"("id");

-- CreateIndex
CREATE UNIQUE INDEX "VirtualModel_currentVersionOid_key" ON "VirtualModel"("currentVersionOid");

-- CreateIndex
CREATE INDEX "VirtualModel_instanceOid_slug_idx" ON "VirtualModel"("instanceOid", "slug");

-- CreateIndex
CREATE INDEX "VirtualModel_organizationOid_idx" ON "VirtualModel"("organizationOid");

-- CreateIndex
CREATE UNIQUE INDEX "VirtualModelVersion_id_key" ON "VirtualModelVersion"("id");

-- CreateIndex
CREATE UNIQUE INDEX "VirtualModelVersion_virtualModelOid_number_key" ON "VirtualModelVersion"("virtualModelOid", "number");

-- AddForeignKey
ALTER TABLE "VirtualModel" ADD CONSTRAINT "VirtualModel_currentVersionOid_fkey" FOREIGN KEY ("currentVersionOid") REFERENCES "VirtualModelVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VirtualModel" ADD CONSTRAINT "VirtualModel_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VirtualModel" ADD CONSTRAINT "VirtualModel_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VirtualModelVersion" ADD CONSTRAINT "VirtualModelVersion_virtualModelOid_fkey" FOREIGN KEY ("virtualModelOid") REFERENCES "VirtualModel"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;
