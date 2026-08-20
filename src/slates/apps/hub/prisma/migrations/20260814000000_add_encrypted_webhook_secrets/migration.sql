-- Additive Task 4 rollout. Plaintext compatibility columns are intentionally retained.
ALTER TABLE "SlateTriggerReceiverTrigger"
  ADD COLUMN IF NOT EXISTS "encryptedRegistrationDetails" TEXT,
  ADD COLUMN IF NOT EXISTS "registrationDetailsEncryptionKeyVersion" INTEGER,
  ADD COLUMN IF NOT EXISTS "registrationDetailsAadVersion" INTEGER,
  ADD COLUMN IF NOT EXISTS "registrationGeneration" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "registrationVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "registrationStatus" TEXT NOT NULL DEFAULT 'pending';

CREATE TABLE IF NOT EXISTS "SlateTriggerReceiverPathSecret" (
  "oid" BIGINT PRIMARY KEY, "id" TEXT NOT NULL, "tenantOid" BIGINT NOT NULL,
  "slateInstanceOid" BIGINT NOT NULL, "receiverOid" BIGINT NOT NULL,
  "encryptedValue" TEXT NOT NULL, "lookupHash" TEXT NOT NULL, "secretVersion" INTEGER NOT NULL,
  "encryptionKeyVersion" INTEGER NOT NULL, "aadVersion" INTEGER NOT NULL, "status" TEXT NOT NULL,
  "validFrom" TIMESTAMP(3) NOT NULL, "validUntil" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "rotatedAt" TIMESTAMP(3), "revokedAt" TIMESTAMP(3),
  CONSTRAINT "hub_receiver_path_secret_id_key" UNIQUE ("id"),
  CONSTRAINT "hub_receiver_path_secret_tenant_fk" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE,
  CONSTRAINT "hub_receiver_path_secret_instance_fk" FOREIGN KEY ("slateInstanceOid") REFERENCES "SlateInstance"("oid") ON DELETE CASCADE,
  CONSTRAINT "hub_receiver_path_secret_receiver_fk" FOREIGN KEY ("receiverOid") REFERENCES "SlateTriggerReceiver"("oid") ON DELETE CASCADE,
  CONSTRAINT "hub_receiver_path_secret_owner_version_key" UNIQUE ("receiverOid", "secretVersion")
);
CREATE TABLE IF NOT EXISTS "SlateTriggerReceiverSecret" (
  "oid" BIGINT PRIMARY KEY, "id" TEXT NOT NULL, "tenantOid" BIGINT NOT NULL,
  "slateInstanceOid" BIGINT NOT NULL, "receiverOid" BIGINT NOT NULL, "receiverTriggerOid" BIGINT NOT NULL,
  "specHash" TEXT NOT NULL, "sourceBindingType" TEXT NOT NULL, "sourceBindingId" TEXT NOT NULL,
  "name" TEXT NOT NULL, "kind" TEXT NOT NULL, "encoding" TEXT NOT NULL, "encryptedValue" TEXT NOT NULL,
  "secretVersion" INTEGER NOT NULL, "encryptionKeyVersion" INTEGER NOT NULL, "aadVersion" INTEGER NOT NULL,
  "status" TEXT NOT NULL, "validFrom" TIMESTAMP(3) NOT NULL, "validUntil" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "rotatedAt" TIMESTAMP(3), "revokedAt" TIMESTAMP(3),
  CONSTRAINT "hub_trigger_secret_id_key" UNIQUE ("id"),
  CONSTRAINT "hub_trigger_secret_tenant_fk" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE,
  CONSTRAINT "hub_trigger_secret_instance_fk" FOREIGN KEY ("slateInstanceOid") REFERENCES "SlateInstance"("oid") ON DELETE CASCADE,
  CONSTRAINT "hub_trigger_secret_receiver_fk" FOREIGN KEY ("receiverOid") REFERENCES "SlateTriggerReceiver"("oid") ON DELETE CASCADE,
  CONSTRAINT "hub_trigger_secret_trigger_fk" FOREIGN KEY ("receiverTriggerOid") REFERENCES "SlateTriggerReceiverTrigger"("oid") ON DELETE CASCADE,
  CONSTRAINT "hub_trigger_secret_owner_version_key" UNIQUE ("receiverTriggerOid", "specHash", "name", "secretVersion")
);
CREATE TABLE IF NOT EXISTS "SlateInstanceConfigSecret" (
  "oid" BIGINT PRIMARY KEY, "id" TEXT NOT NULL, "instanceConfigOid" BIGINT NOT NULL, "tenantOid" BIGINT NOT NULL,
  "key" TEXT NOT NULL, "encryptedValue" TEXT NOT NULL, "secretVersion" INTEGER NOT NULL,
  "encryptionKeyVersion" INTEGER NOT NULL, "aadVersion" INTEGER NOT NULL, "status" TEXT NOT NULL,
  "validFrom" TIMESTAMP(3) NOT NULL, "validUntil" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "rotatedAt" TIMESTAMP(3), "revokedAt" TIMESTAMP(3),
  CONSTRAINT "hub_config_secret_id_key" UNIQUE ("id"),
  CONSTRAINT "hub_config_secret_config_fk" FOREIGN KEY ("instanceConfigOid") REFERENCES "SlateInstanceConfig"("oid") ON DELETE CASCADE,
  CONSTRAINT "hub_config_secret_tenant_fk" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE,
  CONSTRAINT "hub_config_secret_owner_version_key" UNIQUE ("instanceConfigOid", "key", "secretVersion")
);
CREATE TABLE IF NOT EXISTS "SlateProvisionedAppRouteSecret" (
  "oid" BIGINT PRIMARY KEY, "id" TEXT NOT NULL, "provisionedRouteId" TEXT NOT NULL, "routeGeneration" INTEGER NOT NULL,
  "vendor" TEXT NOT NULL, "credentialOwnerRef" TEXT NOT NULL, "purpose" TEXT NOT NULL, "encryptedValue" TEXT NOT NULL,
  "secretVersion" INTEGER NOT NULL, "encryptionKeyVersion" INTEGER NOT NULL, "aadVersion" INTEGER NOT NULL, "status" TEXT NOT NULL,
  "validFrom" TIMESTAMP(3) NOT NULL, "validUntil" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "rotatedAt" TIMESTAMP(3), "revokedAt" TIMESTAMP(3),
  CONSTRAINT "hub_app_route_secret_id_key" UNIQUE ("id"),
  CONSTRAINT "hub_app_route_secret_owner_version_key" UNIQUE ("provisionedRouteId", "routeGeneration", "purpose", "secretVersion")
);
DO $$ BEGIN CREATE TYPE "SecretIssuanceReceiptStatus" AS ENUM ('issued','consumed','expired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "WebhookSecretAuditAction" AS ENUM ('secret_created','secret_imported','secret_projected','secret_rotated','secret_revoked','secret_issuance_receipt_issued','secret_issuance_receipt_consumed','secret_issuance_receipt_denied'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TYPE "WebhookSecretAuditAction" ADD VALUE IF NOT EXISTS 'secret_projected';
CREATE TABLE IF NOT EXISTS "SecretIssuanceReceipt" (
  "oid" BIGINT PRIMARY KEY, "id" TEXT NOT NULL, "tokenHash" TEXT NOT NULL, "tenantOid" BIGINT,
  "receiverOid" BIGINT, "provisionedRouteId" TEXT, "secretClass" TEXT NOT NULL, "secretId" TEXT NOT NULL,
  "encryptedMaterial" TEXT NOT NULL, "status" "SecretIssuanceReceiptStatus" NOT NULL DEFAULT 'issued',
  "expiresAt" TIMESTAMP(3) NOT NULL, "consumedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hub_secret_receipt_id_key" UNIQUE ("id"),
  CONSTRAINT "hub_secret_receipt_token_hash_key" UNIQUE ("tokenHash"),
  CONSTRAINT "hub_secret_receipt_tenant_fk" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE,
  CONSTRAINT "hub_secret_receipt_receiver_fk" FOREIGN KEY ("receiverOid") REFERENCES "SlateTriggerReceiver"("oid") ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "WebhookSecretAuditRecord" (
  "oid" BIGINT PRIMARY KEY, "id" TEXT NOT NULL, "auditCorrelationId" TEXT NOT NULL, "tenantOid" BIGINT,
  "receiverOid" BIGINT, "provisionedRouteId" TEXT, "action" "WebhookSecretAuditAction" NOT NULL,
  "tenantIdSnapshot" TEXT, "receiverIdSnapshot" TEXT, "callbackIdSnapshot" TEXT,
  "callbackInstanceIdSnapshot" TEXT, "receiverAuthorityVersionSnapshot" INTEGER,
  "actorId" TEXT NOT NULL, "requestId" TEXT NOT NULL, "metadata" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hub_secret_audit_id_key" UNIQUE ("id"),
  CONSTRAINT "hub_secret_audit_tenant_fk" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE SET NULL,
  CONSTRAINT "hub_secret_audit_receiver_fk" FOREIGN KEY ("receiverOid") REFERENCES "SlateTriggerReceiver"("oid") ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS "WebhookSecretOutboxRecord" (
  "oid" BIGINT PRIMARY KEY, "id" TEXT NOT NULL, "auditCorrelationId" TEXT NOT NULL,
  "action" "WebhookSecretAuditAction" NOT NULL, "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "publishedAt" TIMESTAMP(3),
  CONSTRAINT "hub_secret_outbox_id_key" UNIQUE ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS hub_receiver_path_secret_one_active ON "SlateTriggerReceiverPathSecret" ("receiverOid") WHERE status = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS hub_trigger_secret_one_active ON "SlateTriggerReceiverSecret" ("receiverTriggerOid", "specHash", name) WHERE status = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS hub_config_secret_one_active ON "SlateInstanceConfigSecret" ("instanceConfigOid", key) WHERE status = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS hub_app_route_secret_one_active ON "SlateProvisionedAppRouteSecret" ("provisionedRouteId", "routeGeneration", purpose) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS hub_receiver_path_secret_status_idx ON "SlateTriggerReceiverPathSecret" ("receiverOid", status, "validUntil");
CREATE INDEX IF NOT EXISTS hub_receiver_path_secret_owner_idx ON "SlateTriggerReceiverPathSecret" ("tenantOid", "slateInstanceOid", "receiverOid");
CREATE INDEX IF NOT EXISTS hub_trigger_secret_owner_idx ON "SlateTriggerReceiverSecret" ("tenantOid", "slateInstanceOid", "receiverOid");
CREATE INDEX IF NOT EXISTS hub_trigger_secret_source_idx ON "SlateTriggerReceiverSecret" ("sourceBindingType", "sourceBindingId");
CREATE INDEX IF NOT EXISTS hub_trigger_secret_status_idx ON "SlateTriggerReceiverSecret" ("receiverTriggerOid", status, "validUntil");
CREATE INDEX IF NOT EXISTS hub_config_secret_owner_idx ON "SlateInstanceConfigSecret" ("tenantOid", "instanceConfigOid");
CREATE INDEX IF NOT EXISTS hub_config_secret_status_idx ON "SlateInstanceConfigSecret" ("instanceConfigOid", status, "validUntil");
CREATE INDEX IF NOT EXISTS hub_app_route_secret_status_idx ON "SlateProvisionedAppRouteSecret" ("provisionedRouteId", "routeGeneration", purpose, status, "validUntil");
CREATE INDEX IF NOT EXISTS hub_app_route_secret_binding_idx ON "SlateProvisionedAppRouteSecret" (vendor, "credentialOwnerRef");
CREATE INDEX IF NOT EXISTS hub_secret_receipt_owner_status_idx ON "SecretIssuanceReceipt" ("tenantOid", "receiverOid", status, "expiresAt");
CREATE INDEX IF NOT EXISTS hub_secret_audit_correlation_idx ON "WebhookSecretAuditRecord" ("auditCorrelationId");
CREATE INDEX IF NOT EXISTS hub_secret_audit_owner_idx ON "WebhookSecretAuditRecord" ("tenantOid", "receiverOid", "createdAt");
CREATE INDEX IF NOT EXISTS hub_secret_audit_snapshot_owner_idx ON "WebhookSecretAuditRecord" ("receiverIdSnapshot", "callbackIdSnapshot", "callbackInstanceIdSnapshot", "createdAt");
CREATE INDEX IF NOT EXISTS hub_secret_outbox_pending_idx ON "WebhookSecretOutboxRecord" ("publishedAt", "createdAt");
CREATE INDEX IF NOT EXISTS hub_secret_outbox_correlation_idx ON "WebhookSecretOutboxRecord" ("auditCorrelationId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hub_receiver_path_secret_retiring_deadline') THEN
    ALTER TABLE "SlateTriggerReceiverPathSecret" ADD CONSTRAINT hub_receiver_path_secret_retiring_deadline CHECK (status <> 'retiring' OR "validUntil" IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hub_trigger_secret_retiring_deadline') THEN
    ALTER TABLE "SlateTriggerReceiverSecret" ADD CONSTRAINT hub_trigger_secret_retiring_deadline CHECK (status <> 'retiring' OR "validUntil" IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hub_config_secret_retiring_deadline') THEN
    ALTER TABLE "SlateInstanceConfigSecret" ADD CONSTRAINT hub_config_secret_retiring_deadline CHECK (status <> 'retiring' OR "validUntil" IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hub_app_route_secret_retiring_deadline') THEN
    ALTER TABLE "SlateProvisionedAppRouteSecret" ADD CONSTRAINT hub_app_route_secret_retiring_deadline CHECK (status <> 'retiring' OR "validUntil" IS NOT NULL);
  END IF;
END $$;
