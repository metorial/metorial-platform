-- AlterTable
ALTER TABLE "CallbackV2" ADD COLUMN     "triggerGroupSelections" JSONB;

-- AlterTable
ALTER TABLE "CallbackInstanceV2" ADD COLUMN     "selectableTriggerGroups" JSONB,
ADD COLUMN     "triggerGroupSelections" JSONB;
