-- CreateEnum
CREATE TYPE "SubRegistryFilterType" AS ENUM ('scope', 'prefix', 'package');

-- CreateEnum
CREATE TYPE "ScopeType" AS ENUM ('user', 'workspace');

-- CreateEnum
CREATE TYPE "ScopeStatus" AS ENUM ('active', 'deleted');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'deleted');

-- CreateEnum
CREATE TYPE "UserTenantAccess" AS ENUM ('read', 'read_write');

-- CreateEnum
CREATE TYPE "WorkspaceStatus" AS ENUM ('active', 'deleted');

-- CreateEnum
CREATE TYPE "TokenStatus" AS ENUM ('active', 'revoked', 'expired');

-- CreateEnum
CREATE TYPE "SlateStatus" AS ENUM ('active', 'deleted');

-- CreateEnum
CREATE TYPE "SlateAccess" AS ENUM ('public', 'private');

-- CreateEnum
CREATE TYPE "ChangeNotificationType" AS ENUM ('slate_version_created');

-- CreateTable
CREATE TABLE "Tenant" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SubRegistry" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubRegistry_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SubRegistryFilter" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "SubRegistryFilterType" NOT NULL,
    "value" TEXT NOT NULL,
    "subRegistryOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubRegistryFilter_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Scope" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "ScopeType" NOT NULL,
    "status" "ScopeStatus" NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "links" JSONB NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Scope_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "User" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL,
    "access" "UserTenantAccess" NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scopeOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Workspace" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "WorkspaceStatus" NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scopeOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "UserToken" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "TokenStatus" NOT NULL,
    "name" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "userOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "UserToken_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ReaderToken" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "TokenStatus" NOT NULL,
    "name" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "tenantOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "ReaderToken_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateCategory" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateCategory_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Slate" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SlateStatus" NOT NULL,
    "access" "SlateAccess" NOT NULL,
    "identifier" TEXT NOT NULL,
    "fullIdentifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "skills" TEXT[],
    "description" TEXT,
    "scopeOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "createdByUserOid" BIGINT NOT NULL,
    "currentVersionOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Slate_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateCategoryAssignment" (
    "slateOid" BIGINT NOT NULL,
    "categoryOid" BIGINT NOT NULL,

    CONSTRAINT "SlateCategoryAssignment_pkey" PRIMARY KEY ("slateOid","categoryOid")
);

-- CreateTable
CREATE TABLE "SlateVersion" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "isCurrent" BOOLEAN NOT NULL,
    "version" TEXT NOT NULL,
    "slateJson" JSONB NOT NULL,
    "slateOid" BIGINT NOT NULL,
    "bundleArtifactOid" BIGINT NOT NULL,
    "createdByUserOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateVersion_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateDocument" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "slateVersionOid" BIGINT NOT NULL,
    "path" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateDocument_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Artifact" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "size" BIGINT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Artifact_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "AdminSession" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "adminUserOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ChangeNotification" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "ChangeNotificationType" NOT NULL,
    "slateId" TEXT NOT NULL,
    "slateIdentifier" TEXT NOT NULL,
    "slateFullIdentifier" TEXT NOT NULL,
    "slateVersionId" TEXT,
    "slateVersionIdentifier" TEXT,
    "slateOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "slateVersionOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChangeNotification_pkey" PRIMARY KEY ("oid")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_id_key" ON "Tenant"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_identifier_key" ON "Tenant"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "SubRegistry_id_key" ON "SubRegistry"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SubRegistry_identifier_key" ON "SubRegistry"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "SubRegistryFilter_id_key" ON "SubRegistryFilter"("id");

-- CreateIndex
CREATE INDEX "SubRegistryFilter_subRegistryOid_idx" ON "SubRegistryFilter"("subRegistryOid");

-- CreateIndex
CREATE UNIQUE INDEX "SubRegistryFilter_subRegistryOid_type_value_key" ON "SubRegistryFilter"("subRegistryOid", "type", "value");

-- CreateIndex
CREATE UNIQUE INDEX "Scope_id_key" ON "Scope"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Scope_identifier_key" ON "Scope"("identifier");

-- CreateIndex
CREATE INDEX "Scope_type_idx" ON "Scope"("type");

-- CreateIndex
CREATE UNIQUE INDEX "User_id_key" ON "User"("id");

-- CreateIndex
CREATE UNIQUE INDEX "User_identifier_key" ON "User"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "User_scopeOid_key" ON "User"("scopeOid");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_id_key" ON "Workspace"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_identifier_key" ON "Workspace"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_scopeOid_key" ON "Workspace"("scopeOid");

-- CreateIndex
CREATE UNIQUE INDEX "UserToken_id_key" ON "UserToken"("id");

-- CreateIndex
CREATE UNIQUE INDEX "UserToken_secret_key" ON "UserToken"("secret");

-- CreateIndex
CREATE INDEX "UserToken_expiresAt_idx" ON "UserToken"("expiresAt");

-- CreateIndex
CREATE INDEX "UserToken_status_idx" ON "UserToken"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ReaderToken_id_key" ON "ReaderToken"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ReaderToken_secret_key" ON "ReaderToken"("secret");

