CREATE TABLE "SlateProvisionedAppRouteProjection" (
  oid BIGINT PRIMARY KEY,
  id TEXT NOT NULL CONSTRAINT hub_provisioned_route_id_key UNIQUE,
  "provisionedRouteId" TEXT NOT NULL CONSTRAINT hub_provisioned_route_authority_key UNIQUE,
  "routeIdentifier" TEXT NOT NULL CONSTRAINT hub_provisioned_route_selector_key UNIQUE,
  vendor TEXT NOT NULL,
  purpose TEXT NOT NULL,
  "credentialOwnerRef" TEXT NOT NULL,
  generation INTEGER NOT NULL,
  "routeSecretId" TEXT NOT NULL,
  "routeSecretVersion" INTEGER NOT NULL,
  "vendorVerificationSecretId" TEXT NOT NULL,
  "vendorVerificationVersion" INTEGER NOT NULL,
  status TEXT NOT NULL,
  "projectionDigest" TEXT NOT NULL,
  "correlationId" TEXT NOT NULL,
  "tombstonedAt" TIMESTAMP(3),
  "tombstoneRetainUntil" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT hub_provisioned_route_shape_check CHECK (
    generation > 0
    AND "routeSecretVersion" > 0
    AND "vendorVerificationVersion" > 0
    AND "routeSecretId" <> "vendorVerificationSecretId"
    AND ("tombstonedAt" IS NULL OR "tombstoneRetainUntil" IS NOT NULL)
  )
);

CREATE TABLE "SlateProvisionedTenantAppProjection" (
  oid BIGINT PRIMARY KEY,
  id TEXT NOT NULL CONSTRAINT hub_provisioned_binding_id_key UNIQUE,
  "provisionedTenantAppId" TEXT NOT NULL CONSTRAINT hub_provisioned_binding_authority_key UNIQUE,
  "routeProjectionOid" BIGINT NOT NULL,
  "routeIdentifier" TEXT NOT NULL,
  "routeGeneration" INTEGER NOT NULL,
  "tenantOid" BIGINT NOT NULL,
  "receiverOid" BIGINT NOT NULL,
  "receiverTriggerOid" BIGINT NOT NULL,
  "callbackInstanceId" TEXT NOT NULL,
  "hubReceiverGeneration" INTEGER NOT NULL,
  "triggerActionId" TEXT NOT NULL,
  "triggerSpecHash" TEXT NOT NULL,
  vendor TEXT NOT NULL,
  purpose TEXT NOT NULL,
  "externalAppId" TEXT,
  "externalAccountId" TEXT,
  "externalInstallationId" TEXT,
  "externalOwnershipKey" TEXT CONSTRAINT hub_provisioned_binding_external_owner_key UNIQUE,
  "retainedExternalOwnershipKey" TEXT,
  "ownerIdentity" TEXT,
  "credentialOwnerType" TEXT NOT NULL,
  "credentialOwnerRef" TEXT NOT NULL,
  "credentialSecretId" TEXT,
  "credentialSecretPurpose" TEXT NOT NULL,
  "credentialVersion" INTEGER NOT NULL,
  generation INTEGER NOT NULL,
  status TEXT NOT NULL,
  "projectionDigest" TEXT NOT NULL,
  "correlationId" TEXT NOT NULL,
  "tombstonedAt" TIMESTAMP(3),
  "tombstoneRetainUntil" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT hub_provisioned_binding_route_fk FOREIGN KEY ("routeProjectionOid") REFERENCES "SlateProvisionedAppRouteProjection"(oid) ON DELETE RESTRICT,
  CONSTRAINT hub_provisioned_binding_tenant_fk FOREIGN KEY ("tenantOid") REFERENCES "Tenant"(oid) ON DELETE RESTRICT,
  CONSTRAINT hub_provisioned_binding_receiver_fk FOREIGN KEY ("receiverOid") REFERENCES "SlateTriggerReceiver"(oid) ON DELETE RESTRICT,
  CONSTRAINT hub_provisioned_binding_trigger_fk FOREIGN KEY ("receiverTriggerOid") REFERENCES "SlateTriggerReceiverTrigger"(oid) ON DELETE RESTRICT,
  CONSTRAINT hub_provisioned_binding_shape_check CHECK (
    generation > 0
    AND "routeGeneration" > 0
    AND "hubReceiverGeneration" > 0
    AND "credentialVersion" > 0
    AND (
      status <> 'active'
      OR (
        "externalOwnershipKey" IS NOT NULL
        AND "credentialSecretId" IS NOT NULL
        AND "credentialSecretPurpose" = 'vendor_verification'
      )
    )
    AND ("tombstonedAt" IS NULL OR "tombstoneRetainUntil" IS NOT NULL)
  ),
  CONSTRAINT hub_provisioned_binding_route_owner_key UNIQUE ("routeIdentifier", "externalOwnershipKey")
);

CREATE INDEX hub_provisioned_route_status_idx ON "SlateProvisionedAppRouteProjection" (vendor, status, "expiresAt");
CREATE INDEX hub_provisioned_route_tombstone_idx ON "SlateProvisionedAppRouteProjection" (status, "tombstoneRetainUntil");
CREATE INDEX hub_provisioned_binding_route_status_idx ON "SlateProvisionedTenantAppProjection" ("routeProjectionOid", status, "expiresAt");
CREATE INDEX hub_provisioned_binding_receiver_idx ON "SlateProvisionedTenantAppProjection" ("tenantOid", "receiverOid", "receiverTriggerOid");
CREATE INDEX hub_provisioned_binding_tombstone_idx ON "SlateProvisionedTenantAppProjection" (status, "tombstoneRetainUntil");
CREATE INDEX hub_provisioned_binding_retained_owner_idx ON "SlateProvisionedTenantAppProjection" ("routeProjectionOid", "retainedExternalOwnershipKey");
