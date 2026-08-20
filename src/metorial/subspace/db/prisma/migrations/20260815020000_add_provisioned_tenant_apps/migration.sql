CREATE TYPE "ProvisionedTenantAppCredentialOwnerType" AS ENUM ('managed', 'byo');
CREATE TYPE "ProvisionedAppProjectionEntityKind" AS ENUM ('route', 'binding');
CREATE TYPE "ProvisionedAppProjectionOutboxStatus" AS ENUM ('pending', 'delivering', 'delivered');

-- A managed route secret ID is shared by every tenant backing of that route.
-- Keep identity exact within its backing/version without imposing global cross-tenant uniqueness.
ALTER TABLE "ManagedProviderAuthCredentialsBackingSecret"
  DROP CONSTRAINT "sub_managed_secret_backing_id_key";
ALTER TABLE "ManagedProviderAuthCredentialsBackingSecret"
  ADD CONSTRAINT "sub_managed_secret_backing_owner_id_version_key"
  UNIQUE ("managedCredentialsBackingOid", id, "secretVersion");

CREATE TABLE "ProvisionedVendorAppRoute" (
  oid BIGINT PRIMARY KEY,
  id TEXT NOT NULL UNIQUE,
  vendor TEXT NOT NULL,
  purpose TEXT NOT NULL,
  "routeIdentifier" TEXT NOT NULL UNIQUE,
  generation INTEGER NOT NULL,
  "credentialOwnerRef" TEXT NOT NULL,
  "routeSecretId" TEXT NOT NULL,
  "routeSecretVersion" INTEGER NOT NULL,
  "vendorVerificationSecretId" TEXT NOT NULL,
  "vendorVerificationVersion" INTEGER NOT NULL,
  status TEXT NOT NULL,
  "projectionDigest" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT sub_provisioned_route_secret_separation_check CHECK (
    "routeSecretId" <> "vendorVerificationSecretId"
    AND "routeSecretVersion" > 0
    AND "vendorVerificationVersion" > 0
    AND generation > 0
  )
);

CREATE TABLE "ProvisionedTenantApp" (
  oid BIGINT PRIMARY KEY,
  id TEXT NOT NULL UNIQUE,
  "tenantOid" BIGINT NOT NULL,
  "callbackInstanceOid" BIGINT NOT NULL,
  "vendorAppRouteOid" BIGINT NOT NULL,
  "hubReceiverId" TEXT NOT NULL,
  "hubReceiverGeneration" INTEGER NOT NULL,
  "hubReceiverTriggerId" TEXT NOT NULL,
  "triggerActionId" TEXT NOT NULL,
  "triggerSpecHash" TEXT NOT NULL,
  vendor TEXT NOT NULL,
  purpose TEXT NOT NULL,
  "externalAppId" TEXT,
  "externalAccountId" TEXT,
  "externalInstallationId" TEXT,
  "externalOwnershipKey" TEXT,
  "retainedExternalOwnershipKey" TEXT,
  "ownerIdentity" TEXT,
  "credentialOwnerType" "ProvisionedTenantAppCredentialOwnerType" NOT NULL,
  "managedCredentialsOid" BIGINT,
  "credentialOwnerRef" TEXT NOT NULL,
  "credentialSecretId" TEXT,
  "credentialSecretPurpose" TEXT NOT NULL DEFAULT 'vendor_verification',
  "credentialVersion" INTEGER NOT NULL,
  generation INTEGER NOT NULL,
  status TEXT NOT NULL,
  "projectionDigest" TEXT NOT NULL,
  "correlationId" TEXT,
  "expiresAt" TIMESTAMP(3),
  "githubManifestStateHash" TEXT,
  "githubManifestStateExpiresAt" TIMESTAMP(3),
  "githubManifestCompletedAt" TIMESTAMP(3),
  "githubInstallationCompletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "ProvisionedTenantApp_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"(oid) ON DELETE CASCADE,
  CONSTRAINT "ProvisionedTenantApp_callbackInstanceOid_fkey" FOREIGN KEY ("callbackInstanceOid") REFERENCES "CallbackInstance"(oid) ON DELETE CASCADE,
  CONSTRAINT "ProvisionedTenantApp_vendorAppRouteOid_fkey" FOREIGN KEY ("vendorAppRouteOid") REFERENCES "ProvisionedVendorAppRoute"(oid) ON DELETE RESTRICT,
  CONSTRAINT "ProvisionedTenantApp_managedCredentialsOid_fkey" FOREIGN KEY ("managedCredentialsOid") REFERENCES "ManagedProviderAuthCredentials"(oid) ON DELETE RESTRICT,
  CONSTRAINT sub_provisioned_tenant_app_owner_shape_check CHECK (
    ("credentialOwnerType" = 'managed' AND "managedCredentialsOid" IS NOT NULL)
    OR ("credentialOwnerType" = 'byo' AND "managedCredentialsOid" IS NULL)
  ),
  CONSTRAINT sub_provisioned_tenant_app_activation_check CHECK (
    status <> 'active'
    OR (
      "externalOwnershipKey" IS NOT NULL
      AND "credentialSecretId" IS NOT NULL
      AND "credentialSecretPurpose" = 'vendor_verification'
      AND "credentialVersion" > 0
      AND generation > 0
    )
  )
);

