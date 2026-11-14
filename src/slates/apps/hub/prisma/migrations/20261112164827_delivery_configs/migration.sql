-- AlterEnum
ALTER TYPE "SlateWebhookRegistrationType" ADD VALUE 'delivery_config';

-- AlterTable
ALTER TABLE "SlateWebhookRegistration" ADD COLUMN     "oauthClientId" TEXT;

-- CreateIndex
CREATE INDEX "SlateWebhookRegistration_slateOid_oauthClientId_idx" ON "SlateWebhookRegistration"("slateOid", "oauthClientId");
