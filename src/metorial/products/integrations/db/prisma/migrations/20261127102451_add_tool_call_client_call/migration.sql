-- AlterTable
ALTER TABLE "ToolCall" ADD COLUMN     "clientCallId" TEXT,
ADD COLUMN     "clientCallSource" TEXT;

-- CreateIndex
CREATE INDEX "ToolCall_tenantOid_clientCallId_idx" ON "ToolCall"("tenantOid", "clientCallId");
