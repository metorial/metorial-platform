-- Additive Task 4 rollout. WebhookDestinationWebhook.signingSecret remains for rollback.
CREATE TABLE IF NOT EXISTS "WebhookDestinationSigningSecret" (
  "oid" BIGINT PRIMARY KEY, "id" TEXT NOT NULL, "webhookDestinationWebhookOid" BIGINT NOT NULL,
  "tenantOid" BIGINT NOT NULL, "purpose" TEXT NOT NULL, "encryptedValue" TEXT NOT NULL, "secretVersion" INTEGER NOT NULL,
  "encryptionKeyVersion" INTEGER NOT NULL, "aadVersion" INTEGER NOT NULL, "status" TEXT NOT NULL,
  "validFrom" TIMESTAMP(3) NOT NULL, "validUntil" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "rotatedAt" TIMESTAMP(3), "revokedAt" TIMESTAMP(3),
  CONSTRAINT "signal_webhook_secret_id_key" UNIQUE ("id"),
  CONSTRAINT "signal_webhook_secret_owner_fk" FOREIGN KEY ("webhookDestinationWebhookOid") REFERENCES "WebhookDestinationWebhook"("oid") ON DELETE CASCADE,
  CONSTRAINT "signal_webhook_secret_tenant_fk" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE,
  CONSTRAINT "signal_webhook_secret_owner_version_key" UNIQUE ("webhookDestinationWebhookOid", "purpose", "secretVersion")
);
DO $$ BEGIN CREATE TYPE "WebhookSecretIssuanceReceiptStatus" AS ENUM ('issued','consumed','expired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "WebhookSecretAuditAction" AS ENUM ('secret_created','secret_imported','secret_projected','secret_rotated','secret_revoked','secret_issuance_receipt_issued','secret_issuance_receipt_consumed','secret_issuance_receipt_denied'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TYPE "WebhookSecretAuditAction" ADD VALUE IF NOT EXISTS 'secret_projected';
CREATE TABLE IF NOT EXISTS "WebhookSecretIssuanceReceipt" (
  "oid" BIGINT PRIMARY KEY, "id" TEXT NOT NULL, "tokenHash" TEXT NOT NULL,
  "tenantOid" BIGINT NOT NULL, "webhookDestinationWebhookOid" BIGINT NOT NULL, "secretId" TEXT NOT NULL,
  "encryptedMaterial" TEXT NOT NULL, "status" "WebhookSecretIssuanceReceiptStatus" NOT NULL DEFAULT 'issued',
  "expiresAt" TIMESTAMP(3) NOT NULL, "consumedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "signal_webhook_receipt_id_key" UNIQUE ("id"),
  CONSTRAINT "signal_webhook_receipt_token_hash_key" UNIQUE ("tokenHash"),
  CONSTRAINT "signal_webhook_receipt_tenant_fk" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE,
  CONSTRAINT "signal_webhook_receipt_owner_fk" FOREIGN KEY ("webhookDestinationWebhookOid") REFERENCES "WebhookDestinationWebhook"("oid") ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "WebhookSecretAuditRecord" (
  "oid" BIGINT PRIMARY KEY, "id" TEXT NOT NULL, "auditCorrelationId" TEXT NOT NULL,
  "tenantOid" BIGINT NOT NULL, "webhookDestinationWebhookOid" BIGINT NOT NULL,
  "action" "WebhookSecretAuditAction" NOT NULL, "metadata" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "signal_webhook_audit_id_key" UNIQUE ("id"),
  CONSTRAINT "signal_webhook_audit_tenant_fk" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE,
  CONSTRAINT "signal_webhook_audit_owner_fk" FOREIGN KEY ("webhookDestinationWebhookOid") REFERENCES "WebhookDestinationWebhook"("oid") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS signal_webhook_secret_one_active ON "WebhookDestinationSigningSecret" ("webhookDestinationWebhookOid", purpose) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS signal_webhook_secret_owner_idx ON "WebhookDestinationSigningSecret" ("tenantOid", "webhookDestinationWebhookOid");
CREATE INDEX IF NOT EXISTS signal_webhook_secret_status_idx ON "WebhookDestinationSigningSecret" ("webhookDestinationWebhookOid", status, "validUntil");
CREATE INDEX IF NOT EXISTS signal_webhook_receipt_status_idx ON "WebhookSecretIssuanceReceipt" ("tenantOid", "webhookDestinationWebhookOid", status, "expiresAt");
CREATE INDEX IF NOT EXISTS signal_webhook_audit_correlation_idx ON "WebhookSecretAuditRecord" ("auditCorrelationId");
CREATE INDEX IF NOT EXISTS signal_webhook_audit_owner_idx ON "WebhookSecretAuditRecord" ("tenantOid", "webhookDestinationWebhookOid", "createdAt");
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'signal_webhook_secret_retiring_deadline') THEN
    ALTER TABLE "WebhookDestinationSigningSecret" ADD CONSTRAINT signal_webhook_secret_retiring_deadline CHECK (status <> 'retiring' OR "validUntil" IS NOT NULL);
  END IF;
END $$;
