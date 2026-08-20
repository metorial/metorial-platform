ALTER TABLE "SlateTriggerReceiverTrigger"
ADD COLUMN "telegramDetachMutationId" TEXT,
ADD COLUMN "telegramDetachGeneration" INTEGER,
ADD COLUMN "telegramDetachFinal" BOOLEAN,
ADD COLUMN "telegramDetachRemoteAppliedAt" TIMESTAMP(3),
ADD COLUMN "telegramDetachCompletedAt" TIMESTAMP(3);

CREATE INDEX "hub_telegram_detach_mutation_idx"
ON "SlateTriggerReceiverTrigger" ("telegramDetachMutationId", "telegramDetachGeneration");
