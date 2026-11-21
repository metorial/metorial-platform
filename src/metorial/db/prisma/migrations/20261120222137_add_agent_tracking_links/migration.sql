-- CreateTable
CREATE TABLE "AgentTrackingOrganizationLink" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "serviceOrganizationId" TEXT NOT NULL,
    "organizationOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentTrackingOrganizationLink_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "AgentTrackingProjectLink" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "serviceProjectId" TEXT NOT NULL,
    "projectOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentTrackingProjectLink_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "AgentTrackingInstanceLink" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "serviceInstanceId" TEXT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentTrackingInstanceLink_pkey" PRIMARY KEY ("oid")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentTrackingOrganizationLink_id_key" ON "AgentTrackingOrganizationLink"("id");

-- CreateIndex
CREATE UNIQUE INDEX "AgentTrackingOrganizationLink_serviceOrganizationId_key" ON "AgentTrackingOrganizationLink"("serviceOrganizationId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentTrackingOrganizationLink_organizationOid_key" ON "AgentTrackingOrganizationLink"("organizationOid");

-- CreateIndex
CREATE UNIQUE INDEX "AgentTrackingProjectLink_id_key" ON "AgentTrackingProjectLink"("id");

-- CreateIndex
CREATE UNIQUE INDEX "AgentTrackingProjectLink_serviceProjectId_key" ON "AgentTrackingProjectLink"("serviceProjectId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentTrackingProjectLink_projectOid_key" ON "AgentTrackingProjectLink"("projectOid");

-- CreateIndex
CREATE UNIQUE INDEX "AgentTrackingInstanceLink_id_key" ON "AgentTrackingInstanceLink"("id");

-- CreateIndex
CREATE UNIQUE INDEX "AgentTrackingInstanceLink_serviceInstanceId_key" ON "AgentTrackingInstanceLink"("serviceInstanceId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentTrackingInstanceLink_instanceOid_key" ON "AgentTrackingInstanceLink"("instanceOid");

-- AddForeignKey
ALTER TABLE "AgentTrackingOrganizationLink" ADD CONSTRAINT "AgentTrackingOrganizationLink_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentTrackingProjectLink" ADD CONSTRAINT "AgentTrackingProjectLink_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentTrackingInstanceLink" ADD CONSTRAINT "AgentTrackingInstanceLink_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;
