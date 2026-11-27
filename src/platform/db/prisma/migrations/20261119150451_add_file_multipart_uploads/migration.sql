-- AlterTable
ALTER TABLE "FileUpload" ADD COLUMN     "multipartCompletionDigest" TEXT,
ADD COLUMN     "multipartPartSize" INTEGER,
ADD COLUMN     "multipartUploadId" TEXT;
