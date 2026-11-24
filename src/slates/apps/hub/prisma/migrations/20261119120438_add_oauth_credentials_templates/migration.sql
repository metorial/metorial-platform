-- CreateEnum
CREATE TYPE "SlateOAuthCredentialsTemplateStatus" AS ENUM ('active', 'archived');

-- AlterTable
ALTER TABLE "SlateOAuthCredentials" ADD COLUMN     "authMethodKey" TEXT,
ADD COLUMN     "fixedInput" JSONB,
ADD COLUMN     "templateOid" BIGINT,
ADD COLUMN     "templateSecretVersion" INTEGER,
ADD COLUMN     "templateVersion" INTEGER;

-- CreateTable
CREATE TABLE "SlateOAuthCredentialsTemplate" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SlateOAuthCredentialsTemplateStatus" NOT NULL DEFAULT 'active',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "slateOid" BIGINT NOT NULL,
    "authMethodKey" TEXT NOT NULL,
    "fixedInput" JSONB,
    "clientId" TEXT NOT NULL,
    "scopes" TEXT[],
    "secretOid" BIGINT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "secretVersion" INTEGER NOT NULL DEFAULT 1,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateOAuthCredentialsTemplate_pkey" PRIMARY KEY ("oid")
);

-- CreateIndex
CREATE UNIQUE INDEX "SlateOAuthCredentialsTemplate_id_key" ON "SlateOAuthCredentialsTemplate"("id");

-- CreateIndex
CREATE INDEX "SlateOAuthCredentialsTemplate_status_idx" ON "SlateOAuthCredentialsTemplate"("status");

-- CreateIndex
CREATE INDEX "SlateOAuthCredentials_templateOid_idx" ON "SlateOAuthCredentials"("templateOid");

-- CreateIndex
CREATE UNIQUE INDEX "SlateOAuthCredentials_tenantOid_templateOid_key" ON "SlateOAuthCredentials"("tenantOid", "templateOid");

-- AddForeignKey
ALTER TABLE "SlateOAuthCredentials" ADD CONSTRAINT "SlateOAuthCredentials_templateOid_fkey" FOREIGN KEY ("templateOid") REFERENCES "SlateOAuthCredentialsTemplate"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateOAuthCredentialsTemplate" ADD CONSTRAINT "SlateOAuthCredentialsTemplate_slateOid_fkey" FOREIGN KEY ("slateOid") REFERENCES "Slate"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateOAuthCredentialsTemplate" ADD CONSTRAINT "SlateOAuthCredentialsTemplate_secretOid_fkey" FOREIGN KEY ("secretOid") REFERENCES "Secret"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;
