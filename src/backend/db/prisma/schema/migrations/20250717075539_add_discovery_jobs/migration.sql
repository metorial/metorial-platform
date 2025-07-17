-- CreateEnum
CREATE TYPE "ServerAutoDiscoveryJobStatus" AS ENUM ('failed', 'completed');

-- AlterTable
ALTER TABLE "ServerVariant" ADD COLUMN     "lastDiscoveredAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ServerVersion" ADD COLUMN     "lastDiscoveredAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ServerAutoDiscoveryJob" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "ServerAutoDiscoveryJobStatus" NOT NULL,
    "serverVariantOid" BIGINT NOT NULL,
    "serverDeploymentOid" BIGINT NOT NULL,
    "metadata" JSONB,
    "internalMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServerAutoDiscoveryJob_pkey" PRIMARY KEY ("oid")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServerAutoDiscoveryJob_id_key" ON "ServerAutoDiscoveryJob"("id");

-- AddForeignKey
ALTER TABLE "ServerAutoDiscoveryJob" ADD CONSTRAINT "ServerAutoDiscoveryJob_serverVariantOid_fkey" FOREIGN KEY ("serverVariantOid") REFERENCES "ServerVariant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerAutoDiscoveryJob" ADD CONSTRAINT "ServerAutoDiscoveryJob_serverDeploymentOid_fkey" FOREIGN KEY ("serverDeploymentOid") REFERENCES "ServerDeployment"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;
