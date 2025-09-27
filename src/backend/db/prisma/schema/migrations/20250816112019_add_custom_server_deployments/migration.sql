/*
  Warnings:

  - The values [remote_provider_oauth_auto_discovery] on the enum `CustomServerEventType` will be removed. If these variants are still used in the database, this will fail.
  - The values [upcoming] on the enum `CustomServerVersionStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `connectionOid` on the `RemoteServerInstance` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[deploymentOid]` on the table `CustomServerVersion` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "public"."CustomServerDeploymentStatus" AS ENUM ('queued', 'deploying', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "public"."CustomServerDeploymentTrigger" AS ENUM ('manual');

-- CreateEnum
CREATE TYPE "public"."CustomServerDeploymentStepType" AS ENUM ('started', 'remote_server_connection_test', 'remote_oauth_auto_discovery', 'deploying', 'deployed');

-- CreateEnum
CREATE TYPE "public"."CustomServerDeploymentStepStatus" AS ENUM ('running', 'completed', 'failed');

-- AlterEnum
BEGIN;
CREATE TYPE "public"."CustomServerEventType_new" AS ENUM ('remote_connection_issue');
ALTER TABLE "public"."CustomServerEvent" ALTER COLUMN "type" TYPE "public"."CustomServerEventType_new" USING ("type"::text::"public"."CustomServerEventType_new");
ALTER TYPE "public"."CustomServerEventType" RENAME TO "CustomServerEventType_old";
ALTER TYPE "public"."CustomServerEventType_new" RENAME TO "CustomServerEventType";
DROP TYPE "public"."CustomServerEventType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "public"."CustomServerVersionStatus_new" AS ENUM ('available', 'deploying', 'deployment_failed');
ALTER TABLE "public"."CustomServerVersion" ALTER COLUMN "status" TYPE "public"."CustomServerVersionStatus_new" USING ("status"::text::"public"."CustomServerVersionStatus_new");
ALTER TYPE "public"."CustomServerVersionStatus" RENAME TO "CustomServerVersionStatus_old";
ALTER TYPE "public"."CustomServerVersionStatus_new" RENAME TO "CustomServerVersionStatus";
DROP TYPE "public"."CustomServerVersionStatus_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "public"."CustomServerVersion" DROP CONSTRAINT "CustomServerVersion_serverVersionOid_fkey";

-- DropForeignKey
ALTER TABLE "public"."RemoteServerInstance" DROP CONSTRAINT "RemoteServerInstance_connectionOid_fkey";

-- AlterTable
ALTER TABLE "public"."CustomServerVersion" ADD COLUMN     "deploymentOid" BIGINT,
ALTER COLUMN "serverVersionOid" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."RemoteServerInstance" DROP COLUMN "connectionOid",
ADD COLUMN     "providerOAuthConfig" JSONB;

-- CreateTable
CREATE TABLE "public"."CustomServerDeployment" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "public"."CustomServerDeploymentStatus" NOT NULL,
    "trigger" "public"."CustomServerDeploymentTrigger" NOT NULL,
    "customServerOid" BIGINT NOT NULL,
    "creatorActorOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "CustomServerDeployment_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "public"."CustomServerDeploymentStep" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "status" "public"."CustomServerDeploymentStepStatus" NOT NULL,
    "type" "public"."CustomServerDeploymentStepType" NOT NULL,
    "deploymentOid" BIGINT NOT NULL,
    "s3LogsKey" TEXT,
    "logs" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "CustomServerDeploymentStep_pkey" PRIMARY KEY ("oid")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomServerDeployment_id_key" ON "public"."CustomServerDeployment"("id");

-- CreateIndex
CREATE UNIQUE INDEX "CustomServerDeploymentStep_id_key" ON "public"."CustomServerDeploymentStep"("id");

-- CreateIndex
CREATE UNIQUE INDEX "CustomServerVersion_deploymentOid_key" ON "public"."CustomServerVersion"("deploymentOid");

-- AddForeignKey
ALTER TABLE "public"."CustomServerDeployment" ADD CONSTRAINT "CustomServerDeployment_customServerOid_fkey" FOREIGN KEY ("customServerOid") REFERENCES "public"."CustomServer"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomServerDeployment" ADD CONSTRAINT "CustomServerDeployment_creatorActorOid_fkey" FOREIGN KEY ("creatorActorOid") REFERENCES "public"."OrganizationActor"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomServerDeploymentStep" ADD CONSTRAINT "CustomServerDeploymentStep_deploymentOid_fkey" FOREIGN KEY ("deploymentOid") REFERENCES "public"."CustomServerDeployment"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomServerVersion" ADD CONSTRAINT "CustomServerVersion_serverVersionOid_fkey" FOREIGN KEY ("serverVersionOid") REFERENCES "public"."ServerVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomServerVersion" ADD CONSTRAINT "CustomServerVersion_deploymentOid_fkey" FOREIGN KEY ("deploymentOid") REFERENCES "public"."CustomServerDeployment"("oid") ON DELETE SET NULL ON UPDATE CASCADE;
