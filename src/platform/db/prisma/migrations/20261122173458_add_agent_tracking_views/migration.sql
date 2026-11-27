-- CreateEnum
CREATE TYPE "AgentTrackingViewStatus" AS ENUM ('active', 'deleted');

-- CreateTable
CREATE TABLE "AgentTrackingView" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "AgentTrackingViewStatus" NOT NULL DEFAULT 'active',
    "page" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT,
    "params" JSONB NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "creatorActorOid" BIGINT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentTrackingView_pkey" PRIMARY KEY ("oid")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentTrackingView_id_key" ON "AgentTrackingView"("id");

-- CreateIndex
CREATE INDEX "AgentTrackingView_instanceOid_page_status_idx" ON "AgentTrackingView"("instanceOid", "page", "status");

-- CreateIndex
CREATE INDEX "AgentTrackingView_creatorActorOid_idx" ON "AgentTrackingView"("creatorActorOid");

-- CreateIndex
CREATE UNIQUE INDEX "AgentTrackingView_instanceOid_page_nameKey_key" ON "AgentTrackingView"("instanceOid", "page", "nameKey");

-- AddForeignKey
ALTER TABLE "AgentTrackingView" ADD CONSTRAINT "AgentTrackingView_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentTrackingView" ADD CONSTRAINT "AgentTrackingView_creatorActorOid_fkey" FOREIGN KEY ("creatorActorOid") REFERENCES "OrganizationActor"("oid") ON DELETE SET NULL ON UPDATE CASCADE;
