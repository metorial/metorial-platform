-- AlterEnum
ALTER TYPE "ProviderAuthCredentialsOrigin" ADD VALUE 'installation_template';

-- AlterTable
ALTER TABLE "ProviderAuthCredentials" ADD COLUMN     "fixedAuthInput" JSONB,
ADD COLUMN     "fixedAuthMethodKey" TEXT,
ADD COLUMN     "templateId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ProviderAuthCredentials_tenantOid_templateId_key" ON "ProviderAuthCredentials"("tenantOid", "templateId");
