-- AlterTable
ALTER TABLE "Instance" ADD COLUMN     "agentTrackingLinkedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "agentTrackingLinkedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "agentTrackingLinkedAt" TIMESTAMP(3);
