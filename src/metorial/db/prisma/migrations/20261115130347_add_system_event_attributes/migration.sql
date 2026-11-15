-- AlterTable
ALTER TABLE "SystemEvent" ADD COLUMN     "attributes" TEXT[] DEFAULT ARRAY[]::TEXT[];
