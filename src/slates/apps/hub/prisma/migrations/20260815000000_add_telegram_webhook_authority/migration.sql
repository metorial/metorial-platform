ALTER TABLE "SlateTriggerReceiver"
  ADD COLUMN "telegramWebhookGeneration" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "telegramWebhookMutationVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "telegramWebhookLeaseToken" TEXT,
  ADD COLUMN "telegramWebhookLeaseExpiresAt" TIMESTAMP(3),
  ADD COLUMN "telegramWebhookRemoteKnown" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "telegramWebhookRefCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "telegramWebhookAllowedUpdates" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "telegramWebhookUrl" TEXT,
  ADD COLUMN "telegramWebhookSecretFingerprint" TEXT;

CREATE INDEX "hub_telegram_webhook_lease_idx"
  ON "SlateTriggerReceiver"("telegramWebhookLeaseExpiresAt");
