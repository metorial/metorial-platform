ALTER TABLE "SlateTriggerReceiver"
ADD COLUMN "consecutivePollingFailures" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "consecutiveEventFailures" INTEGER NOT NULL DEFAULT 0;