CREATE TABLE "ProvisionedAppProjectionOutbox" (
  oid BIGINT PRIMARY KEY,
  id TEXT NOT NULL UNIQUE,
  "entityKind" "ProvisionedAppProjectionEntityKind" NOT NULL,
  "entityId" TEXT NOT NULL,
  generation INTEGER NOT NULL,
  "projectionDigest" TEXT NOT NULL,
  "correlationId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL UNIQUE,
  tombstone BOOLEAN NOT NULL DEFAULT false,
  payload JSONB NOT NULL,
  status "ProvisionedAppProjectionOutboxStatus" NOT NULL DEFAULT 'pending',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "deliveryToken" TEXT,
  "deliveryLeaseExpiresAt" TIMESTAMP(3),
  "lastAttemptAt" TIMESTAMP(3),
  "lastErrorCode" TEXT,
  "deliveredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT sub_provisioned_projection_generation_key UNIQUE ("entityKind", "entityId", generation)
);

CREATE UNIQUE INDEX sub_provisioned_tenant_app_external_owner_key ON "ProvisionedTenantApp" ("externalOwnershipKey");
CREATE INDEX sub_provisioned_route_vendor_status_idx ON "ProvisionedVendorAppRoute" (vendor, purpose, status);
CREATE INDEX sub_provisioned_route_expiry_idx ON "ProvisionedVendorAppRoute" (status, "expiresAt");
CREATE INDEX sub_provisioned_tenant_app_managed_idx ON "ProvisionedTenantApp" ("managedCredentialsOid", "tenantOid", "callbackInstanceOid", purpose);
CREATE INDEX sub_provisioned_tenant_app_installation_idx ON "ProvisionedTenantApp" ("vendorAppRouteOid", "externalInstallationId");
CREATE INDEX sub_provisioned_tenant_app_receiver_idx ON "ProvisionedTenantApp" ("tenantOid", "callbackInstanceOid", "hubReceiverId", "hubReceiverGeneration");
CREATE INDEX sub_provisioned_tenant_app_vendor_installation_idx ON "ProvisionedTenantApp" (vendor, "externalInstallationId");
CREATE INDEX sub_provisioned_tenant_app_retained_owner_idx ON "ProvisionedTenantApp" ("vendorAppRouteOid", "retainedExternalOwnershipKey");
CREATE INDEX sub_provisioned_tenant_app_status_idx ON "ProvisionedTenantApp" (status, "expiresAt");
CREATE INDEX sub_provisioned_projection_pending_idx ON "ProvisionedAppProjectionOutbox" (status, "deliveryLeaseExpiresAt", "createdAt");

CREATE UNIQUE INDEX sub_provisioned_tenant_app_managed_owner_active
  ON "ProvisionedTenantApp" ("managedCredentialsOid", "tenantOid", "callbackInstanceOid", purpose)
  WHERE "credentialOwnerType" = 'managed'
    AND "managedCredentialsOid" IS NOT NULL
    AND "deletedAt" IS NULL;
