-- CreateEnum
CREATE TYPE "AgentTrackingContentMode" AS ENUM ('basic', 'shape', 'full');

-- CreateTable
CREATE TABLE "AgentTrackingOrganizationSettings" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "hideIndividuals" BOOLEAN NOT NULL DEFAULT false,
    "minGroupUsers" INTEGER NOT NULL DEFAULT 5,
    "organizationOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentTrackingOrganizationSettings_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "AgentTrackingProjectSettings" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "recordDays" INTEGER,
    "contentDays" INTEGER,
    "usageDays" INTEGER,
    "projectOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentTrackingProjectSettings_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "AgentTrackingInstanceSettings" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "mode" "AgentTrackingContentMode" NOT NULL DEFAULT 'basic',
    "deterministicEnabled" BOOLEAN NOT NULL DEFAULT true,
    "aiEnabled" BOOLEAN NOT NULL DEFAULT false,
    "instanceOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentTrackingInstanceSettings_pkey" PRIMARY KEY ("oid")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentTrackingOrganizationSettings_id_key" ON "AgentTrackingOrganizationSettings"("id");

-- CreateIndex
CREATE UNIQUE INDEX "AgentTrackingOrganizationSettings_organizationOid_key" ON "AgentTrackingOrganizationSettings"("organizationOid");

-- CreateIndex
CREATE UNIQUE INDEX "AgentTrackingProjectSettings_id_key" ON "AgentTrackingProjectSettings"("id");

-- CreateIndex
CREATE UNIQUE INDEX "AgentTrackingProjectSettings_projectOid_key" ON "AgentTrackingProjectSettings"("projectOid");

-- CreateIndex
CREATE UNIQUE INDEX "AgentTrackingInstanceSettings_id_key" ON "AgentTrackingInstanceSettings"("id");

-- CreateIndex
CREATE UNIQUE INDEX "AgentTrackingInstanceSettings_instanceOid_key" ON "AgentTrackingInstanceSettings"("instanceOid");

-- AddForeignKey
ALTER TABLE "AgentTrackingOrganizationSettings" ADD CONSTRAINT "AgentTrackingOrganizationSettings_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentTrackingProjectSettings" ADD CONSTRAINT "AgentTrackingProjectSettings_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentTrackingInstanceSettings" ADD CONSTRAINT "AgentTrackingInstanceSettings_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;
