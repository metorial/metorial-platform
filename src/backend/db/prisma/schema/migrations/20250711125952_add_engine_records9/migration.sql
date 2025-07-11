-- DropIndex
DROP INDEX "EngineRun_hasEnded_idx";

-- DropIndex
DROP INDEX "EngineSession_hasEnded_idx";

-- CreateIndex
CREATE INDEX "EngineRun_isFinalized_idx" ON "EngineRun"("isFinalized");

-- CreateIndex
CREATE INDEX "EngineSession_isFinalized_idx" ON "EngineSession"("isFinalized");
