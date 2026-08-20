-- Additive Task 4 rollout. ManagedProviderAuthCredentials.oauthClientSecret remains for rollback.
CREATE TABLE IF NOT EXISTS "ManagedProviderAuthCredentialSecret" (
  "oid" BIGINT PRIMARY KEY, "id" TEXT NOT NULL, "managedCredentialsOid" BIGINT NOT NULL,
  "purpose" TEXT NOT NULL, "encryptedValue" TEXT NOT NULL, "secretVersion" INTEGER NOT NULL,
  "encryptionKeyVersion" INTEGER NOT NULL, "aadVersion" INTEGER NOT NULL, "status" TEXT NOT NULL,
  "validFrom" TIMESTAMP(3) NOT NULL, "validUntil" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "rotatedAt" TIMESTAMP(3), "revokedAt" TIMESTAMP(3),
  CONSTRAINT "sub_managed_secret_source_id_key" UNIQUE ("id"),
  CONSTRAINT "sub_managed_secret_source_owner_fk" FOREIGN KEY ("managedCredentialsOid") REFERENCES "ManagedProviderAuthCredentials"("oid") ON DELETE CASCADE,
  CONSTRAINT "sub_managed_secret_source_owner_version_key" UNIQUE ("managedCredentialsOid", "purpose", "secretVersion"),
  CONSTRAINT "sub_managed_secret_source_owner_id_version_key" UNIQUE ("managedCredentialsOid", "id", "secretVersion")
);
CREATE TABLE IF NOT EXISTS "ManagedProviderAuthCredentialsBackingSecret" (
  "oid" BIGINT PRIMARY KEY, "id" TEXT NOT NULL, "managedCredentialsBackingOid" BIGINT NOT NULL,
  "tenantOid" BIGINT NOT NULL, "providerAuthCredentialsOid" BIGINT NOT NULL, "managedCredentialsOid" BIGINT NOT NULL,
  "sourceSecretId" TEXT NOT NULL, "sourceSecretVersion" INTEGER NOT NULL, "purpose" TEXT NOT NULL,
  "encryptedValue" TEXT NOT NULL, "secretVersion" INTEGER NOT NULL, "encryptionKeyVersion" INTEGER NOT NULL,
  "aadVersion" INTEGER NOT NULL, "status" TEXT NOT NULL, "validFrom" TIMESTAMP(3) NOT NULL,
  "validUntil" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "rotatedAt" TIMESTAMP(3), "revokedAt" TIMESTAMP(3),
  CONSTRAINT "sub_managed_secret_backing_id_key" UNIQUE ("id"),
  CONSTRAINT "sub_managed_secret_backing_owner_fk" FOREIGN KEY ("managedCredentialsBackingOid") REFERENCES "ManagedProviderAuthCredentialsBacking"("oid") ON DELETE CASCADE,
  CONSTRAINT "sub_managed_secret_backing_tenant_fk" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE,
  CONSTRAINT "sub_managed_secret_backing_credential_fk" FOREIGN KEY ("providerAuthCredentialsOid") REFERENCES "ProviderAuthCredentials"("oid") ON DELETE CASCADE,
  CONSTRAINT "sub_managed_secret_backing_source_owner_fk" FOREIGN KEY ("managedCredentialsOid") REFERENCES "ManagedProviderAuthCredentials"("oid") ON DELETE CASCADE,
  CONSTRAINT "sub_managed_secret_backing_source_fk" FOREIGN KEY ("managedCredentialsOid", "sourceSecretId", "sourceSecretVersion") REFERENCES "ManagedProviderAuthCredentialSecret"("managedCredentialsOid", "id", "secretVersion") ON DELETE NO ACTION,
  CONSTRAINT "sub_managed_secret_backing_owner_version_key" UNIQUE ("managedCredentialsBackingOid", "purpose", "secretVersion")
);
CREATE UNIQUE INDEX IF NOT EXISTS sub_managed_secret_source_one_active ON "ManagedProviderAuthCredentialSecret" ("managedCredentialsOid", purpose) WHERE status = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS sub_managed_secret_backing_one_active ON "ManagedProviderAuthCredentialsBackingSecret" ("managedCredentialsBackingOid", purpose) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS sub_managed_secret_source_status_idx ON "ManagedProviderAuthCredentialSecret" ("managedCredentialsOid", status, "validUntil");
CREATE INDEX IF NOT EXISTS sub_managed_secret_backing_tenant_credential_idx ON "ManagedProviderAuthCredentialsBackingSecret" ("tenantOid", "providerAuthCredentialsOid");
CREATE INDEX IF NOT EXISTS sub_managed_secret_backing_source_idx ON "ManagedProviderAuthCredentialsBackingSecret" ("sourceSecretId", "sourceSecretVersion");
CREATE INDEX IF NOT EXISTS sub_managed_secret_backing_status_idx ON "ManagedProviderAuthCredentialsBackingSecret" ("managedCredentialsBackingOid", status, "validUntil");
CREATE INDEX IF NOT EXISTS sub_managed_secret_backing_source_owner_idx ON "ManagedProviderAuthCredentialsBackingSecret" ("managedCredentialsOid", "sourceSecretId", "sourceSecretVersion");
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sub_managed_secret_source_retiring_deadline') THEN
    ALTER TABLE "ManagedProviderAuthCredentialSecret" ADD CONSTRAINT sub_managed_secret_source_retiring_deadline CHECK (status <> 'retiring' OR "validUntil" IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sub_managed_secret_backing_retiring_deadline') THEN
    ALTER TABLE "ManagedProviderAuthCredentialsBackingSecret" ADD CONSTRAINT sub_managed_secret_backing_retiring_deadline CHECK (status <> 'retiring' OR "validUntil" IS NOT NULL);
  END IF;
END $$;
