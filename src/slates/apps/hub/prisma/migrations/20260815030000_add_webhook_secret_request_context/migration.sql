ALTER TABLE "WebhookSecretAuditRecord"
  ADD COLUMN "requestIp" TEXT,
  ADD COLUMN "requestUserAgent" TEXT;
