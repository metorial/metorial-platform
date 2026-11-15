-- AlterTable
ALTER TABLE "TriggerRegistrationInstance" ADD COLUMN     "expansionFailureCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "expansionRetryAt" TIMESTAMP(3),
ADD COLUMN     "selection" JSONB,
ADD COLUMN     "state" JSONB,
ADD COLUMN     "stateClaimToken" TEXT,
ADD COLUMN     "stateClaimUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "TriggerRegistrationSchedule" ADD COLUMN     "claimToken" TEXT;

-- AlterTable
ALTER TABLE "TriggerWebhookTarget" ADD COLUMN     "registrationUrlKey" TEXT,
ADD COLUMN     "renewalClaimToken" TEXT,
ADD COLUMN     "renewalClaimUntil" TIMESTAMP(3),
ADD COLUMN     "renewalNextAttemptAt" TIMESTAMP(3),
ADD COLUMN     "renewalOperationId" TEXT;

-- AlterTable
ALTER TABLE "SlateWebhookRegistration" ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "renewAfter" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "TriggerEventDispatch" (
    "eventOid" BIGINT NOT NULL,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TriggerEventDispatch_pkey" PRIMARY KEY ("eventOid")
);

-- CreateTable
CREATE TABLE "TriggerRawEventDispatch" (
    "rawEventOid" BIGINT NOT NULL,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TriggerRawEventDispatch_pkey" PRIMARY KEY ("rawEventOid")
);

-- CreateTable
CREATE TABLE "TriggerWebhookExpansion" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "triggerRegistrationInstanceOid" BIGINT NOT NULL,
    "webhookEventOid" BIGINT,
    "webhookRegistrationOid" BIGINT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "payload" JSONB,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TriggerWebhookExpansion_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "TriggerWebhookRenewalResult" (
    "operationId" TEXT NOT NULL,
    "targetOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "secretOid" BIGINT NOT NULL,
    "invocationOid" BIGINT NOT NULL,
    "oldRegistrationIdentifier" TEXT NOT NULL,
    "registrationIdentifier" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "renewAfter" TIMESTAMP(3),
    "nextRenewalAt" TIMESTAMP(3),
    "deliveryBindingId" TEXT,
    "routingKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TriggerWebhookRenewalResult_pkey" PRIMARY KEY ("operationId")
);

-- CreateTable
CREATE TABLE "TriggerDeliveryRoute" (
    "oid" BIGINT NOT NULL,
    "bindingId" TEXT NOT NULL,
    "routingKey" TEXT NOT NULL,
    "webhookRegistrationOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TriggerDeliveryRoute_pkey" PRIMARY KEY ("oid")
);

-- CreateIndex
CREATE INDEX "TriggerEventDispatch_nextAttemptAt_eventOid_idx" ON "TriggerEventDispatch"("nextAttemptAt", "eventOid");

-- CreateIndex
CREATE INDEX "TriggerRawEventDispatch_nextAttemptAt_rawEventOid_idx" ON "TriggerRawEventDispatch"("nextAttemptAt", "rawEventOid");

-- CreateIndex
CREATE UNIQUE INDEX "TriggerWebhookExpansion_id_key" ON "TriggerWebhookExpansion"("id");

-- CreateIndex
CREATE INDEX "TriggerWebhookExpansion_completedAt_nextAttemptAt_id_idx" ON "TriggerWebhookExpansion"("completedAt", "nextAttemptAt", "id");

-- CreateIndex
CREATE INDEX "TriggerWebhookExpansion_webhookEventOid_idx" ON "TriggerWebhookExpansion"("webhookEventOid");

-- CreateIndex
CREATE UNIQUE INDEX "TriggerWebhookExpansion_triggerRegistrationInstanceOid_deli_key" ON "TriggerWebhookExpansion"("triggerRegistrationInstanceOid", "deliveryId");

-- CreateIndex
CREATE INDEX "TriggerWebhookRenewalResult_createdAt_operationId_idx" ON "TriggerWebhookRenewalResult"("createdAt", "operationId");

-- CreateIndex
CREATE INDEX "TriggerDeliveryRoute_webhookRegistrationOid_idx" ON "TriggerDeliveryRoute"("webhookRegistrationOid");

-- CreateIndex
CREATE UNIQUE INDEX "TriggerDeliveryRoute_bindingId_routingKey_webhookRegistrati_key" ON "TriggerDeliveryRoute"("bindingId", "routingKey", "webhookRegistrationOid");

-- CreateIndex
CREATE INDEX "TriggerWebhookTarget_status_renewalNextAttemptAt_idx" ON "TriggerWebhookTarget"("status", "renewalNextAttemptAt");

-- AddForeignKey
ALTER TABLE "TriggerEventDispatch" ADD CONSTRAINT "TriggerEventDispatch_eventOid_fkey" FOREIGN KEY ("eventOid") REFERENCES "TriggerEvent"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriggerRawEventDispatch" ADD CONSTRAINT "TriggerRawEventDispatch_rawEventOid_fkey" FOREIGN KEY ("rawEventOid") REFERENCES "TriggerRawEvent"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriggerWebhookExpansion" ADD CONSTRAINT "TriggerWebhookExpansion_triggerRegistrationInstanceOid_fkey" FOREIGN KEY ("triggerRegistrationInstanceOid") REFERENCES "TriggerRegistrationInstance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriggerWebhookExpansion" ADD CONSTRAINT "TriggerWebhookExpansion_webhookEventOid_fkey" FOREIGN KEY ("webhookEventOid") REFERENCES "SlateWebhookEvent"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriggerWebhookExpansion" ADD CONSTRAINT "TriggerWebhookExpansion_webhookRegistrationOid_fkey" FOREIGN KEY ("webhookRegistrationOid") REFERENCES "SlateWebhookRegistration"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriggerWebhookRenewalResult" ADD CONSTRAINT "TriggerWebhookRenewalResult_targetOid_fkey" FOREIGN KEY ("targetOid") REFERENCES "TriggerWebhookTarget"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriggerWebhookRenewalResult" ADD CONSTRAINT "TriggerWebhookRenewalResult_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "TriggerRegistrationInstance"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriggerWebhookRenewalResult" ADD CONSTRAINT "TriggerWebhookRenewalResult_secretOid_fkey" FOREIGN KEY ("secretOid") REFERENCES "Secret"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriggerWebhookRenewalResult" ADD CONSTRAINT "TriggerWebhookRenewalResult_invocationOid_fkey" FOREIGN KEY ("invocationOid") REFERENCES "SlateInvocation"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriggerDeliveryRoute" ADD CONSTRAINT "TriggerDeliveryRoute_webhookRegistrationOid_fkey" FOREIGN KEY ("webhookRegistrationOid") REFERENCES "SlateWebhookRegistration"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- Recover pending raw events left before durable dispatch was introduced. The bound matches the
-- delivery age cap, so events that were abandoned long ago are not replayed.
INSERT INTO "TriggerRawEventDispatch" ("rawEventOid")
SELECT "oid" FROM "TriggerRawEvent"
WHERE "processingStatus" = 'pending' AND "pendingTriggerMapCount" > 0
  AND "createdAt" > CURRENT_TIMESTAMP - interval '3 days'
ON CONFLICT ("rawEventOid") DO NOTHING;
