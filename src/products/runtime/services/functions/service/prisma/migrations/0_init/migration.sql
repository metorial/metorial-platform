-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "EnclaveFunctionOverrideDeploymentStatus" AS ENUM ('pending', 'succeeded', 'failed');

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
CREATE TYPE "FunctionBundleStatus" AS ENUM ('uploading', 'available', 'failed');

-- CreateTable
CREATE TABLE "Enclave" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Enclave_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "EnclaveFunction" (
    "oid" BIGINT NOT NULL,
    "enclaveOid" BIGINT NOT NULL,
    "functionOid" BIGINT NOT NULL,

    CONSTRAINT "EnclaveFunction_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "EnclaveFunctionOverride" (
    "oid" BIGINT NOT NULL,
    "enclaveOid" BIGINT NOT NULL,
    "sourceFunctionOid" BIGINT NOT NULL,
    "sourceFunctionVersionOid" BIGINT NOT NULL,
    "overrideFunctionOid" BIGINT NOT NULL,
    "overrideFunctionVersionOid" BIGINT NOT NULL,

    CONSTRAINT "EnclaveFunctionOverride_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "EnclaveFunctionOverrideDeployment" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "EnclaveFunctionOverrideDeploymentStatus" NOT NULL,
    "enclaveOid" BIGINT NOT NULL,
    "sourceFunctionOid" BIGINT NOT NULL,
    "sourceFunctionVersionOid" BIGINT NOT NULL,
    "overrideFunctionOid" BIGINT,
    "overrideFunctionVersionOid" BIGINT,
    "enclaveFunctionOverrideOid" BIGINT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnclaveFunctionOverrideDeployment_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Function" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "FunctionStatus" NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currentVersionOid" BIGINT,
    "cloneOfFunctionOid" BIGINT,
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
    "supportsV2Proxy" BOOLEAN NOT NULL DEFAULT false,
    "functionOid" BIGINT NOT NULL,
    "runtimeOid" BIGINT NOT NULL,
    "functionBundleOid" BIGINT NOT NULL,
    "cloneOfFunctionVersionOid" BIGINT,
    "configuration" JSONB NOT NULL,
    "providerData" JSONB NOT NULL,
    "manifest" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FunctionVersion_pkey" PRIMARY KEY ("oid")
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
CREATE TABLE "Tenant" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isServiceDefault" BOOLEAN NOT NULL DEFAULT false,
    "hasAutomaticEnclaveOverride" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("oid")
);

-- CreateIndex
CREATE UNIQUE INDEX "Enclave_id_key" ON "Enclave"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Enclave_identifier_tenantOid_key" ON "Enclave"("identifier", "tenantOid");

-- CreateIndex
CREATE UNIQUE INDEX "EnclaveFunction_enclaveOid_functionOid_key" ON "EnclaveFunction"("enclaveOid", "functionOid");

-- CreateIndex
CREATE INDEX "EnclaveFunctionOverride_enclaveOid_sourceFunctionOid_idx" ON "EnclaveFunctionOverride"("enclaveOid", "sourceFunctionOid");

-- CreateIndex
CREATE UNIQUE INDEX "EnclaveFunctionOverride_enclaveOid_sourceFunctionOid_source_key" ON "EnclaveFunctionOverride"("enclaveOid", "sourceFunctionOid", "sourceFunctionVersionOid");

-- CreateIndex
CREATE UNIQUE INDEX "EnclaveFunctionOverrideDeployment_id_key" ON "EnclaveFunctionOverrideDeployment"("id");

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
CREATE UNIQUE INDEX "FunctionBundle_id_key" ON "FunctionBundle"("id");

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
CREATE UNIQUE INDEX "Tenant_id_key" ON "Tenant"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_identifier_key" ON "Tenant"("identifier");

