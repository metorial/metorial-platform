/*
  Warnings:

  - You are about to drop the column `config` on the `ProviderOAuthConnection` table. All the data in the column will be lost.
  - You are about to drop the column `configHash` on the `ProviderOAuthConnection` table. All the data in the column will be lost.
  - You are about to drop the column `scopes` on the `ProviderOAuthConnection` table. All the data in the column will be lost.
  - You are about to drop the column `providerOAuthConfig` on the `RemoteServerInstance` table. All the data in the column will be lost.
  - You are about to drop the column `providerOAuthDiscoveryDocumentOid` on the `RemoteServerInstance` table. All the data in the column will be lost.
  - You are about to drop the column `serverVariantOid` on the `ServerConfigSchema` table. All the data in the column will be lost.
  - Added the required column `configOid` to the `ProviderOAuthConnection` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "public"."RemoteServerInstanceProviderOAuthDiscoveryStatus" ADD VALUE 'manual_config';

-- DropForeignKey
ALTER TABLE "public"."RemoteServerInstance" DROP CONSTRAINT "RemoteServerInstance_providerOAuthDiscoveryDocumentOid_fkey";

-- DropForeignKey
ALTER TABLE "public"."ServerConfigSchema" DROP CONSTRAINT "ServerConfigSchema_serverVariantOid_fkey";

-- AlterTable
ALTER TABLE "public"."ProviderOAuthConnection" DROP COLUMN "config",
DROP COLUMN "configHash",
DROP COLUMN "scopes",
ADD COLUMN     "configOid" BIGINT NOT NULL;

-- AlterTable
ALTER TABLE "public"."RemoteServerInstance" DROP COLUMN "providerOAuthConfig",
DROP COLUMN "providerOAuthDiscoveryDocumentOid",
ADD COLUMN     "providerOAuthConfigOid" BIGINT;

-- AlterTable
ALTER TABLE "public"."ServerConfigSchema" DROP COLUMN "serverVariantOid";

-- CreateTable
CREATE TABLE "public"."ProviderOAuthConfig" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "configHash" TEXT NOT NULL,
    "scopes" TEXT[],
    "instanceOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderOAuthConfig_pkey" PRIMARY KEY ("oid")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProviderOAuthConfig_id_key" ON "public"."ProviderOAuthConfig"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderOAuthConfig_instanceOid_configHash_key" ON "public"."ProviderOAuthConfig"("instanceOid", "configHash");

-- AddForeignKey
ALTER TABLE "public"."RemoteServerInstance" ADD CONSTRAINT "RemoteServerInstance_providerOAuthConfigOid_fkey" FOREIGN KEY ("providerOAuthConfigOid") REFERENCES "public"."ProviderOAuthConfig"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProviderOAuthConfig" ADD CONSTRAINT "ProviderOAuthConfig_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "public"."Instance"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProviderOAuthConnection" ADD CONSTRAINT "ProviderOAuthConnection_configOid_fkey" FOREIGN KEY ("configOid") REFERENCES "public"."ProviderOAuthConfig"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;
