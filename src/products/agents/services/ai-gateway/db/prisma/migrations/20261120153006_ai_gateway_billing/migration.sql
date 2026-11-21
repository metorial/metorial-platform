-- CreateEnum
CREATE TYPE "BillingWindowStatus" AS ENUM ('open', 'complete');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "billingRestrictedAt" TIMESTAMP(3),
ADD COLUMN     "billingRestrictionReason" TEXT,
ADD COLUMN     "disabledAt" TIMESTAMP(3),
ADD COLUMN     "disabledReason" TEXT;

-- CreateTable
CREATE TABLE "BillingWindow" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "status" "BillingWindowStatus" NOT NULL DEFAULT 'open',
    "costNanoUsd" BIGINT NOT NULL DEFAULT 0,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "projectOid" BIGINT NOT NULL,

    CONSTRAINT "BillingWindow_pkey" PRIMARY KEY ("oid")
);

-- CreateIndex
CREATE UNIQUE INDEX "BillingWindow_id_key" ON "BillingWindow"("id");

-- CreateIndex
CREATE INDEX "BillingWindow_windowStart_id_idx" ON "BillingWindow"("windowStart", "id");

-- CreateIndex
CREATE INDEX "BillingWindow_status_windowEnd_idx" ON "BillingWindow"("status", "windowEnd");

-- CreateIndex
CREATE UNIQUE INDEX "BillingWindow_projectOid_windowStart_key" ON "BillingWindow"("projectOid", "windowStart");

-- AddForeignKey
ALTER TABLE "BillingWindow" ADD CONSTRAINT "BillingWindow_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;
