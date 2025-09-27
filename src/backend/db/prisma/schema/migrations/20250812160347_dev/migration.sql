/*
  Warnings:

  - A unique constraint covering the columns `[providerOid]` on the table `Profile` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "public"."CustomServerType" AS ENUM ('remote');

-- CreateEnum
CREATE TYPE "public"."CustomServerStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "public"."CustomServerVersionStatus" AS ENUM ('available', 'upcoming');

-- CreateEnum
CREATE TYPE "public"."RemoteServerInstanceNotificationType" AS ENUM ('connection_issue');

-- CreateEnum
CREATE TYPE "public"."ServerStatus" AS ENUM ('active', 'inactive');

-- AlterEnum
ALTER TYPE "public"."ServerType" ADD VALUE 'custom';

-- AlterTable
ALTER TABLE "public"."Profile" ADD COLUMN     "providerOid" BIGINT;

-- AlterTable
ALTER TABLE "public"."Server" ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "status" "public"."ServerStatus" NOT NULL DEFAULT 'active';

-- AlterTable
ALTER TABLE "public"."ServerVariant" ADD COLUMN     "defaultForInstanceOid" BIGINT,
ADD COLUMN     "instanceOid" BIGINT,
ADD COLUMN     "isDefault" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "onlyForInstanceOid" BIGINT,
ADD COLUMN     "status" "public"."ServerStatus" NOT NULL DEFAULT 'active';

-- CreateTable
CREATE TABLE "public"."CustomServer" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "type" "public"."CustomServerType" NOT NULL,
    "status" "public"."CustomServerStatus" NOT NULL DEFAULT 'active',
    "isEphemeral" BOOLEAN NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "organizationOid" BIGINT NOT NULL,
    "serverOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CustomServer_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "public"."CustomServerEnvironment" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "maxVersionIndex" INTEGER NOT NULL DEFAULT 0,
    "serverVariantOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "organizationOid" BIGINT NOT NULL,
    "customServerOid" BIGINT NOT NULL,
    "currentVersionOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomServerEnvironment_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "public"."CustomServerVersion" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "public"."CustomServerVersionStatus" NOT NULL,
    "versionIndex" INTEGER NOT NULL,
    "versionHash" TEXT NOT NULL,
    "customServerOid" BIGINT NOT NULL,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "serverVersionOid" BIGINT NOT NULL,
    "remoteServerInstanceOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomServerVersion_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "public"."RemoteServerInstance" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "remoteUrl" TEXT NOT NULL,
    "connectionOid" BIGINT,
    "instanceOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RemoteServerInstance_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "public"."RemoteServerInstanceNotification" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "remoteServerInstanceOid" BIGINT NOT NULL,
    "type" "public"."RemoteServerInstanceNotificationType" NOT NULL,
    "message" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RemoteServerInstanceNotification_pkey" PRIMARY KEY ("oid")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomServer_id_key" ON "public"."CustomServer"("id");

-- CreateIndex
CREATE UNIQUE INDEX "CustomServer_serverOid_key" ON "public"."CustomServer"("serverOid");

-- CreateIndex
CREATE UNIQUE INDEX "CustomServerEnvironment_id_key" ON "public"."CustomServerEnvironment"("id");

-- CreateIndex
CREATE UNIQUE INDEX "CustomServerEnvironment_serverVariantOid_key" ON "public"."CustomServerEnvironment"("serverVariantOid");

-- CreateIndex
CREATE UNIQUE INDEX "CustomServerEnvironment_currentVersionOid_key" ON "public"."CustomServerEnvironment"("currentVersionOid");

-- CreateIndex
CREATE UNIQUE INDEX "CustomServerEnvironment_instanceOid_customServerOid_key" ON "public"."CustomServerEnvironment"("instanceOid", "customServerOid");

-- CreateIndex
CREATE UNIQUE INDEX "CustomServerVersion_id_key" ON "public"."CustomServerVersion"("id");

-- CreateIndex
CREATE UNIQUE INDEX "CustomServerVersion_serverVersionOid_key" ON "public"."CustomServerVersion"("serverVersionOid");

-- CreateIndex
CREATE UNIQUE INDEX "RemoteServerInstance_id_key" ON "public"."RemoteServerInstance"("id");

-- CreateIndex
CREATE UNIQUE INDEX "RemoteServerInstanceNotification_id_key" ON "public"."RemoteServerInstanceNotification"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_providerOid_key" ON "public"."Profile"("providerOid");

-- CreateIndex
CREATE INDEX "Server_type_idx" ON "public"."Server"("type");

-- AddForeignKey
ALTER TABLE "public"."Profile" ADD CONSTRAINT "Profile_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "public"."ServerVariantProvider"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomServer" ADD CONSTRAINT "CustomServer_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "public"."Organization"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomServer" ADD CONSTRAINT "CustomServer_serverOid_fkey" FOREIGN KEY ("serverOid") REFERENCES "public"."Server"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomServerEnvironment" ADD CONSTRAINT "CustomServerEnvironment_serverVariantOid_fkey" FOREIGN KEY ("serverVariantOid") REFERENCES "public"."ServerVariant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomServerEnvironment" ADD CONSTRAINT "CustomServerEnvironment_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "public"."Instance"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomServerEnvironment" ADD CONSTRAINT "CustomServerEnvironment_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "public"."Organization"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomServerEnvironment" ADD CONSTRAINT "CustomServerEnvironment_customServerOid_fkey" FOREIGN KEY ("customServerOid") REFERENCES "public"."CustomServer"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomServerEnvironment" ADD CONSTRAINT "CustomServerEnvironment_currentVersionOid_fkey" FOREIGN KEY ("currentVersionOid") REFERENCES "public"."CustomServerVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomServerVersion" ADD CONSTRAINT "CustomServerVersion_customServerOid_fkey" FOREIGN KEY ("customServerOid") REFERENCES "public"."CustomServer"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomServerVersion" ADD CONSTRAINT "CustomServerVersion_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "public"."CustomServerEnvironment"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomServerVersion" ADD CONSTRAINT "CustomServerVersion_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "public"."Instance"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomServerVersion" ADD CONSTRAINT "CustomServerVersion_serverVersionOid_fkey" FOREIGN KEY ("serverVersionOid") REFERENCES "public"."ServerVersion"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomServerVersion" ADD CONSTRAINT "CustomServerVersion_remoteServerInstanceOid_fkey" FOREIGN KEY ("remoteServerInstanceOid") REFERENCES "public"."RemoteServerInstance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RemoteServerInstance" ADD CONSTRAINT "RemoteServerInstance_connectionOid_fkey" FOREIGN KEY ("connectionOid") REFERENCES "public"."ProviderOAuthConnection"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RemoteServerInstance" ADD CONSTRAINT "RemoteServerInstance_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "public"."Organization"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RemoteServerInstanceNotification" ADD CONSTRAINT "RemoteServerInstanceNotification_remoteServerInstanceOid_fkey" FOREIGN KEY ("remoteServerInstanceOid") REFERENCES "public"."RemoteServerInstance"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServerVariant" ADD CONSTRAINT "ServerVariant_defaultForInstanceOid_fkey" FOREIGN KEY ("defaultForInstanceOid") REFERENCES "public"."Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServerVariant" ADD CONSTRAINT "ServerVariant_onlyForInstanceOid_fkey" FOREIGN KEY ("onlyForInstanceOid") REFERENCES "public"."Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ServerVariant" ADD CONSTRAINT "ServerVariant_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "public"."Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;
