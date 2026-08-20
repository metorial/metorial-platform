DO $$ BEGIN CREATE TYPE "EventInitializationStatus" AS ENUM ('awaiting_enqueue', 'queued', 'initialized'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "Event"
  ADD COLUMN IF NOT EXISTS "requestFingerprint" TEXT,
  ADD COLUMN IF NOT EXISTS "initializationStatus" "EventInitializationStatus" NOT NULL DEFAULT 'awaiting_enqueue',
  ADD COLUMN IF NOT EXISTS "initializationEnqueuedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "initializedAt" TIMESTAMP(3);

-- Existing rows predate the initialization marker and must never be delivered again merely
-- because this migration introduced the repair state machine.
UPDATE "Event"
SET "initializationStatus" = 'initialized',
    "initializedAt" = COALESCE("updatedAt", "createdAt")
WHERE "requestFingerprint" IS NULL;

-- Idempotency fingerprints are enforced by the create path. The columns stay nullable because
-- ordinary non-idempotent events intentionally have neither an idempotency key nor a fingerprint.

CREATE INDEX IF NOT EXISTS "Event_initializationStatus_idempotencyKey_createdAt_idx" ON "Event" ("initializationStatus", "idempotencyKey", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "EventDeliveryIntent_eventOid_destinationOid_key" ON "EventDeliveryIntent" ("eventOid", "destinationOid");
