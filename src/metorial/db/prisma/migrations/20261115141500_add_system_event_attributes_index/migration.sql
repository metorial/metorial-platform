CREATE INDEX CONCURRENTLY IF NOT EXISTS "SystemEvent_attributes_idx" ON "SystemEvent" USING GIN ("attributes");
