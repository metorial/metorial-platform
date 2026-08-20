ALTER TABLE "SlateTriggerReceiverTrigger"
  ADD COLUMN "eventTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
