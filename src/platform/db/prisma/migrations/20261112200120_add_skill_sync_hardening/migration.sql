-- AlterTable
ALTER TABLE "SkillRepository" ADD COLUMN     "providerIdentityRefreshedAt" TIMESTAMP(3),
ADD COLUMN     "providerRepositoryKey" TEXT,
ADD COLUMN     "providerRepositoryPath" TEXT;

-- AlterTable
ALTER TABLE "SkillDestination" ADD COLUMN     "contentRevision" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "SkillDestinationSyncRepositoryPropagation" ADD COLUMN     "contentRevision" INTEGER;

-- CreateIndex
CREATE INDEX "SkillRepository_providerRepositoryKey_idx" ON "SkillRepository"("providerRepositoryKey");

-- CreateIndex
CREATE INDEX "SkillRepository_providerRepositoryPath_idx" ON "SkillRepository"("providerRepositoryPath");

-- CreateIndex
CREATE INDEX "SkillRepository_providerIdentityRefreshedAt_id_idx" ON "SkillRepository"("providerIdentityRefreshedAt", "id");
