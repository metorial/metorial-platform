-- Keep this the only statement in the file: a concurrent build cannot run inside a transaction.
CREATE INDEX CONCURRENTLY "SystemEvent_attributes_idx" ON "SystemEvent" USING GIN ("attributes");