-- CreateIndex
CREATE INDEX "ReaderToken_expiresAt_idx" ON "ReaderToken"("expiresAt");

-- CreateIndex
CREATE INDEX "ReaderToken_status_idx" ON "ReaderToken"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SlateCategory_id_key" ON "SlateCategory"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SlateCategory_identifier_key" ON "SlateCategory"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "Slate_id_key" ON "Slate"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Slate_identifier_key" ON "Slate"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "Slate_fullIdentifier_key" ON "Slate"("fullIdentifier");

-- CreateIndex
CREATE INDEX "Slate_fullIdentifier_idx" ON "Slate"("fullIdentifier");

-- CreateIndex
CREATE INDEX "Slate_access_idx" ON "Slate"("access");

-- CreateIndex
CREATE INDEX "Slate_tenantOid_access_idx" ON "Slate"("tenantOid", "access");

-- CreateIndex
CREATE INDEX "Slate_scopeOid_idx" ON "Slate"("scopeOid");

-- CreateIndex
CREATE UNIQUE INDEX "SlateVersion_id_key" ON "SlateVersion"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SlateVersion_slateOid_version_key" ON "SlateVersion"("slateOid", "version");

-- CreateIndex
CREATE UNIQUE INDEX "SlateDocument_id_key" ON "SlateDocument"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SlateDocument_slateVersionOid_path_key" ON "SlateDocument"("slateVersionOid", "path");

-- CreateIndex
CREATE UNIQUE INDEX "Artifact_id_key" ON "Artifact"("id");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_id_key" ON "AdminUser"("id");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AdminSession_id_key" ON "AdminSession"("id");

-- CreateIndex
CREATE UNIQUE INDEX "AdminSession_token_key" ON "AdminSession"("token");

-- CreateIndex
CREATE INDEX "AdminSession_token_idx" ON "AdminSession"("token");

-- CreateIndex
CREATE INDEX "AdminSession_expiresAt_idx" ON "AdminSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChangeNotification_id_key" ON "ChangeNotification"("id");

-- CreateIndex
CREATE INDEX "ChangeNotification_type_idx" ON "ChangeNotification"("type");

-- AddForeignKey
ALTER TABLE "SubRegistry" ADD CONSTRAINT "SubRegistry_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubRegistryFilter" ADD CONSTRAINT "SubRegistryFilter_subRegistryOid_fkey" FOREIGN KEY ("subRegistryOid") REFERENCES "SubRegistry"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scope" ADD CONSTRAINT "Scope_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_scopeOid_fkey" FOREIGN KEY ("scopeOid") REFERENCES "Scope"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_scopeOid_fkey" FOREIGN KEY ("scopeOid") REFERENCES "Scope"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserToken" ADD CONSTRAINT "UserToken_userOid_fkey" FOREIGN KEY ("userOid") REFERENCES "User"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserToken" ADD CONSTRAINT "UserToken_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReaderToken" ADD CONSTRAINT "ReaderToken_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Slate" ADD CONSTRAINT "Slate_scopeOid_fkey" FOREIGN KEY ("scopeOid") REFERENCES "Scope"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Slate" ADD CONSTRAINT "Slate_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Slate" ADD CONSTRAINT "Slate_createdByUserOid_fkey" FOREIGN KEY ("createdByUserOid") REFERENCES "User"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Slate" ADD CONSTRAINT "Slate_currentVersionOid_fkey" FOREIGN KEY ("currentVersionOid") REFERENCES "SlateVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateCategoryAssignment" ADD CONSTRAINT "SlateCategoryAssignment_slateOid_fkey" FOREIGN KEY ("slateOid") REFERENCES "Slate"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateCategoryAssignment" ADD CONSTRAINT "SlateCategoryAssignment_categoryOid_fkey" FOREIGN KEY ("categoryOid") REFERENCES "SlateCategory"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateVersion" ADD CONSTRAINT "SlateVersion_slateOid_fkey" FOREIGN KEY ("slateOid") REFERENCES "Slate"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateVersion" ADD CONSTRAINT "SlateVersion_bundleArtifactOid_fkey" FOREIGN KEY ("bundleArtifactOid") REFERENCES "Artifact"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateVersion" ADD CONSTRAINT "SlateVersion_createdByUserOid_fkey" FOREIGN KEY ("createdByUserOid") REFERENCES "User"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateDocument" ADD CONSTRAINT "SlateDocument_slateVersionOid_fkey" FOREIGN KEY ("slateVersionOid") REFERENCES "SlateVersion"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminSession" ADD CONSTRAINT "AdminSession_adminUserOid_fkey" FOREIGN KEY ("adminUserOid") REFERENCES "AdminUser"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeNotification" ADD CONSTRAINT "ChangeNotification_slateOid_fkey" FOREIGN KEY ("slateOid") REFERENCES "Slate"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeNotification" ADD CONSTRAINT "ChangeNotification_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeNotification" ADD CONSTRAINT "ChangeNotification_slateVersionOid_fkey" FOREIGN KEY ("slateVersionOid") REFERENCES "SlateVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;
