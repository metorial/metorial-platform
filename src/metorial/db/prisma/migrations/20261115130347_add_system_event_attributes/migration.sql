-- AlterTable
ALTER TABLE "SystemEvent" ADD COLUMN     "attributes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "SystemEvent_attributes_idx" ON "SystemEvent" USING GIN ("attributes");
