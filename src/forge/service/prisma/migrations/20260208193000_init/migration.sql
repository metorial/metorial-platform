-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('active', 'deleted');

-- CreateEnum
CREATE TYPE "WorkflowVersionStepType" AS ENUM ('script', 'upload_artifact', 'download_artifact');

-- CreateEnum
CREATE TYPE "WorkflowArtifactType" AS ENUM ('input', 'output');

-- CreateEnum
CREATE TYPE "WorkflowRunStatus" AS ENUM ('pending', 'running', 'succeeded', 'failed');

-- CreateEnum
CREATE TYPE "WorkflowRunStepType" AS ENUM ('setup', 'teardown', 'init', 'action', 'cleanup');

-- CreateEnum
CREATE TYPE "WorkflowRunStepStatus" AS ENUM ('pending', 'running', 'succeeded', 'failed', 'canceled');

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
CREATE TABLE "Provider" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Provider_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Workflow" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "WorkflowStatus" NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "providerOid" BIGINT NOT NULL,
    "currentVersionOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Workflow_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "WorkflowVersion" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "isCurrent" BOOLEAN NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "workflowOid" BIGINT NOT NULL,
    "providerOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowVersion_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "WorkflowVersionStep" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "WorkflowVersionStepType" NOT NULL,
    "name" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "workflowVersionOid" BIGINT NOT NULL,
    "artifactToDownloadOid" BIGINT,
    "artifactToDownloadPath" TEXT,
    "artifactToUploadPath" TEXT,
    "artifactToUploadName" TEXT,
    "initScript" TEXT[],
    "actionScript" TEXT[],
    "cleanupScript" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowVersionStep_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "WorkflowArtifact" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "WorkflowArtifactType" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "workflowOid" BIGINT NOT NULL,
    "runOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowArtifact_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "WorkflowRun" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "WorkflowRunStatus" NOT NULL,
    "workflowOid" BIGINT NOT NULL,
    "providerOid" BIGINT NOT NULL,
    "versionOid" BIGINT NOT NULL,
    "encryptedEnvironmentVariables" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "WorkflowRun_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "WorkflowRunStep" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "WorkflowRunStepType" NOT NULL,
    "status" "WorkflowRunStepStatus" NOT NULL,
    "name" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "runOid" BIGINT NOT NULL,
    "stepOid" BIGINT,
    "outputStorageKey" TEXT,
    "outputBucket" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "WorkflowRunStep_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "WorkflowRunOutputTemp" (
    "oid" BIGINT NOT NULL,
    "output" TEXT NOT NULL,
    "runOid" BIGINT NOT NULL,
    "stepOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowRunOutputTemp_pkey" PRIMARY KEY ("oid")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_id_key" ON "Tenant"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_identifier_key" ON "Tenant"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "Provider_id_key" ON "Provider"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Provider_identifier_key" ON "Provider"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "Workflow_id_key" ON "Workflow"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Workflow_tenantOid_identifier_key" ON "Workflow"("tenantOid", "identifier");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowVersion_id_key" ON "WorkflowVersion"("id");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowVersion_workflowOid_identifier_key" ON "WorkflowVersion"("workflowOid", "identifier");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowVersionStep_id_key" ON "WorkflowVersionStep"("id");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowArtifact_id_key" ON "WorkflowArtifact"("id");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowRun_id_key" ON "WorkflowRun"("id");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowRunStep_id_key" ON "WorkflowRunStep"("id");

-- AddForeignKey
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_currentVersionOid_fkey" FOREIGN KEY ("currentVersionOid") REFERENCES "WorkflowVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowVersion" ADD CONSTRAINT "WorkflowVersion_workflowOid_fkey" FOREIGN KEY ("workflowOid") REFERENCES "Workflow"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowVersion" ADD CONSTRAINT "WorkflowVersion_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowVersionStep" ADD CONSTRAINT "WorkflowVersionStep_workflowVersionOid_fkey" FOREIGN KEY ("workflowVersionOid") REFERENCES "WorkflowVersion"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowVersionStep" ADD CONSTRAINT "WorkflowVersionStep_artifactToDownloadOid_fkey" FOREIGN KEY ("artifactToDownloadOid") REFERENCES "WorkflowArtifact"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowArtifact" ADD CONSTRAINT "WorkflowArtifact_workflowOid_fkey" FOREIGN KEY ("workflowOid") REFERENCES "Workflow"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowArtifact" ADD CONSTRAINT "WorkflowArtifact_runOid_fkey" FOREIGN KEY ("runOid") REFERENCES "WorkflowRun"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_workflowOid_fkey" FOREIGN KEY ("workflowOid") REFERENCES "Workflow"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_versionOid_fkey" FOREIGN KEY ("versionOid") REFERENCES "WorkflowVersion"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRunStep" ADD CONSTRAINT "WorkflowRunStep_runOid_fkey" FOREIGN KEY ("runOid") REFERENCES "WorkflowRun"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRunStep" ADD CONSTRAINT "WorkflowRunStep_stepOid_fkey" FOREIGN KEY ("stepOid") REFERENCES "WorkflowVersionStep"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRunOutputTemp" ADD CONSTRAINT "WorkflowRunOutputTemp_runOid_fkey" FOREIGN KEY ("runOid") REFERENCES "WorkflowRun"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRunOutputTemp" ADD CONSTRAINT "WorkflowRunOutputTemp_stepOid_fkey" FOREIGN KEY ("stepOid") REFERENCES "WorkflowRunStep"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

