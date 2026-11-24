-- AlterEnum
ALTER TYPE "SlatePackImportStatus" ADD VALUE 'uploading';

-- AlterTable
ALTER TABLE "SlatePackImport" ADD COLUMN     "multipartPartSize" INTEGER,
ADD COLUMN     "multipartUploadId" TEXT,
ADD COLUMN     "uploadExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "SlatePackImport_status_uploadExpiresAt_idx" ON "SlatePackImport"("status", "uploadExpiresAt");
