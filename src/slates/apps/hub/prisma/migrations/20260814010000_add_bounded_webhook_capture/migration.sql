ALTER TABLE "SlateTriggerWebhookRequest"
  ADD COLUMN IF NOT EXISTS "tenantId" TEXT,
  ADD COLUMN IF NOT EXISTS "receiverOwnerId" TEXT,
  ADD COLUMN IF NOT EXISTS "redactedUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "redactedHeaders" JSONB,
  ADD COLUMN IF NOT EXISTS "bodyByteLength" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "requestHash" TEXT,
  ADD COLUMN IF NOT EXISTS "bodyHash" TEXT,
  ADD COLUMN IF NOT EXISTS "selectedRule" TEXT,
  ADD COLUMN IF NOT EXISTS "capturePolicyHash" TEXT,
  ADD COLUMN IF NOT EXISTS "captureSpecHashes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "captureRuleIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "queueClaimToken" TEXT,
  ADD COLUMN IF NOT EXISTS "queueClaimState" TEXT,
  ADD COLUMN IF NOT EXISTS "queueClaimedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "terminalFailureAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "outcome" TEXT NOT NULL DEFAULT 'accepted',
  ADD COLUMN IF NOT EXISTS "safeRejectionCode" TEXT;

CREATE TABLE IF NOT EXISTS "SlateTriggerWebhookRequestPayload" (
  "oid" BIGINT NOT NULL,
  "requestOid" BIGINT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "receiverId" TEXT NOT NULL,
  "encryptedRequest" TEXT NOT NULL,
  "encryptionVersion" INTEGER NOT NULL,
  "aadVersion" INTEGER NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "quarantinedAt" TIMESTAMP(3),
  "quarantineReason" TEXT,
  "terminalOutcome" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SlateTriggerWebhookRequestPayload_pkey" PRIMARY KEY ("oid"),
  CONSTRAINT "SlateTriggerWebhookRequestPayload_requestOid_fkey"
    FOREIGN KEY ("requestOid") REFERENCES "SlateTriggerWebhookRequest"("oid")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "SlateTriggerWebhookRequestPayload_requestOid_key"
  ON "SlateTriggerWebhookRequestPayload"("requestOid");
CREATE INDEX IF NOT EXISTS "SlateTriggerWebhookRequestPayload_expiresAt_consumedAt_idx"
  ON "SlateTriggerWebhookRequestPayload"("expiresAt", "consumedAt");
CREATE INDEX IF NOT EXISTS "SlateTriggerWebhookRequestPayload_tenantId_receiverId_idx"
  ON "SlateTriggerWebhookRequestPayload"("tenantId", "receiverId");
CREATE INDEX IF NOT EXISTS "SlateTriggerWebhookRequest_outcome_createdAt_idx"
  ON "SlateTriggerWebhookRequest"("outcome", "createdAt");

CREATE TABLE IF NOT EXISTS "WebhookArtifactQuarantine" (
  "oid" BIGINT NOT NULL,
  "key" TEXT NOT NULL,
  "artifactType" TEXT NOT NULL,
  "artifactId" TEXT NOT NULL,
  "tenantId" TEXT,
  "reason" TEXT NOT NULL,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebhookArtifactQuarantine_pkey" PRIMARY KEY ("oid")
);
CREATE UNIQUE INDEX IF NOT EXISTS "WebhookArtifactQuarantine_key_key"
  ON "WebhookArtifactQuarantine"("key");
CREATE INDEX IF NOT EXISTS "WebhookArtifactQuarantine_resolvedAt_createdAt_idx"
  ON "WebhookArtifactQuarantine"("resolvedAt", "createdAt");

CREATE TABLE IF NOT EXISTS "WebhookArtifactRewriteFailure" (
  "oid" BIGINT NOT NULL PRIMARY KEY,
  "key" TEXT NOT NULL,
  "artifactType" TEXT NOT NULL,
  "artifactId" TEXT NOT NULL,
  "safeErrorCode" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 1,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "WebhookArtifactRewriteFailure_key_key"
  ON "WebhookArtifactRewriteFailure"("key");
CREATE INDEX IF NOT EXISTS "WebhookArtifactRewriteFailure_resolvedAt_createdAt_idx"
  ON "WebhookArtifactRewriteFailure"("resolvedAt", "createdAt");

CREATE TABLE IF NOT EXISTS "WebhookArtifactDeletionTombstone" (
  "oid" BIGINT NOT NULL PRIMARY KEY,
  "key" TEXT NOT NULL,
  "artifactType" TEXT NOT NULL,
  "artifactId" TEXT NOT NULL,
  "bucket" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastAttemptAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "WebhookArtifactDeletionTombstone_key_key"
  ON "WebhookArtifactDeletionTombstone"("key");
CREATE INDEX IF NOT EXISTS "WebhookArtifactDeletionTombstone_status_createdAt_idx"
  ON "WebhookArtifactDeletionTombstone"("status", "createdAt");

ALTER TABLE "WebhookArtifactQuarantine"
  ADD COLUMN IF NOT EXISTS "resolutionEvidence" JSONB;
ALTER TABLE "WebhookArtifactDeletionTombstone"
  ADD COLUMN IF NOT EXISTS "deleteSucceededAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "completionEvidence" JSONB;
ALTER TABLE "SlateInvocation"
  ADD COLUMN IF NOT EXISTS "artifactPurgedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "artifactPurgeReason" TEXT;

CREATE TABLE IF NOT EXISTS "WebhookTerminalFinalizationRepair" (
  "oid" BIGINT NOT NULL PRIMARY KEY,
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "claimToken" TEXT NOT NULL,
  "safeRejectionCode" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastAttemptAt" TIMESTAMP(3),
  "lastErrorCode" TEXT,
  "completedAt" TIMESTAMP(3),
  "completionEvidence" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "WebhookTerminalFinalizationRepair_id_key"
  ON "WebhookTerminalFinalizationRepair"("id");
CREATE UNIQUE INDEX IF NOT EXISTS "WebhookTerminalFinalizationRepair_key_key"
  ON "WebhookTerminalFinalizationRepair"("key");
CREATE INDEX IF NOT EXISTS "WebhookTerminalFinalizationRepair_status_createdAt_idx"
  ON "WebhookTerminalFinalizationRepair"("status", "createdAt");
