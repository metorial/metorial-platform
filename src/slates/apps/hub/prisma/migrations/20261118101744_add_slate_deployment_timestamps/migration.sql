-- AlterTable
ALTER TABLE "SlateDeployment" ADD COLUMN     "endedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "SlateDeployment_status_createdAt_idx" ON "SlateDeployment"("status", "createdAt");
