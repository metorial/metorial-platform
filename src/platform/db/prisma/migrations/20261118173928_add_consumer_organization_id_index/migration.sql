-- Keep this the only statement in the file: a concurrent build cannot run inside a transaction.
CREATE INDEX CONCURRENTLY "Consumer_organizationOid_id_idx" ON "Consumer"("organizationOid", "id");
