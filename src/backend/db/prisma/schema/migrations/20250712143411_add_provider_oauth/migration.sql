/*
  Warnings:

  - Added the required column `type` to the `Profile` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ProviderOAuthConnectionTemplateStatus" AS ENUM ('active', 'archived');

-- CreateEnum
CREATE TYPE "ProviderOAuthConnectionStatus" AS ENUM ('active', 'archived');

-- CreateEnum
CREATE TYPE "ProviderOAuthConnectionEventType" AS ENUM ('errors', 'config_auto_updated');

-- CreateEnum
CREATE TYPE "ProviderOAuthConnectionAuthAttemptStatus" AS ENUM ('pending', 'completed', 'failed');

-- AlterEnum
ALTER TYPE "ProfileType" ADD VALUE 'external';

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "type" "ProfileType" NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "ProviderOAuthConnectionTemplate" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "ProviderOAuthConnectionTemplateStatus" NOT NULL DEFAULT 'active',
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "providerName" TEXT NOT NULL,
    "providerUrl" TEXT NOT NULL,
    "discoveryUrl" TEXT,
    "configJsonata" TEXT NOT NULL,
    "variables" JSONB NOT NULL,
    "scopes" JSONB NOT NULL,
    "profileOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderOAuthConnectionTemplate_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderOAuthConnection" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "ProviderOAuthConnectionStatus" NOT NULL DEFAULT 'active',
    "metorialClientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "providerName" TEXT NOT NULL,
    "providerUrl" TEXT NOT NULL,
    "discoveryUrl" TEXT,
    "config" JSONB NOT NULL,
    "configHash" TEXT NOT NULL,
    "scopes" TEXT[],
    "clientId" TEXT NOT NULL,
    "clientSecret" TEXT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "templateOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderOAuthConnection_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderOAuthConnectionEvent" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "event" "ProviderOAuthConnectionEventType" NOT NULL,
    "discriminator" TEXT,
    "metadata" JSONB,
    "connectionOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderOAuthConnectionEvent_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderOAuthConnectionProfile" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "sub" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "rawProfile" JSONB,
    "connectionOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderOAuthConnectionProfile_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderOAuthConnectionAuthAttempt" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "stateIdentifier" TEXT,
    "clientSecret" TEXT,
    "status" "ProviderOAuthConnectionAuthAttemptStatus" NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "redirectUri" TEXT NOT NULL,
    "codeVerifier" TEXT,
    "connectionOid" BIGINT NOT NULL,
    "authTokenOid" BIGINT,
    "profileOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderOAuthConnectionAuthAttempt_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderOAuthConnectionAuthToken" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "scope" TEXT,
    "tokenType" TEXT,
    "idToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "connectionProfileOid" BIGINT,
    "connectionOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "refreshedAt" TIMESTAMP(3),

    CONSTRAINT "ProviderOAuthConnectionAuthToken_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderOAuthConnectionAuthTokenReference" (
    "oid" BIGSERIAL NOT NULL,
    "authTokenOid" BIGINT,

    CONSTRAINT "ProviderOAuthConnectionAuthTokenReference_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderOAuthDiscoveryDocument" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "providerName" TEXT NOT NULL,
    "providerUrl" TEXT NOT NULL,
    "discoveryUrl" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "configHash" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "refreshedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderOAuthDiscoveryDocument_pkey" PRIMARY KEY ("oid")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProviderOAuthConnectionTemplate_id_key" ON "ProviderOAuthConnectionTemplate"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderOAuthConnectionTemplate_slug_key" ON "ProviderOAuthConnectionTemplate"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderOAuthConnection_id_key" ON "ProviderOAuthConnection"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderOAuthConnection_metorialClientId_key" ON "ProviderOAuthConnection"("metorialClientId");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderOAuthConnectionEvent_id_key" ON "ProviderOAuthConnectionEvent"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderOAuthConnectionEvent_connectionOid_event_discrimina_key" ON "ProviderOAuthConnectionEvent"("connectionOid", "event", "discriminator");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderOAuthConnectionProfile_id_key" ON "ProviderOAuthConnectionProfile"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderOAuthConnectionProfile_connectionOid_sub_key" ON "ProviderOAuthConnectionProfile"("connectionOid", "sub");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderOAuthConnectionAuthAttempt_id_key" ON "ProviderOAuthConnectionAuthAttempt"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderOAuthConnectionAuthAttempt_stateIdentifier_key" ON "ProviderOAuthConnectionAuthAttempt"("stateIdentifier");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderOAuthConnectionAuthAttempt_clientSecret_key" ON "ProviderOAuthConnectionAuthAttempt"("clientSecret");

-- CreateIndex
CREATE INDEX "ProviderOAuthConnectionAuthAttempt_status_idx" ON "ProviderOAuthConnectionAuthAttempt"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderOAuthConnectionAuthToken_id_key" ON "ProviderOAuthConnectionAuthToken"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderOAuthDiscoveryDocument_id_key" ON "ProviderOAuthDiscoveryDocument"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderOAuthDiscoveryDocument_discoveryUrl_key" ON "ProviderOAuthDiscoveryDocument"("discoveryUrl");

-- AddForeignKey
ALTER TABLE "ProviderOAuthConnectionTemplate" ADD CONSTRAINT "ProviderOAuthConnectionTemplate_profileOid_fkey" FOREIGN KEY ("profileOid") REFERENCES "Profile"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderOAuthConnection" ADD CONSTRAINT "ProviderOAuthConnection_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderOAuthConnection" ADD CONSTRAINT "ProviderOAuthConnection_templateOid_fkey" FOREIGN KEY ("templateOid") REFERENCES "ProviderOAuthConnectionTemplate"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderOAuthConnectionEvent" ADD CONSTRAINT "ProviderOAuthConnectionEvent_connectionOid_fkey" FOREIGN KEY ("connectionOid") REFERENCES "ProviderOAuthConnection"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderOAuthConnectionProfile" ADD CONSTRAINT "ProviderOAuthConnectionProfile_connectionOid_fkey" FOREIGN KEY ("connectionOid") REFERENCES "ProviderOAuthConnection"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderOAuthConnectionAuthAttempt" ADD CONSTRAINT "ProviderOAuthConnectionAuthAttempt_connectionOid_fkey" FOREIGN KEY ("connectionOid") REFERENCES "ProviderOAuthConnection"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderOAuthConnectionAuthAttempt" ADD CONSTRAINT "ProviderOAuthConnectionAuthAttempt_authTokenOid_fkey" FOREIGN KEY ("authTokenOid") REFERENCES "ProviderOAuthConnectionAuthToken"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderOAuthConnectionAuthAttempt" ADD CONSTRAINT "ProviderOAuthConnectionAuthAttempt_profileOid_fkey" FOREIGN KEY ("profileOid") REFERENCES "ProviderOAuthConnectionProfile"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderOAuthConnectionAuthToken" ADD CONSTRAINT "ProviderOAuthConnectionAuthToken_connectionProfileOid_fkey" FOREIGN KEY ("connectionProfileOid") REFERENCES "ProviderOAuthConnectionProfile"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderOAuthConnectionAuthToken" ADD CONSTRAINT "ProviderOAuthConnectionAuthToken_connectionOid_fkey" FOREIGN KEY ("connectionOid") REFERENCES "ProviderOAuthConnection"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderOAuthConnectionAuthTokenReference" ADD CONSTRAINT "ProviderOAuthConnectionAuthTokenReference_authTokenOid_fkey" FOREIGN KEY ("authTokenOid") REFERENCES "ProviderOAuthConnectionAuthToken"("oid") ON DELETE SET NULL ON UPDATE CASCADE;
