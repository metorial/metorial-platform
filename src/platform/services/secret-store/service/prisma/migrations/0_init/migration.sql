-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ConsumerStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "ConsumerInstanceStatus" AS ENUM ('active', 'revoked', 'expired');

-- CreateEnum
CREATE TYPE "KeyProviderType" AS ENUM ('aws_kms', 'gcp_kms', 'azure_key_vault', 'local');

-- CreateEnum
CREATE TYPE "KeyProviderOwner" AS ENUM ('tenant', 'system');

-- CreateEnum
CREATE TYPE "KeyProviderStatus" AS ENUM ('active', 'inactive', 'degraded');

-- CreateEnum
CREATE TYPE "KeyProviderErrorOperation" AS ENUM ('create_system_provider', 'validate_provider', 'generate_data_key', 'decrypt_data_key');

-- CreateEnum
CREATE TYPE "SecretStatus" AS ENUM ('active', 'disabled', 'deleted');

-- CreateEnum
CREATE TYPE "SecretAlgorithm" AS ENUM ('aes_256_gcm');

-- CreateTable
CREATE TABLE "Consumer" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ConsumerStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Consumer_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ConsumerInstance" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "consumerOid" BIGINT NOT NULL,
    "identifier" TEXT NOT NULL,
    "tokenNonce" TEXT NOT NULL,
    "status" "ConsumerInstanceStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ConsumerInstance_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Key" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "keyProviderOid" BIGINT NOT NULL,
    "encryptedDataKey" BYTEA NOT NULL,
    "keyInfo" JSONB NOT NULL,
    "currentUntil" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retiredAt" TIMESTAMP(3),

    CONSTRAINT "Key_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "KeyProvider" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "systemIdentifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "KeyProviderType" NOT NULL,
    "owner" "KeyProviderOwner" NOT NULL,
    "status" "KeyProviderStatus" NOT NULL,
    "isMetorialManaged" BOOLEAN NOT NULL DEFAULT false,
    "keyInfo" JSONB NOT NULL,
    "keyReuseTimeSeconds" INTEGER,
    "tenantOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "KeyProvider_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "KeyError" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "keyProviderOid" BIGINT NOT NULL,
    "tenantOid" BIGINT,
    "day" TIMESTAMP(3) NOT NULL,
    "operation" "KeyProviderErrorOperation" NOT NULL,
    "code" TEXT NOT NULL,
    "messageHash" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "sampleMessage" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KeyError_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SecretPurpose" (
    "oid" INTEGER NOT NULL,
    "identifier" TEXT NOT NULL,

    CONSTRAINT "SecretPurpose_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Secret" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "consumerOid" BIGINT NOT NULL,
    "status" "SecretStatus" NOT NULL,
    "purpose" TEXT,
    "purposeOid" INTEGER,
    "currentVersionOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disabledAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Secret_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SecretVersion" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "secretOid" BIGINT NOT NULL,
    "keyOid" BIGINT NOT NULL,
    "keyProviderOid" BIGINT NOT NULL,
    "proofHash" TEXT NOT NULL,
    "encryptionContext" JSONB NOT NULL,
    "alg" "SecretAlgorithm" NOT NULL,
    "iv" BYTEA NOT NULL,
    "ciphertext" BYTEA NOT NULL,
    "authTag" BYTEA NOT NULL,
    "aadHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecretVersion_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SecretUse" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "secretOid" BIGINT NOT NULL,
    "consumerOid" BIGINT NOT NULL,
    "consumerInstanceOid" BIGINT NOT NULL,
    "note" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecretUse_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Tenant" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyReuseTimeSeconds" INTEGER,
    "defaultKeyProviderOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("oid")
);

-- CreateIndex
CREATE UNIQUE INDEX "Consumer_id_key" ON "Consumer"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Consumer_identifier_key" ON "Consumer"("identifier");

-- CreateIndex
CREATE INDEX "Consumer_status_idx" ON "Consumer"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerInstance_id_key" ON "ConsumerInstance"("id");

-- CreateIndex
CREATE INDEX "ConsumerInstance_consumerOid_status_idx" ON "ConsumerInstance"("consumerOid", "status");

-- CreateIndex
CREATE INDEX "ConsumerInstance_expiresAt_idx" ON "ConsumerInstance"("expiresAt");

-- CreateIndex
CREATE INDEX "ConsumerInstance_identifier_idx" ON "ConsumerInstance"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "Key_id_key" ON "Key"("id");

-- CreateIndex
CREATE INDEX "Key_tenantOid_keyProviderOid_currentUntil_idx" ON "Key"("tenantOid", "keyProviderOid", "currentUntil");

-- CreateIndex
CREATE UNIQUE INDEX "KeyProvider_id_key" ON "KeyProvider"("id");

-- CreateIndex
CREATE UNIQUE INDEX "KeyProvider_systemIdentifier_key" ON "KeyProvider"("systemIdentifier");

