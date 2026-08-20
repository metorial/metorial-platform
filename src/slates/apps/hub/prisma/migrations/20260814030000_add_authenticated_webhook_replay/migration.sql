DO $$ BEGIN CREATE TYPE "SlateTriggerWebhookReplayKind" AS ENUM ('sync_response', 'dispatch'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "SlateTriggerWebhookReplayStatus" AS ENUM ('claimed', 'queued', 'responded', 'delivered', 'failed_retryable', 'failed_terminal'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "SlateTriggerWebhookDispatchOutboxStatus" AS ENUM ('pending', 'leased', 'retryable', 'delivered', 'dead_letter'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "SlateTriggerWebhookReplayClaim" (
  "oid" BIGINT PRIMARY KEY,
  "id" TEXT NOT NULL,
  "receiverOid" BIGINT NOT NULL,
  "receiverTriggerOid" BIGINT NOT NULL,
  "requestOid" BIGINT NOT NULL,
  "eventInputOid" BIGINT,
  "kind" "SlateTriggerWebhookReplayKind" NOT NULL,
  "status" "SlateTriggerWebhookReplayStatus" NOT NULL DEFAULT 'claimed',
  "specHash" TEXT NOT NULL,
  "ruleId" TEXT NOT NULL,
  "itemBindingHash" TEXT NOT NULL,
  "deliveryIdHash" TEXT NOT NULL,
  "itemAdapterId" TEXT,
  "itemAdapterVersion" INTEGER,
  "originalRequestHash" TEXT NOT NULL,
  "dispatchRequestHash" TEXT NOT NULL,
  "capturedSecretBindings" JSONB NOT NULL DEFAULT '{}'::JSONB,
  "encryptedSyncResponse" TEXT,
  "syncResponseEncryptionKeyVersion" INTEGER,
  "syncResponseAadVersion" INTEGER,
  "leaseExpiresAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hub_webhook_replay_claim_id_key" UNIQUE ("id"),
  CONSTRAINT "hub_webhook_replay_claim_event_input_key" UNIQUE ("eventInputOid"),
  CONSTRAINT "hub_webhook_replay_claim_identity_key" UNIQUE ("receiverTriggerOid", "specHash", "ruleId", "itemBindingHash", "deliveryIdHash"),
  CONSTRAINT "hub_webhook_replay_claim_receiver_fk" FOREIGN KEY ("receiverOid") REFERENCES "SlateTriggerReceiver"("oid") ON DELETE CASCADE,
  CONSTRAINT "hub_webhook_replay_claim_trigger_fk" FOREIGN KEY ("receiverTriggerOid") REFERENCES "SlateTriggerReceiverTrigger"("oid") ON DELETE CASCADE,
  CONSTRAINT "hub_webhook_replay_claim_request_fk" FOREIGN KEY ("requestOid") REFERENCES "SlateTriggerWebhookRequest"("oid") ON DELETE RESTRICT,
  CONSTRAINT "hub_webhook_replay_claim_event_input_fk" FOREIGN KEY ("eventInputOid") REFERENCES "SlateTriggerEventInput"("oid") ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS "SlateTriggerWebhookDispatchOutbox" (
  "oid" BIGINT PRIMARY KEY,
  "id" TEXT NOT NULL,
  "receiverOid" BIGINT NOT NULL,
  "receiverTriggerOid" BIGINT NOT NULL,
  "replayClaimOid" BIGINT NOT NULL,
  "eventInputOid" BIGINT NOT NULL,
  "requestPayloadOid" BIGINT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "signalTenantId" TEXT,
  "adapterCandidateId" TEXT NOT NULL,
  "itemBindingHash" TEXT NOT NULL,
  "deliveryIdHashes" TEXT[] NOT NULL,
  "itemAdapterId" TEXT,
  "itemAdapterVersion" INTEGER,
  "originalRequestHash" TEXT NOT NULL,
  "dispatchRequestHash" TEXT NOT NULL,
  "encryptedAcceptedPayload" TEXT NOT NULL,
  "acceptedPayloadEncryptionKeyVersion" INTEGER NOT NULL,
  "acceptedPayloadAadVersion" INTEGER NOT NULL,
  "status" "SlateTriggerWebhookDispatchOutboxStatus" NOT NULL DEFAULT 'pending',
  "leaseOwner" TEXT,
  "leaseExpiresAt" TIMESTAMP(3),
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readyAt" TIMESTAMP(3),
  "safeTerminalCode" TEXT,
  "deadLetterMetadata" JSONB,
  "signalIdempotencyKey" TEXT NOT NULL,
  "signalRequestFingerprint" TEXT,
  "signalRequest" JSONB,
  "confirmedSignalEventId" TEXT,
  "localEventId" TEXT NOT NULL,
  "localSourceId" TEXT NOT NULL,
  "deliveredAt" TIMESTAMP(3),
  "retentionExpiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hub_webhook_dispatch_outbox_id_key" UNIQUE ("id"),
  CONSTRAINT "hub_webhook_dispatch_outbox_replay_claim_key" UNIQUE ("replayClaimOid"),
  CONSTRAINT "hub_webhook_dispatch_outbox_event_input_key" UNIQUE ("eventInputOid"),
  CONSTRAINT "hub_webhook_dispatch_signal_key" UNIQUE ("signalIdempotencyKey"),
  CONSTRAINT "hub_webhook_dispatch_outbox_receiver_fk" FOREIGN KEY ("receiverOid") REFERENCES "SlateTriggerReceiver"("oid") ON DELETE CASCADE,
  CONSTRAINT "hub_webhook_dispatch_outbox_trigger_fk" FOREIGN KEY ("receiverTriggerOid") REFERENCES "SlateTriggerReceiverTrigger"("oid") ON DELETE CASCADE,
  CONSTRAINT "hub_webhook_dispatch_outbox_replay_claim_fk" FOREIGN KEY ("replayClaimOid") REFERENCES "SlateTriggerWebhookReplayClaim"("oid") ON DELETE CASCADE,
  CONSTRAINT "hub_webhook_dispatch_outbox_event_input_fk" FOREIGN KEY ("eventInputOid") REFERENCES "SlateTriggerEventInput"("oid") ON DELETE RESTRICT,
  CONSTRAINT "hub_webhook_dispatch_outbox_payload_fk" FOREIGN KEY ("requestPayloadOid") REFERENCES "SlateTriggerWebhookRequestPayload"("oid") ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "hub_webhook_replay_claim_receiver_status_idx" ON "SlateTriggerWebhookReplayClaim" ("receiverOid", "status", "expiresAt");
CREATE INDEX IF NOT EXISTS "hub_webhook_replay_claim_retention_idx" ON "SlateTriggerWebhookReplayClaim" ("status", "leaseExpiresAt", "expiresAt");
CREATE INDEX IF NOT EXISTS "hub_webhook_dispatch_due_idx" ON "SlateTriggerWebhookDispatchOutbox" ("status", "nextAttemptAt", "leaseExpiresAt");
CREATE INDEX IF NOT EXISTS "hub_webhook_dispatch_tenant_signal_idx" ON "SlateTriggerWebhookDispatchOutbox" ("tenantId", "signalIdempotencyKey");
CREATE INDEX IF NOT EXISTS "hub_webhook_dispatch_retention_idx" ON "SlateTriggerWebhookDispatchOutbox" ("retentionExpiresAt", "status", "leaseExpiresAt");

