-- CreateEnum
CREATE TYPE "WebhookRegistrationPurpose" AS ENUM ('webhook_receiver', 'delivery_setup');

-- AlterTable
ALTER TABLE "WebhookRegistrationV2" ADD COLUMN     "authCredentialsOid" BIGINT,
ADD COLUMN     "purpose" "WebhookRegistrationPurpose" NOT NULL DEFAULT 'webhook_receiver';

-- CreateIndex
CREATE INDEX "WebhookRegistrationV2_authCredentialsOid_idx" ON "WebhookRegistrationV2"("authCredentialsOid");

-- AddForeignKey
ALTER TABLE "WebhookRegistrationV2" ADD CONSTRAINT "WebhookRegistrationV2_authCredentialsOid_fkey" FOREIGN KEY ("authCredentialsOid") REFERENCES "ProviderAuthCredentials"("oid") ON DELETE SET NULL ON UPDATE CASCADE;
