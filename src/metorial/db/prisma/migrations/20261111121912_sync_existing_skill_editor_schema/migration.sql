-- CreateEnum
CREATE TYPE "DocumentCommentThreadStatus" AS ENUM ('open', 'resolved');

-- CreateEnum
CREATE TYPE "DocumentCommentThreadAnchorStatus" AS ENUM ('attached', 'detached');

-- CreateEnum
CREATE TYPE "SkillSecurityReviewPolicy" AS ENUM ('off', 'warn', 'block');

-- AlterEnum
ALTER TYPE "ConsumerAccessLevel" ADD VALUE 'write';

-- AlterEnum
ALTER TYPE "StoreParticipantRole" ADD VALUE 'owner';

-- AlterTable
ALTER TABLE "DocumentContent" ADD COLUMN     "annotations" JSONB;

-- AlterTable
ALTER TABLE "File" ALTER COLUMN "fileSize" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "FileUpload" ALTER COLUMN "fileSize" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "aiAnalysisEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "skillReviewHoldPending" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "usageReviewsEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ProductAssistantRequest" ADD COLUMN     "input" JSONB;

-- AlterTable
ALTER TABLE "SkillConfiguration" ADD COLUMN     "securityReviewPolicy" "SkillSecurityReviewPolicy" NOT NULL DEFAULT 'off';

-- AlterTable
ALTER TABLE "SkillGroup" ADD COLUMN     "image" JSONB;

-- AlterTable
ALTER TABLE "SkillImport" ADD COLUMN     "skillGroupOid" BIGINT;

-- CreateTable
CREATE TABLE "DocumentCommentThread" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "DocumentCommentThreadStatus" NOT NULL DEFAULT 'open',
    "anchorStatus" "DocumentCommentThreadAnchorStatus" NOT NULL DEFAULT 'attached',
    "quote" TEXT NOT NULL,
    "documentOid" BIGINT NOT NULL,
    "createdByResourceActorOid" BIGINT NOT NULL,
    "resolvedByResourceActorOid" BIGINT,
    "resolvedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentCommentThread_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "DocumentComment" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "threadOid" BIGINT NOT NULL,
    "resourceActorOid" BIGINT NOT NULL,
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentComment_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SkillGroupPlugin" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "syncIssues" JSONB,
    "lastReconciledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "skillGroupOid" BIGINT NOT NULL,
    "skillPluginOid" BIGINT NOT NULL,

    CONSTRAINT "SkillGroupPlugin_pkey" PRIMARY KEY ("oid")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentCommentThread_id_key" ON "DocumentCommentThread"("id");

-- CreateIndex
CREATE INDEX "DocumentCommentThread_documentOid_createdAt_idx" ON "DocumentCommentThread"("documentOid", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentComment_id_key" ON "DocumentComment"("id");

-- CreateIndex
CREATE INDEX "DocumentComment_threadOid_createdAt_idx" ON "DocumentComment"("threadOid", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SkillGroupPlugin_id_key" ON "SkillGroupPlugin"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SkillGroupPlugin_skillPluginOid_key" ON "SkillGroupPlugin"("skillPluginOid");

-- CreateIndex
CREATE INDEX "SkillGroupPlugin_skillGroupOid_idx" ON "SkillGroupPlugin"("skillGroupOid");

-- CreateIndex
CREATE INDEX "SkillGroupPlugin_lastReconciledAt_idx" ON "SkillGroupPlugin"("lastReconciledAt");

-- CreateIndex
CREATE INDEX "SkillMarketplacePlugin_skillPluginOid_status_idx" ON "SkillMarketplacePlugin"("skillPluginOid", "status");

-- CreateIndex
CREATE INDEX "SkillPluginSkill_skillOid_status_idx" ON "SkillPluginSkill"("skillOid", "status");

-- CreateIndex
CREATE INDEX "SkillVersion_createdAt_idx" ON "SkillVersion"("createdAt");

-- AddForeignKey
ALTER TABLE "DocumentCommentThread" ADD CONSTRAINT "DocumentCommentThread_documentOid_fkey" FOREIGN KEY ("documentOid") REFERENCES "Document"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentCommentThread" ADD CONSTRAINT "DocumentCommentThread_createdByResourceActorOid_fkey" FOREIGN KEY ("createdByResourceActorOid") REFERENCES "ResourceActor"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentCommentThread" ADD CONSTRAINT "DocumentCommentThread_resolvedByResourceActorOid_fkey" FOREIGN KEY ("resolvedByResourceActorOid") REFERENCES "ResourceActor"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentComment" ADD CONSTRAINT "DocumentComment_threadOid_fkey" FOREIGN KEY ("threadOid") REFERENCES "DocumentCommentThread"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentComment" ADD CONSTRAINT "DocumentComment_resourceActorOid_fkey" FOREIGN KEY ("resourceActorOid") REFERENCES "ResourceActor"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillImport" ADD CONSTRAINT "SkillImport_skillGroupOid_fkey" FOREIGN KEY ("skillGroupOid") REFERENCES "SkillGroup"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillGroupPlugin" ADD CONSTRAINT "SkillGroupPlugin_skillGroupOid_fkey" FOREIGN KEY ("skillGroupOid") REFERENCES "SkillGroup"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillGroupPlugin" ADD CONSTRAINT "SkillGroupPlugin_skillPluginOid_fkey" FOREIGN KEY ("skillPluginOid") REFERENCES "SkillPlugin"("oid") ON DELETE CASCADE ON UPDATE CASCADE;
