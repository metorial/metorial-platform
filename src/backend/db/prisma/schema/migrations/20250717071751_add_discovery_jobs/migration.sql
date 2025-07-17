-- CreateEnum
CREATE TYPE "ServerAutoDiscoveryJobStatus" AS ENUM ('failed', 'completed');

-- CreateTable
CREATE TABLE "ServerAutoDiscoveryJob" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "ServerAutoDiscoveryJobStatus" NOT NULL,
    "serverOid" BIGINT NOT NULL,
    "serverDeploymentOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServerAutoDiscoveryJob_pkey" PRIMARY KEY ("oid")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServerAutoDiscoveryJob_id_key" ON "ServerAutoDiscoveryJob"("id");

-- AddForeignKey
ALTER TABLE "ServerAutoDiscoveryJob" ADD CONSTRAINT "ServerAutoDiscoveryJob_serverOid_fkey" FOREIGN KEY ("serverOid") REFERENCES "Server"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerAutoDiscoveryJob" ADD CONSTRAINT "ServerAutoDiscoveryJob_serverDeploymentOid_fkey" FOREIGN KEY ("serverDeploymentOid") REFERENCES "ServerDeployment"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;
