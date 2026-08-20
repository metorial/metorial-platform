CREATE TYPE "SlateTriggerRegistrationStatus" AS ENUM (
  'pending', 'registering', 'registered', 'renewing', 'failed', 'unregistering', 'unregistered'
);

CREATE TYPE "SlateWebhookVerificationMechanism" AS ENUM (
  'path_secret_only', 'hub', 'provider'
);

CREATE TYPE "SlateTriggerRegistrationIntentKind" AS ENUM (
  'register', 'reregister', 'renew', 'unregister', 'delete'
);

CREATE TYPE "SlateTriggerRegistrationOutboxStatus" AS ENUM ('pending', 'enqueued');

ALTER TABLE "SlateTriggerReceiver"
  ADD COLUMN "tombstonedAt" TIMESTAMP(3),
  ADD COLUMN "callbackOwnerVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "callbackOwnerMutationId" TEXT,
  ADD COLUMN "callbackOwnerMutationDigest" TEXT;

ALTER TABLE "SlateTriggerReceiver"
  ADD CONSTRAINT "hub_callback_owner_version_check" CHECK ("callbackOwnerVersion" >= 0),
  ADD CONSTRAINT "hub_callback_owner_mutation_pair_check" CHECK (
    ("callbackOwnerMutationId" IS NULL AND "callbackOwnerMutationDigest" IS NULL)
    OR ("callbackOwnerMutationId" IS NOT NULL AND "callbackOwnerMutationDigest" IS NOT NULL)
  );

UPDATE "SlateTriggerReceiverTrigger"
SET "registrationStatus" = 'pending'
WHERE "registrationStatus" NOT IN (
  'pending', 'registering', 'registered', 'renewing', 'failed', 'unregistering', 'unregistered'
);

ALTER TABLE "SlateTriggerReceiverTrigger"
  ALTER COLUMN "registrationStatus" DROP DEFAULT,
  ALTER COLUMN "registrationStatus" TYPE "SlateTriggerRegistrationStatus"
    USING ("registrationStatus"::"SlateTriggerRegistrationStatus"),
  ALTER COLUMN "registrationStatus" SET DEFAULT 'pending',
  ADD COLUMN "registrationTransitionVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "registrationDetailsGeneration" INTEGER,
  ADD COLUMN "registrationIntentKind" "SlateTriggerRegistrationIntentKind" NOT NULL DEFAULT 'register',
  ADD COLUMN "registrationLeaseToken" TEXT,
  ADD COLUMN "registrationLeaseExpiresAt" TIMESTAMP(3),
  ADD COLUMN "registrationEnqueueDeadlineAt" TIMESTAMP(3),
  ADD COLUMN "registrationLastAttemptAt" TIMESTAMP(3),
  ADD COLUMN "registrationErrorCode" TEXT,
  ADD COLUMN "registrationErrorMessage" TEXT,
  ADD COLUMN "registrationErrorMetadata" JSONB,
  ADD COLUMN "registrationErrorAt" TIMESTAMP(3),
  ADD COLUMN "remoteRegistrationKnown" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "tombstonedAt" TIMESTAMP(3),
  ADD COLUMN "ingressDisabledAt" TIMESTAMP(3),
  ADD COLUMN "verificationMechanism" "SlateWebhookVerificationMechanism" NOT NULL DEFAULT 'path_secret_only',
  ADD COLUMN "verificationSpecHash" TEXT,
  ADD COLUMN "authoritativeStateVersion" INTEGER NOT NULL DEFAULT 1;

UPDATE "SlateTriggerReceiverTrigger"
SET "registrationDetailsGeneration" = "registrationGeneration"
WHERE "encryptedRegistrationDetails" IS NOT NULL;

UPDATE "SlateTriggerReceiverTrigger"
SET
  "registrationStatus" = 'registered',
  "remoteRegistrationKnown" = true
WHERE
  "source" = 'webhook'
  AND (
    "encryptedRegistrationDetails" IS NOT NULL
    OR "registrationDetails" <> 'null'::jsonb
  );

UPDATE "SlateTriggerReceiverTrigger"
SET "registrationStatus" = 'unregistered'
WHERE "source" = 'polling';

UPDATE "SlateTriggerReceiverTrigger"
SET "registrationEnqueueDeadlineAt" = CURRENT_TIMESTAMP
WHERE "source" = 'webhook' AND "registrationStatus" = 'pending';

CREATE INDEX "hub_trigger_receiver_tombstone_idx"
  ON "SlateTriggerReceiver"("tombstonedAt");

