-- CreateEnum
CREATE TYPE "SlateVersionOrigin" AS ENUM ('upload', 'upstream', 'pack');

-- CreateEnum
CREATE TYPE "RegistrySigningKeyStatus" AS ENUM ('active', 'revoked');

-- CreateEnum
CREATE TYPE "TrustedSigningKeySource" AS ENUM ('license');

-- CreateEnum
CREATE TYPE "MirrorUpstreamSource" AS ENUM ('license', 'manual', 'static');

-- CreateEnum
CREATE TYPE "MirrorUpstreamStatus" AS ENUM ('active', 'paused', 'archived');

-- CreateEnum
CREATE TYPE "SlatePackImportStatus" AS ENUM ('pending', 'processing', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "MirrorResultStatus" AS ENUM ('imported', 'skipped', 'conflict', 'rejected');

-- CreateEnum
CREATE TYPE "SlateActivationMode" AS ENUM ('latest', 'pinned');

-- AlterEnum
ALTER TYPE "ChangeNotificationType" ADD VALUE 'slate_activated';

-- AlterTable
ALTER TABLE "SubRegistry" ADD COLUMN     "onlyActivated" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "SlateVersion" ADD COLUMN     "origin" "SlateVersionOrigin" NOT NULL DEFAULT 'upload',
ADD COLUMN     "originPackImportOid" BIGINT,
ADD COLUMN     "originUpstreamOid" BIGINT;

-- CreateTable
CREATE TABLE "RegistrySigningKey" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "RegistrySigningKeyStatus" NOT NULL,
    "kid" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "publicKey" JSONB NOT NULL,
    "encryptedPrivateKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "RegistrySigningKey_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateVersionSignature" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "kid" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "slateVersionOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateVersionSignature_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "TrustedSigningKey" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "kid" TEXT NOT NULL,
    "source" "TrustedSigningKeySource" NOT NULL,
    "publicKey" JSONB NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrustedSigningKey_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "MirrorSettings" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "licenseOperational" BOOLEAN NOT NULL DEFAULT false,
    "configuredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MirrorSettings_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "MirrorUpstream" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "source" "MirrorUpstreamSource" NOT NULL,
    "status" "MirrorUpstreamStatus" NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "subRegistryId" TEXT,
    "changeNotificationCursor" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "lastSyncErrorAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "MirrorUpstream_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlatePackImport" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SlatePackImportStatus" NOT NULL,
    "fileName" TEXT NOT NULL,
    "size" BIGINT NOT NULL,
    "bucket" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "conflictCount" INTEGER NOT NULL DEFAULT 0,
    "rejectedCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "SlatePackImport_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "MirrorResult" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "MirrorResultStatus" NOT NULL,
    "slateIdentifier" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "message" TEXT,
    "upstreamOid" BIGINT,
    "packImportOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MirrorResult_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateActivation" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "mode" "SlateActivationMode" NOT NULL,
    "slateOid" BIGINT NOT NULL,
    "pinnedVersionOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateActivation_pkey" PRIMARY KEY ("oid")
);

-- CreateIndex
CREATE UNIQUE INDEX "RegistrySigningKey_id_key" ON "RegistrySigningKey"("id");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrySigningKey_kid_key" ON "RegistrySigningKey"("kid");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrySigningKey_period_key" ON "RegistrySigningKey"("period");

-- CreateIndex
CREATE UNIQUE INDEX "SlateVersionSignature_id_key" ON "SlateVersionSignature"("id");

-- CreateIndex
CREATE INDEX "SlateVersionSignature_kid_idx" ON "SlateVersionSignature"("kid");

-- CreateIndex
CREATE UNIQUE INDEX "SlateVersionSignature_slateVersionOid_kid_key" ON "SlateVersionSignature"("slateVersionOid", "kid");

-- CreateIndex
CREATE UNIQUE INDEX "TrustedSigningKey_id_key" ON "TrustedSigningKey"("id");

-- CreateIndex
CREATE UNIQUE INDEX "TrustedSigningKey_kid_key" ON "TrustedSigningKey"("kid");

-- CreateIndex
CREATE UNIQUE INDEX "MirrorSettings_id_key" ON "MirrorSettings"("id");

-- CreateIndex
CREATE UNIQUE INDEX "MirrorUpstream_id_key" ON "MirrorUpstream"("id");

-- CreateIndex
CREATE UNIQUE INDEX "MirrorUpstream_identifier_key" ON "MirrorUpstream"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "SlatePackImport_id_key" ON "SlatePackImport"("id");

-- CreateIndex
CREATE UNIQUE INDEX "MirrorResult_id_key" ON "MirrorResult"("id");

-- CreateIndex
CREATE INDEX "MirrorResult_upstreamOid_createdAt_idx" ON "MirrorResult"("upstreamOid", "createdAt");

-- CreateIndex
CREATE INDEX "MirrorResult_packImportOid_idx" ON "MirrorResult"("packImportOid");

-- CreateIndex
CREATE INDEX "MirrorResult_status_createdAt_idx" ON "MirrorResult"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SlateActivation_id_key" ON "SlateActivation"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SlateActivation_slateOid_key" ON "SlateActivation"("slateOid");

-- AddForeignKey
ALTER TABLE "SlateVersion" ADD CONSTRAINT "SlateVersion_originUpstreamOid_fkey" FOREIGN KEY ("originUpstreamOid") REFERENCES "MirrorUpstream"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateVersion" ADD CONSTRAINT "SlateVersion_originPackImportOid_fkey" FOREIGN KEY ("originPackImportOid") REFERENCES "SlatePackImport"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateVersionSignature" ADD CONSTRAINT "SlateVersionSignature_slateVersionOid_fkey" FOREIGN KEY ("slateVersionOid") REFERENCES "SlateVersion"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MirrorResult" ADD CONSTRAINT "MirrorResult_upstreamOid_fkey" FOREIGN KEY ("upstreamOid") REFERENCES "MirrorUpstream"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MirrorResult" ADD CONSTRAINT "MirrorResult_packImportOid_fkey" FOREIGN KEY ("packImportOid") REFERENCES "SlatePackImport"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateActivation" ADD CONSTRAINT "SlateActivation_slateOid_fkey" FOREIGN KEY ("slateOid") REFERENCES "Slate"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateActivation" ADD CONSTRAINT "SlateActivation_pinnedVersionOid_fkey" FOREIGN KEY ("pinnedVersionOid") REFERENCES "SlateVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;
