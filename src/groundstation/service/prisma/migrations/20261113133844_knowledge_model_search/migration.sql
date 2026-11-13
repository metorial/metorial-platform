-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateIndex
CREATE INDEX "KnowledgeModel_name_trgm_idx" ON "KnowledgeModel" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "KnowledgeModel_id_trgm_idx" ON "KnowledgeModel" USING GIN ("id" gin_trgm_ops);
