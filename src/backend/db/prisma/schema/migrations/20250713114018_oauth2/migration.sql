-- AlterTable
ALTER TABLE "ProviderOAuthConnectionAuthAttempt" ADD COLUMN     "associatedTokenErrorDisabledAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ProviderOAuthConnectionAuthToken" ADD COLUMN     "errorCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "errorDisabledAt" TIMESTAMP(3),
ADD COLUMN     "firstErrorAt" TIMESTAMP(3),
ADD COLUMN     "lastErrorAt" TIMESTAMP(3);