-- CreateIndex
CREATE INDEX "KeyProvider_tenantOid_idx" ON "KeyProvider"("tenantOid");

-- CreateIndex
CREATE UNIQUE INDEX "KeyError_id_key" ON "KeyError"("id");

-- CreateIndex
CREATE INDEX "KeyError_tenantOid_day_idx" ON "KeyError"("tenantOid", "day");

-- CreateIndex
CREATE INDEX "KeyError_day_idx" ON "KeyError"("day");

-- CreateIndex
CREATE UNIQUE INDEX "KeyError_keyProviderOid_day_operation_code_messageHash_key" ON "KeyError"("keyProviderOid", "day", "operation", "code", "messageHash");

-- CreateIndex
CREATE UNIQUE INDEX "SecretPurpose_identifier_key" ON "SecretPurpose"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "Secret_id_key" ON "Secret"("id");

-- CreateIndex
CREATE INDEX "Secret_tenantOid_status_idx" ON "Secret"("tenantOid", "status");

-- CreateIndex
CREATE INDEX "Secret_consumerOid_status_idx" ON "Secret"("consumerOid", "status");

-- CreateIndex
CREATE INDEX "Secret_status_disabledAt_idx" ON "Secret"("status", "disabledAt");

-- CreateIndex
CREATE UNIQUE INDEX "SecretVersion_id_key" ON "SecretVersion"("id");

-- CreateIndex
CREATE INDEX "SecretVersion_tenantOid_secretOid_idx" ON "SecretVersion"("tenantOid", "secretOid");

-- CreateIndex
CREATE INDEX "SecretVersion_keyOid_idx" ON "SecretVersion"("keyOid");

-- CreateIndex
CREATE UNIQUE INDEX "SecretUse_id_key" ON "SecretUse"("id");

-- CreateIndex
CREATE INDEX "SecretUse_ts_idx" ON "SecretUse"("ts");

-- CreateIndex
CREATE INDEX "SecretUse_tenantOid_secretOid_ts_idx" ON "SecretUse"("tenantOid", "secretOid", "ts");

-- CreateIndex
CREATE INDEX "SecretUse_consumerOid_ts_idx" ON "SecretUse"("consumerOid", "ts");

-- CreateIndex
CREATE INDEX "SecretUse_consumerInstanceOid_ts_idx" ON "SecretUse"("consumerInstanceOid", "ts");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_id_key" ON "Tenant"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_identifier_key" ON "Tenant"("identifier");

-- AddForeignKey
ALTER TABLE "ConsumerInstance" ADD CONSTRAINT "ConsumerInstance_consumerOid_fkey" FOREIGN KEY ("consumerOid") REFERENCES "Consumer"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Key" ADD CONSTRAINT "Key_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Key" ADD CONSTRAINT "Key_keyProviderOid_fkey" FOREIGN KEY ("keyProviderOid") REFERENCES "KeyProvider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeyProvider" ADD CONSTRAINT "KeyProvider_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeyError" ADD CONSTRAINT "KeyError_keyProviderOid_fkey" FOREIGN KEY ("keyProviderOid") REFERENCES "KeyProvider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeyError" ADD CONSTRAINT "KeyError_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Secret" ADD CONSTRAINT "Secret_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Secret" ADD CONSTRAINT "Secret_consumerOid_fkey" FOREIGN KEY ("consumerOid") REFERENCES "Consumer"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Secret" ADD CONSTRAINT "Secret_purposeOid_fkey" FOREIGN KEY ("purposeOid") REFERENCES "SecretPurpose"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Secret" ADD CONSTRAINT "Secret_currentVersionOid_fkey" FOREIGN KEY ("currentVersionOid") REFERENCES "SecretVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecretVersion" ADD CONSTRAINT "SecretVersion_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecretVersion" ADD CONSTRAINT "SecretVersion_secretOid_fkey" FOREIGN KEY ("secretOid") REFERENCES "Secret"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecretVersion" ADD CONSTRAINT "SecretVersion_keyOid_fkey" FOREIGN KEY ("keyOid") REFERENCES "Key"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecretVersion" ADD CONSTRAINT "SecretVersion_keyProviderOid_fkey" FOREIGN KEY ("keyProviderOid") REFERENCES "KeyProvider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecretUse" ADD CONSTRAINT "SecretUse_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecretUse" ADD CONSTRAINT "SecretUse_secretOid_fkey" FOREIGN KEY ("secretOid") REFERENCES "Secret"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecretUse" ADD CONSTRAINT "SecretUse_consumerOid_fkey" FOREIGN KEY ("consumerOid") REFERENCES "Consumer"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecretUse" ADD CONSTRAINT "SecretUse_consumerInstanceOid_fkey" FOREIGN KEY ("consumerInstanceOid") REFERENCES "ConsumerInstance"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_defaultKeyProviderOid_fkey" FOREIGN KEY ("defaultKeyProviderOid") REFERENCES "KeyProvider"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

