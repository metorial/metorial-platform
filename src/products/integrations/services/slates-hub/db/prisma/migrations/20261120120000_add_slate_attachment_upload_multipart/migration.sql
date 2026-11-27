-- AlterTable
ALTER TABLE "SlateAttachmentUpload" ADD COLUMN     "declaredSizeBytes" INTEGER,
ADD COLUMN     "multipartUploadId" TEXT,
ADD COLUMN     "partSizeBytes" INTEGER;
