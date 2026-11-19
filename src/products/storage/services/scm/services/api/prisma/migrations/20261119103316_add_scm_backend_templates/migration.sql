-- CreateEnum
CREATE TYPE "ScmBackendTemplateStatus" AS ENUM ('active', 'archived');

-- AlterTable
ALTER TABLE "ScmBackend" ADD COLUMN     "templateOid" BIGINT,
ADD COLUMN     "templateSecretVersion" INTEGER,
ADD COLUMN     "templateVersion" INTEGER;

-- CreateTable
CREATE TABLE "ScmBackendTemplate" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "type" "ScmBackendType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "apiUrl" TEXT NOT NULL,
    "webUrl" TEXT NOT NULL,
    "appId" TEXT,
    "appSlug" TEXT,
    "clientId" TEXT,
    "clientSecretNebulaSecretId" TEXT,
    "appPrivateKeyNebulaSecretId" TEXT,
    "appWebhookSecretNebulaSecretId" TEXT,
    "status" "ScmBackendTemplateStatus" NOT NULL DEFAULT 'active',
    "version" INTEGER NOT NULL DEFAULT 1,
    "secretVersion" INTEGER NOT NULL DEFAULT 1,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScmBackendTemplate_pkey" PRIMARY KEY ("oid")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScmBackendTemplate_id_key" ON "ScmBackendTemplate"("id");

-- CreateIndex
CREATE INDEX "ScmBackendTemplate_status_idx" ON "ScmBackendTemplate"("status");

-- CreateIndex
CREATE INDEX "ScmBackend_templateOid_idx" ON "ScmBackend"("templateOid");

-- CreateIndex
CREATE UNIQUE INDEX "ScmBackend_tenantOid_templateOid_key" ON "ScmBackend"("tenantOid", "templateOid");

-- AddForeignKey
ALTER TABLE "ScmBackend" ADD CONSTRAINT "ScmBackend_templateOid_fkey" FOREIGN KEY ("templateOid") REFERENCES "ScmBackendTemplate"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;
