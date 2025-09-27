-- AlterTable
ALTER TABLE "public"."ProviderOAuthConnection" ADD COLUMN     "registrationOid" BIGINT,
ALTER COLUMN "clientSecret" DROP NOT NULL,
ALTER COLUMN "metadata" DROP NOT NULL;

-- CreateTable
CREATE TABLE "public"."ProviderOAuthAutoRegistration" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientSecret" TEXT,
    "generatedClientName" TEXT NOT NULL,
    "registrationClientUri" TEXT,
    "registrationAccessToken" TEXT,
    "clientSecretExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "discoveryDocumentOid" BIGINT NOT NULL,

    CONSTRAINT "ProviderOAuthAutoRegistration_pkey" PRIMARY KEY ("oid")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProviderOAuthAutoRegistration_id_key" ON "public"."ProviderOAuthAutoRegistration"("id");

-- AddForeignKey
ALTER TABLE "public"."ProviderOAuthConnection" ADD CONSTRAINT "ProviderOAuthConnection_registrationOid_fkey" FOREIGN KEY ("registrationOid") REFERENCES "public"."ProviderOAuthAutoRegistration"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProviderOAuthAutoRegistration" ADD CONSTRAINT "ProviderOAuthAutoRegistration_discoveryDocumentOid_fkey" FOREIGN KEY ("discoveryDocumentOid") REFERENCES "public"."ProviderOAuthDiscoveryDocument"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;
