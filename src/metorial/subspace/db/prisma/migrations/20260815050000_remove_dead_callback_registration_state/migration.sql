-- Task 17 is deliberately fail-closed. The destructive statements below are
-- reached only when the production migration query proves that neither legacy
-- registration rows nor the unused destination identifier contain live data.
BEGIN;

-- Keep an old application replica from racing the terminal verification. A
-- surviving legacy writer fails after this transaction instead of silently
-- recreating state that the new application can no longer read.
LOCK TABLE
  "CallbackReceiverRegistration",
  "CallbackInstance",
  "CallbackDestination"
IN ACCESS EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "CallbackReceiverRegistration" LIMIT 1) THEN
    RAISE EXCEPTION
      'Task 17 blocked: CallbackReceiverRegistration still contains live rows';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM "CallbackInstance"
     WHERE "activeRegistrationOid" IS NOT NULL
     LIMIT 1
  ) THEN
    RAISE EXCEPTION
      'Task 17 blocked: CallbackInstance still references a legacy registration';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM "CallbackDestination"
     WHERE "slateTriggerDestinationId" IS NOT NULL
     LIMIT 1
  ) THEN
    RAISE EXCEPTION
      'Task 17 blocked: CallbackDestination.slateTriggerDestinationId is still in use';
  END IF;
END $$;

ALTER TABLE "CallbackInstance"
  DROP COLUMN "activeRegistrationOid";

DROP TABLE "CallbackReceiverRegistration";
DROP TYPE "CallbackReceiverRegistrationStatus";

ALTER TABLE "CallbackDestination"
  DROP COLUMN "slateTriggerDestinationId";

-- Historical webhook-artifact retention and legacy plaintext secret columns
-- are intentionally not changed here. Their independent zero-finding and
-- full-release-window gates must be satisfied before a later cleanup migration.

COMMIT;
