/*
  Warnings:

  - You are about to drop the `RemoteServerInstanceNotification` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[remoteServerInstanceOid]` on the table `CustomServerVersion` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "public"."CustomServerEventType" AS ENUM ('remote_connection_issue', 'remote_provider_oauth_auto_discovery');

-- CreateEnum
CREATE TYPE "public"."RemoteServerInstanceProviderOAuthDiscoveryStatus" AS ENUM ('pending', 'completed_config_found', 'completed_no_config_found');

-- CreateEnum
CREATE TYPE "public"."RemoteServerStatus" AS ENUM ('pending', 'active');

-- DropForeignKey
ALTER TABLE "public"."RemoteServerInstanceNotification" DROP CONSTRAINT "RemoteServerInstanceNotification_remoteServerInstanceOid_fkey";

-- AlterTable
ALTER TABLE "public"."RemoteServerInstance" ADD COLUMN     "providerOAuthDiscoveryDocumentOid" BIGINT,
ADD COLUMN     "providerOAuthDiscoveryStatus" "public"."RemoteServerInstanceProviderOAuthDiscoveryStatus" NOT NULL DEFAULT 'pending',
ADD COLUMN     "status" "public"."RemoteServerStatus" NOT NULL DEFAULT 'pending';

-- DropTable
DROP TABLE "public"."RemoteServerInstanceNotification";

-- DropEnum
DROP TYPE "public"."RemoteServerInstanceNotificationType";

-- CreateTable
CREATE TABLE "public"."CustomServerEvent" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "sourceInstanceOid" BIGINT NOT NULL,
    "customServerOid" BIGINT NOT NULL,
    "customServerVersionOid" BIGINT,
    "type" "public"."CustomServerEventType" NOT NULL,
    "message" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomServerEvent_pkey" PRIMARY KEY ("oid")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomServerEvent_id_key" ON "public"."CustomServerEvent"("id");

-- CreateIndex
CREATE UNIQUE INDEX "CustomServerVersion_remoteServerInstanceOid_key" ON "public"."CustomServerVersion"("remoteServerInstanceOid");

-- AddForeignKey
ALTER TABLE "public"."CustomServerEvent" ADD CONSTRAINT "CustomServerEvent_sourceInstanceOid_fkey" FOREIGN KEY ("sourceInstanceOid") REFERENCES "public"."Instance"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomServerEvent" ADD CONSTRAINT "CustomServerEvent_customServerOid_fkey" FOREIGN KEY ("customServerOid") REFERENCES "public"."CustomServer"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomServerEvent" ADD CONSTRAINT "CustomServerEvent_customServerVersionOid_fkey" FOREIGN KEY ("customServerVersionOid") REFERENCES "public"."CustomServerVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RemoteServerInstance" ADD CONSTRAINT "RemoteServerInstance_providerOAuthDiscoveryDocumentOid_fkey" FOREIGN KEY ("providerOAuthDiscoveryDocumentOid") REFERENCES "public"."ProviderOAuthDiscoveryDocument"("oid") ON DELETE SET NULL ON UPDATE CASCADE;
