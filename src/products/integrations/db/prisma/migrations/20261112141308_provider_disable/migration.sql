-- AlterTable
ALTER TABLE "Provider" ADD COLUMN     "disabledAt" TIMESTAMP(3),
ADD COLUMN     "isDisabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Provider_isDisabled_idx" ON "Provider"("isDisabled");
