-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "FunctionStatus" AS ENUM ('active', 'deleted');

-- CreateEnum
CREATE TYPE "FunctionDeploymentStatus" AS ENUM ('pending', 'running', 'succeeded', 'failed');

-- CreateEnum
CREATE TYPE "FunctionDeploymentStepStatus" AS ENUM ('pending', 'running', 'succeeded', 'failed', 'canceled');

-- CreateEnum
CREATE TYPE "FunctionDeploymentStepType" AS ENUM ('deploy');

-- CreateEnum
CREATE TYPE "FunctionVersionStatus" AS ENUM ('active', 'deleted');

-- CreateEnum
CREATE TYPE "FunctionInvocationStatus" AS ENUM ('succeeded', 'failed');

-- CreateEnum
CREATE TYPE "FunctionBundleStatus" AS ENUM ('uploading', 'available', 'failed');

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
CREATE TABLE "Runtime" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "providerOid" BIGINT NOT NULL,
    "configuration" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Runtime_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "RuntimeForgeWorkflow" (
    "oid" BIGINT NOT NULL,
    "runtimeOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "forgeWorkflowId" TEXT NOT NULL,
    "forgeTenantId" TEXT NOT NULL,
    "forgeWorkflowVersionId" TEXT NOT NULL,

    CONSTRAINT "RuntimeForgeWorkflow_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Function" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "FunctionStatus" NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currentVersionOid" BIGINT,
    "tenantOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "runtimeOid" BIGINT,

    CONSTRAINT "Function_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "FunctionDeployment" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "FunctionDeploymentStatus" NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "forgeRunId" TEXT,
    "forgeWorkflowId" TEXT,
    "functionVersionOid" BIGINT,
    "functionBundleOid" BIGINT,
    "runtimeOid" BIGINT NOT NULL,
    "functionOid" BIGINT NOT NULL,
    "encryptedEnvironmentVariables" TEXT NOT NULL,
    "configuration" JSONB NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FunctionDeployment_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "FunctionDeploymentStep" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "FunctionDeploymentStepStatus" NOT NULL,
    "type" "FunctionDeploymentStepType" NOT NULL,
    "name" TEXT NOT NULL,
    "output" TEXT NOT NULL,
    "functionDeploymentOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "FunctionDeploymentStep_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "FunctionVersion" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "FunctionVersionStatus" NOT NULL,
    "encryptedEnvironmentVariables" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "functionOid" BIGINT NOT NULL,
    "runtimeOid" BIGINT NOT NULL,
    "functionBundleOid" BIGINT NOT NULL,
    "configuration" JSONB NOT NULL,
    "providerData" JSONB NOT NULL,
    "manifest" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FunctionVersion_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "FunctionInvocation" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "FunctionInvocationStatus" NOT NULL,
    "functionVersionOid" BIGINT NOT NULL,
    "error" JSONB NOT NULL,
    "logs" TEXT NOT NULL,
    "computeTimeMs" INTEGER NOT NULL,
    "billedTimeMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FunctionInvocation_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "FunctionBundle" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "FunctionBundleStatus" NOT NULL,
    "functionOid" BIGINT NOT NULL,
    "storageKey" TEXT,
    "bucket" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FunctionBundle_pkey" PRIMARY KEY ("oid")
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
CREATE UNIQUE INDEX "Runtime_id_key" ON "Runtime"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Runtime_identifier_key" ON "Runtime"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "RuntimeForgeWorkflow_runtimeOid_tenantOid_key" ON "RuntimeForgeWorkflow"("runtimeOid", "tenantOid");

-- CreateIndex
CREATE UNIQUE INDEX "Function_id_key" ON "Function"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Function_identifier_tenantOid_key" ON "Function"("identifier", "tenantOid");

-- CreateIndex
CREATE UNIQUE INDEX "FunctionDeployment_id_key" ON "FunctionDeployment"("id");

-- CreateIndex
CREATE UNIQUE INDEX "FunctionDeployment_identifier_functionOid_key" ON "FunctionDeployment"("identifier", "functionOid");

-- CreateIndex
CREATE UNIQUE INDEX "FunctionDeploymentStep_id_key" ON "FunctionDeploymentStep"("id");

-- CreateIndex
CREATE UNIQUE INDEX "FunctionVersion_id_key" ON "FunctionVersion"("id");

-- CreateIndex
CREATE UNIQUE INDEX "FunctionVersion_identifier_functionOid_key" ON "FunctionVersion"("identifier", "functionOid");

-- CreateIndex
CREATE UNIQUE INDEX "FunctionInvocation_id_key" ON "FunctionInvocation"("id");

-- CreateIndex
CREATE UNIQUE INDEX "FunctionBundle_id_key" ON "FunctionBundle"("id");

-- AddForeignKey
ALTER TABLE "Runtime" ADD CONSTRAINT "Runtime_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuntimeForgeWorkflow" ADD CONSTRAINT "RuntimeForgeWorkflow_runtimeOid_fkey" FOREIGN KEY ("runtimeOid") REFERENCES "Runtime"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuntimeForgeWorkflow" ADD CONSTRAINT "RuntimeForgeWorkflow_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Function" ADD CONSTRAINT "Function_currentVersionOid_fkey" FOREIGN KEY ("currentVersionOid") REFERENCES "FunctionVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Function" ADD CONSTRAINT "Function_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Function" ADD CONSTRAINT "Function_runtimeOid_fkey" FOREIGN KEY ("runtimeOid") REFERENCES "Runtime"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunctionDeployment" ADD CONSTRAINT "FunctionDeployment_functionVersionOid_fkey" FOREIGN KEY ("functionVersionOid") REFERENCES "FunctionVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunctionDeployment" ADD CONSTRAINT "FunctionDeployment_functionBundleOid_fkey" FOREIGN KEY ("functionBundleOid") REFERENCES "FunctionBundle"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunctionDeployment" ADD CONSTRAINT "FunctionDeployment_runtimeOid_fkey" FOREIGN KEY ("runtimeOid") REFERENCES "Runtime"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunctionDeployment" ADD CONSTRAINT "FunctionDeployment_functionOid_fkey" FOREIGN KEY ("functionOid") REFERENCES "Function"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunctionDeploymentStep" ADD CONSTRAINT "FunctionDeploymentStep_functionDeploymentOid_fkey" FOREIGN KEY ("functionDeploymentOid") REFERENCES "FunctionDeployment"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunctionVersion" ADD CONSTRAINT "FunctionVersion_functionOid_fkey" FOREIGN KEY ("functionOid") REFERENCES "Function"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunctionVersion" ADD CONSTRAINT "FunctionVersion_runtimeOid_fkey" FOREIGN KEY ("runtimeOid") REFERENCES "Runtime"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunctionVersion" ADD CONSTRAINT "FunctionVersion_functionBundleOid_fkey" FOREIGN KEY ("functionBundleOid") REFERENCES "FunctionBundle"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunctionInvocation" ADD CONSTRAINT "FunctionInvocation_functionVersionOid_fkey" FOREIGN KEY ("functionVersionOid") REFERENCES "FunctionVersion"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunctionBundle" ADD CONSTRAINT "FunctionBundle_functionOid_fkey" FOREIGN KEY ("functionOid") REFERENCES "Function"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

