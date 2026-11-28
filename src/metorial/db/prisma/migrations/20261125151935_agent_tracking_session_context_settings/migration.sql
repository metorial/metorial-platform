-- AlterTable
ALTER TABLE "AgentTrackingOrganizationSettings" ADD COLUMN     "historyImport" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sessionContext" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sessionTitles" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ticketUrlTemplate" TEXT;