CREATE INDEX "hub_trigger_registration_repair_idx"
  ON "SlateTriggerReceiverTrigger"("registrationStatus", "registrationEnqueueDeadlineAt", "registrationLeaseExpiresAt");
CREATE INDEX "hub_trigger_tombstone_cleanup_idx"
  ON "SlateTriggerReceiverTrigger"("tombstonedAt", "registrationStatus");

ALTER TABLE "SlateTriggerReceiverTrigger"
  ADD CONSTRAINT "hub_trigger_registration_error_pair_check" CHECK (
    ("registrationErrorCode" IS NULL AND "registrationErrorMessage" IS NULL AND "registrationErrorAt" IS NULL)
    OR
    ("registrationErrorCode" IS NOT NULL AND "registrationErrorMessage" IS NOT NULL AND "registrationErrorAt" IS NOT NULL)
  ),
  ADD CONSTRAINT "hub_trigger_registration_error_code_check" CHECK (
    "registrationErrorCode" IS NULL OR "registrationErrorCode" IN (
      'provider_rejected',
      'provider_timeout',
      'provider_transport_error',
      'invalid_provider_result',
      'registration_capability_unavailable',
      'cleanup_failed',
      'registration_capture_conflict'
    )
  ),
  ADD CONSTRAINT "hub_trigger_registration_generation_check" CHECK ("registrationGeneration" > 0),
  ADD CONSTRAINT "hub_trigger_registration_transition_version_check" CHECK ("registrationTransitionVersion" >= 0),
  ADD CONSTRAINT "hub_trigger_authoritative_state_version_check" CHECK ("authoritativeStateVersion" > 0),
  ADD CONSTRAINT "hub_trigger_registration_lease_pair_check" CHECK (
    ("registrationLeaseToken" IS NULL AND "registrationLeaseExpiresAt" IS NULL)
    OR ("registrationLeaseToken" IS NOT NULL AND "registrationLeaseExpiresAt" IS NOT NULL)
  );

ALTER TABLE "SlateTriggerReceiverTrigger"
  ADD CONSTRAINT "hub_trigger_registration_details_generation_check" CHECK (
    ("encryptedRegistrationDetails" IS NULL AND "registrationDetailsGeneration" IS NULL)
    OR
    ("encryptedRegistrationDetails" IS NOT NULL AND "registrationDetailsGeneration" IS NOT NULL)
  );

CREATE TABLE "SlateTriggerRegistrationOutbox" (
  "oid" BIGINT NOT NULL,
  "id" TEXT NOT NULL,
  "receiverTriggerOid" BIGINT NOT NULL,
  "operation" "SlateTriggerRegistrationIntentKind" NOT NULL,
  "registrationGeneration" INTEGER NOT NULL,
  "status" "SlateTriggerRegistrationOutboxStatus" NOT NULL DEFAULT 'pending',
  "enqueuedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SlateTriggerRegistrationOutbox_pkey" PRIMARY KEY ("oid")
);

CREATE UNIQUE INDEX "hub_trigger_registration_outbox_id_key"
  ON "SlateTriggerRegistrationOutbox"("id");
CREATE UNIQUE INDEX "hub_trigger_registration_outbox_intent_key"
  ON "SlateTriggerRegistrationOutbox"("receiverTriggerOid", "operation", "registrationGeneration");
CREATE INDEX "hub_trigger_registration_outbox_pending_idx"
  ON "SlateTriggerRegistrationOutbox"("status", "createdAt");
ALTER TABLE "SlateTriggerRegistrationOutbox"
  ADD CONSTRAINT "hub_trigger_registration_outbox_trigger_fk"
  FOREIGN KEY ("receiverTriggerOid") REFERENCES "SlateTriggerReceiverTrigger"("oid")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SlateTriggerWebhookRequest"
  ADD COLUMN "authenticatedBoundaryKind" TEXT,
  ADD COLUMN "authenticatedBoundaryAt" TIMESTAMP(3),
  ADD COLUMN "authenticatedBindingHash" TEXT;

ALTER TABLE "SlateTriggerWebhookRequest"
  ADD CONSTRAINT "hub_webhook_request_authenticated_boundary_check" CHECK (
    (
      "authenticatedBoundaryKind" IS NULL
      AND "authenticatedBoundaryAt" IS NULL
      AND "authenticatedBindingHash" IS NULL
    )
    OR (
      "authenticatedBoundaryKind" IN ('receiver_route', 'shared_provisioned_app')
      AND "authenticatedBoundaryAt" IS NOT NULL
      AND "authenticatedBindingHash" IS NOT NULL
    )
  );
