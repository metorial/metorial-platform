-- CreateTable
CREATE TABLE "GlobalSecurityReview" (
    "id" TEXT NOT NULL,
    "subjectKey" TEXT NOT NULL,
    "slateRegistryId" TEXT NOT NULL,
    "slateVersionRegistryId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "currentRevisionId" TEXT,
    "ownerOid" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GlobalSecurityReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlobalSecurityReviewRevision" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "snapshotOfId" TEXT,
    "status" TEXT NOT NULL,
    "stage" TEXT,
    "activity" TEXT,
    "mode" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "failureCode" TEXT,
    "blockReason" TEXT,
    "awaitingTools" BOOLEAN NOT NULL DEFAULT false,
    "report" JSONB,
    "scores" JSONB,
    "findings" JSONB,
    "census" JSONB,
    "context" JSONB,
    "evidenceHash" TEXT,
    "rulesVersion" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "thoroughness" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'agent',
    "workspaceKey" TEXT,
    "model" TEXT,
    "costMicros" BIGINT NOT NULL DEFAULT 0,
    "reviewId" TEXT NOT NULL,
    "runnerOid" INTEGER,
    "heartbeatAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GlobalSecurityReviewRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlobalSecurityReviewSubjectSetting" (
    "slateRegistryId" TEXT NOT NULL,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GlobalSecurityReviewSubjectSetting_pkey" PRIMARY KEY ("slateRegistryId")
);

-- CreateIndex
CREATE UNIQUE INDEX "GlobalSecurityReview_subjectKey_key" ON "GlobalSecurityReview"("subjectKey");

-- CreateIndex
CREATE INDEX "GlobalSecurityReview_slateRegistryId_idx" ON "GlobalSecurityReview"("slateRegistryId");

-- CreateIndex
CREATE INDEX "GlobalSecurityReview_updatedAt_idx" ON "GlobalSecurityReview"("updatedAt");

-- CreateIndex
CREATE INDEX "GlobalSecurityReviewRevision_status_idx" ON "GlobalSecurityReviewRevision"("status");

-- CreateIndex
CREATE INDEX "GlobalSecurityReviewRevision_updatedAt_idx" ON "GlobalSecurityReviewRevision"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "GlobalSecurityReviewRevision_reviewId_number_key" ON "GlobalSecurityReviewRevision"("reviewId", "number");

-- CreateIndex
CREATE INDEX "GlobalSecurityReviewSubjectSetting_updatedAt_idx" ON "GlobalSecurityReviewSubjectSetting"("updatedAt");

-- AddForeignKey
ALTER TABLE "GlobalSecurityReview" ADD CONSTRAINT "GlobalSecurityReview_ownerOid_fkey" FOREIGN KEY ("ownerOid") REFERENCES "Cell"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GlobalSecurityReviewRevision" ADD CONSTRAINT "GlobalSecurityReviewRevision_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "GlobalSecurityReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GlobalSecurityReviewRevision" ADD CONSTRAINT "GlobalSecurityReviewRevision_runnerOid_fkey" FOREIGN KEY ("runnerOid") REFERENCES "Cell"("oid") ON DELETE SET NULL ON UPDATE CASCADE;
