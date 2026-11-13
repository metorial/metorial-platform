-- CreateEnum
CREATE TYPE "BillingMode" AS ENUM ('included', 'overage', 'api', 'unknown');

-- AlterTable
ALTER TABLE "PriceOverride" ADD COLUMN     "billingModes" "BillingMode"[] DEFAULT ARRAY[]::"BillingMode"[];

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

-- CreateIndex
CREATE UNIQUE INDEX "BillingDeclaration_id_key" ON "BillingDeclaration"("id");

-- CreateIndex
CREATE INDEX "BillingDeclaration_organizationOid_archivedAt_idx" ON "BillingDeclaration"("organizationOid", "archivedAt");

-- CreateIndex
CREATE INDEX "BillingDeclaration_projectOid_idx" ON "BillingDeclaration"("projectOid");

-- CreateIndex
CREATE INDEX "BillingDeclaration_userOid_idx" ON "BillingDeclaration"("userOid");

-- AddForeignKey
ALTER TABLE "BillingDeclaration" ADD CONSTRAINT "BillingDeclaration_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingDeclaration" ADD CONSTRAINT "BillingDeclaration_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingDeclaration" ADD CONSTRAINT "BillingDeclaration_userOid_fkey" FOREIGN KEY ("userOid") REFERENCES "Entity"("oid") ON DELETE CASCADE ON UPDATE CASCADE;
