-- AlterTable
ALTER TABLE "WorkflowRun" ADD COLUMN     "pendingReason" TEXT,
ADD COLUMN     "pendingReasonUpdatedAt" TIMESTAMP(3);