-- AddForeignKey
ALTER TABLE "Enclave" ADD CONSTRAINT "Enclave_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnclaveFunction" ADD CONSTRAINT "EnclaveFunction_enclaveOid_fkey" FOREIGN KEY ("enclaveOid") REFERENCES "Enclave"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnclaveFunction" ADD CONSTRAINT "EnclaveFunction_functionOid_fkey" FOREIGN KEY ("functionOid") REFERENCES "Function"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnclaveFunctionOverride" ADD CONSTRAINT "EnclaveFunctionOverride_enclaveOid_fkey" FOREIGN KEY ("enclaveOid") REFERENCES "Enclave"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnclaveFunctionOverride" ADD CONSTRAINT "EnclaveFunctionOverride_sourceFunctionOid_fkey" FOREIGN KEY ("sourceFunctionOid") REFERENCES "Function"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnclaveFunctionOverride" ADD CONSTRAINT "EnclaveFunctionOverride_sourceFunctionVersionOid_fkey" FOREIGN KEY ("sourceFunctionVersionOid") REFERENCES "FunctionVersion"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnclaveFunctionOverride" ADD CONSTRAINT "EnclaveFunctionOverride_overrideFunctionOid_fkey" FOREIGN KEY ("overrideFunctionOid") REFERENCES "Function"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnclaveFunctionOverride" ADD CONSTRAINT "EnclaveFunctionOverride_overrideFunctionVersionOid_fkey" FOREIGN KEY ("overrideFunctionVersionOid") REFERENCES "FunctionVersion"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnclaveFunctionOverrideDeployment" ADD CONSTRAINT "EnclaveFunctionOverrideDeployment_enclaveOid_fkey" FOREIGN KEY ("enclaveOid") REFERENCES "Enclave"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnclaveFunctionOverrideDeployment" ADD CONSTRAINT "EnclaveFunctionOverrideDeployment_sourceFunctionOid_fkey" FOREIGN KEY ("sourceFunctionOid") REFERENCES "Function"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnclaveFunctionOverrideDeployment" ADD CONSTRAINT "EnclaveFunctionOverrideDeployment_sourceFunctionVersionOid_fkey" FOREIGN KEY ("sourceFunctionVersionOid") REFERENCES "FunctionVersion"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnclaveFunctionOverrideDeployment" ADD CONSTRAINT "EnclaveFunctionOverrideDeployment_overrideFunctionOid_fkey" FOREIGN KEY ("overrideFunctionOid") REFERENCES "Function"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnclaveFunctionOverrideDeployment" ADD CONSTRAINT "EnclaveFunctionOverrideDeployment_overrideFunctionVersionO_fkey" FOREIGN KEY ("overrideFunctionVersionOid") REFERENCES "FunctionVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnclaveFunctionOverrideDeployment" ADD CONSTRAINT "EnclaveFunctionOverrideDeployment_enclaveFunctionOverrideO_fkey" FOREIGN KEY ("enclaveFunctionOverrideOid") REFERENCES "EnclaveFunctionOverride"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Function" ADD CONSTRAINT "Function_currentVersionOid_fkey" FOREIGN KEY ("currentVersionOid") REFERENCES "FunctionVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Function" ADD CONSTRAINT "Function_cloneOfFunctionOid_fkey" FOREIGN KEY ("cloneOfFunctionOid") REFERENCES "Function"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE "FunctionVersion" ADD CONSTRAINT "FunctionVersion_cloneOfFunctionVersionOid_fkey" FOREIGN KEY ("cloneOfFunctionVersionOid") REFERENCES "FunctionVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunctionBundle" ADD CONSTRAINT "FunctionBundle_functionOid_fkey" FOREIGN KEY ("functionOid") REFERENCES "Function"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Runtime" ADD CONSTRAINT "Runtime_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuntimeForgeWorkflow" ADD CONSTRAINT "RuntimeForgeWorkflow_runtimeOid_fkey" FOREIGN KEY ("runtimeOid") REFERENCES "Runtime"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuntimeForgeWorkflow" ADD CONSTRAINT "RuntimeForgeWorkflow_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

