-- AlterTable
ALTER TABLE "RemoteOAuthAutoRegistration" ADD COLUMN     "callbackUrlOverride" TEXT,
ADD COLUMN     "usesIntegrationsCallback" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "RemoteOAuthConnectionSetup" ADD COLUMN     "redirectUri" TEXT,
ADD COLUMN     "registrationOid" BIGINT;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "dynamicOAuthCallbackUrlOverride" TEXT;

-- AddForeignKey
ALTER TABLE "RemoteOAuthConnectionSetup" ADD CONSTRAINT "RemoteOAuthConnectionSetup_registrationOid_fkey" FOREIGN KEY ("registrationOid") REFERENCES "RemoteOAuthAutoRegistration"("oid") ON DELETE SET NULL ON UPDATE CASCADE;
