-- CreateEnum
CREATE TYPE "UserTwoFactorMethod" AS ENUM ('totp', 'passkey');

-- CreateEnum
CREATE TYPE "UserTwoFactorSetupStatus" AS ENUM ('pending', 'ready', 'completed', 'cancelled');

-- AlterEnum
ALTER TYPE "AuthIntentStepType" ADD VALUE 'two_factor';

-- AlterTable
ALTER TABLE "AuthIntent" ADD COLUMN     "twoFactorRevision" INTEGER;

-- AlterTable
ALTER TABLE "AuthIntentStep" ADD COLUMN     "challenge" TEXT,
ADD COLUMN     "challengeExpiresAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "twoFactorRevision" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "UserTwoFactor" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "method" "UserTwoFactorMethod" NOT NULL,
    "name" TEXT NOT NULL,
    "encryptedSecret" TEXT,
    "lastTimeStep" INTEGER,
    "credentialId" TEXT,
    "publicKey" BYTEA,
    "counter" BIGINT NOT NULL DEFAULT 0,
    "transports" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "deviceType" TEXT,
    "backedUp" BOOLEAN NOT NULL DEFAULT false,
    "userOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "UserTwoFactor_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "UserRecoveryCode" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "userOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumedAt" TIMESTAMP(3),

    CONSTRAINT "UserRecoveryCode_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "UserTwoFactorSetup" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "method" "UserTwoFactorMethod",
    "status" "UserTwoFactorSetupStatus" NOT NULL DEFAULT 'pending',
    "revision" INTEGER NOT NULL,
    "name" TEXT,
    "encryptedSecret" TEXT,
    "lastTimeStep" INTEGER,
    "credentialId" TEXT,
    "publicKey" BYTEA,
    "counter" BIGINT NOT NULL DEFAULT 0,
    "transports" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "deviceType" TEXT,
    "backedUp" BOOLEAN NOT NULL DEFAULT false,
    "challenge" TEXT,
    "challengeExpiresAt" TIMESTAMP(3),
    "failures" INTEGER NOT NULL DEFAULT 0,
    "encryptedRecoveryCodes" TEXT,
    "callbackUrl" TEXT NOT NULL,
    "returnUrl" TEXT NOT NULL,
    "userOid" BIGINT NOT NULL,
    "sessionOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "UserTwoFactorSetup_pkey" PRIMARY KEY ("oid")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserTwoFactor_id_key" ON "UserTwoFactor"("id");

-- CreateIndex
CREATE UNIQUE INDEX "UserTwoFactor_credentialId_key" ON "UserTwoFactor"("credentialId");

-- CreateIndex
CREATE INDEX "UserTwoFactor_userOid_method_idx" ON "UserTwoFactor"("userOid", "method");

-- CreateIndex
CREATE UNIQUE INDEX "UserRecoveryCode_id_key" ON "UserRecoveryCode"("id");

-- CreateIndex
CREATE UNIQUE INDEX "UserRecoveryCode_userOid_hash_key" ON "UserRecoveryCode"("userOid", "hash");

-- CreateIndex
CREATE UNIQUE INDEX "UserTwoFactorSetup_id_key" ON "UserTwoFactorSetup"("id");

-- CreateIndex
CREATE UNIQUE INDEX "UserTwoFactorSetup_secretHash_key" ON "UserTwoFactorSetup"("secretHash");

-- CreateIndex
CREATE INDEX "UserTwoFactorSetup_expiresAt_id_idx" ON "UserTwoFactorSetup"("expiresAt", "id");

-- CreateIndex
CREATE INDEX "UserTwoFactorSetup_userOid_createdAt_idx" ON "UserTwoFactorSetup"("userOid", "createdAt");

-- AddForeignKey
ALTER TABLE "UserTwoFactor" ADD CONSTRAINT "UserTwoFactor_userOid_fkey" FOREIGN KEY ("userOid") REFERENCES "User"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRecoveryCode" ADD CONSTRAINT "UserRecoveryCode_userOid_fkey" FOREIGN KEY ("userOid") REFERENCES "User"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTwoFactorSetup" ADD CONSTRAINT "UserTwoFactorSetup_userOid_fkey" FOREIGN KEY ("userOid") REFERENCES "User"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTwoFactorSetup" ADD CONSTRAINT "UserTwoFactorSetup_sessionOid_fkey" FOREIGN KEY ("sessionOid") REFERENCES "AuthDeviceUserSession"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

