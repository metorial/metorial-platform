-- CreateEnum
CREATE TYPE "SlateScopedInvocationGrantStatus" AS ENUM ('active', 'consumed', 'revoked');

-- CreateEnum
CREATE TYPE "SlateTriggerRegistrationStatus" AS ENUM ('pending', 'registering', 'registered', 'renewing', 'failed', 'unregistering', 'unregistered');

-- CreateEnum
CREATE TYPE "SlateTriggerRegistrationIntentKind" AS ENUM ('register', 'reregister', 'renew', 'unregister', 'delete');

-- CreateEnum
CREATE TYPE "SlateWebhookVerificationMechanism" AS ENUM ('path_secret_only', 'hub', 'provider');

-- CreateEnum
CREATE TYPE "SlateTriggerRegistrationOutboxStatus" AS ENUM ('pending', 'enqueued');

-- CreateEnum
CREATE TYPE "SlateTriggerWebhookReplayKind" AS ENUM ('sync_response', 'dispatch');

-- CreateEnum
CREATE TYPE "SlateTriggerWebhookReplayStatus" AS ENUM ('claimed', 'queued', 'responded', 'delivered', 'failed_retryable', 'failed_terminal');

-- CreateEnum
CREATE TYPE "SlateTriggerWebhookDispatchOutboxStatus" AS ENUM ('pending', 'leased', 'retryable', 'delivered', 'dead_letter');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SecretType" ADD VALUE 'slate_callback_path';
ALTER TYPE "SecretType" ADD VALUE 'slate_callback_value';
ALTER TYPE "SecretType" ADD VALUE 'slate_callback_registration';

-- AlterTable
ALTER TABLE "SlateTriggerReceiver" ADD COLUMN     "callbackOwnerMutationDigest" TEXT,
ADD COLUMN     "callbackOwnerMutationId" TEXT,
ADD COLUMN     "callbackOwnerVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "telegramWebhookAllowedUpdates" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "telegramWebhookGeneration" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "telegramWebhookLeaseExpiresAt" TIMESTAMP(3),
ADD COLUMN     "telegramWebhookLeaseToken" TEXT,
ADD COLUMN     "telegramWebhookMutationVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "telegramWebhookRefCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "telegramWebhookRemoteKnown" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "telegramWebhookSecretFingerprint" TEXT,
ADD COLUMN     "telegramWebhookUrl" TEXT,
ADD COLUMN     "tombstonedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SlateTriggerReceiverTrigger" ADD COLUMN     "authoritativeStateVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "eventTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "ingressDisabledAt" TIMESTAMP(3),
ADD COLUMN     "registrationDetailsSecretOid" BIGINT,
ADD COLUMN     "registrationEnqueueDeadlineAt" TIMESTAMP(3),
ADD COLUMN     "registrationErrorAt" TIMESTAMP(3),
ADD COLUMN     "registrationErrorCode" TEXT,
ADD COLUMN     "registrationErrorMessage" TEXT,
ADD COLUMN     "registrationErrorMetadata" JSONB,
ADD COLUMN     "registrationGeneration" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "registrationIntentKind" "SlateTriggerRegistrationIntentKind" NOT NULL DEFAULT 'register',
ADD COLUMN     "registrationLastAttemptAt" TIMESTAMP(3),
ADD COLUMN     "registrationLeaseExpiresAt" TIMESTAMP(3),
ADD COLUMN     "registrationLeaseToken" TEXT,
ADD COLUMN     "registrationStatus" "SlateTriggerRegistrationStatus" NOT NULL DEFAULT 'pending',
ADD COLUMN     "registrationTransitionVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "registrationVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "remoteRegistrationKnown" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "telegramDetachCompletedAt" TIMESTAMP(3),
ADD COLUMN     "telegramDetachFinal" BOOLEAN,
ADD COLUMN     "telegramDetachGeneration" INTEGER,
ADD COLUMN     "telegramDetachMutationId" TEXT,
ADD COLUMN     "telegramDetachRemoteAppliedAt" TIMESTAMP(3),
ADD COLUMN     "tombstonedAt" TIMESTAMP(3),
ADD COLUMN     "verificationMechanism" "SlateWebhookVerificationMechanism" NOT NULL DEFAULT 'path_secret_only',
ADD COLUMN     "verificationSpecHash" TEXT;

-- AlterTable
ALTER TABLE "SlateTriggerWebhookRequest" ADD COLUMN     "authenticatedBindingHash" TEXT,
ADD COLUMN     "authenticatedBoundaryAt" TIMESTAMP(3),
ADD COLUMN     "authenticatedBoundaryKind" TEXT,
ADD COLUMN     "bodyByteLength" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "bodyHash" TEXT,
ADD COLUMN     "capturePolicyHash" TEXT,
ADD COLUMN     "captureRuleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "captureSpecHashes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "capturedRequest" JSONB,
ADD COLUMN     "capturedRequestExpiresAt" TIMESTAMP(3),
ADD COLUMN     "outcome" TEXT NOT NULL DEFAULT 'accepted',
ADD COLUMN     "queueClaimState" TEXT,
ADD COLUMN     "queueClaimToken" TEXT,
ADD COLUMN     "queueClaimedAt" TIMESTAMP(3),
ADD COLUMN     "receiverOwnerId" TEXT,
ADD COLUMN     "redactedHeaders" JSONB,
ADD COLUMN     "redactedUrl" TEXT,
ADD COLUMN     "requestHash" TEXT,
ADD COLUMN     "safeRejectionCode" TEXT,
ADD COLUMN     "selectedRule" TEXT,
ADD COLUMN     "tenantId" TEXT,
ADD COLUMN     "terminalFailureAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SlateScopedInvocationGrant" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "SlateScopedInvocationGrantStatus" NOT NULL DEFAULT 'active',
    "bindings" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateScopedInvocationGrant_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateProvisionedAppRouteProjection" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "provisionedRouteId" TEXT NOT NULL,
    "routeIdentifier" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "oauthCredentialsOid" BIGINT,
    "authConfigOid" BIGINT,
    "generation" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "projectionDigest" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "tombstonedAt" TIMESTAMP(3),
    "tombstoneRetainUntil" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateProvisionedAppRouteProjection_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateProvisionedTenantAppProjection" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "provisionedTenantAppId" TEXT NOT NULL,
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
    "vendor" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "externalAppId" TEXT,
    "externalAccountId" TEXT,
    "externalInstallationId" TEXT,
    "externalOwnershipKey" TEXT,
    "retainedExternalOwnershipKey" TEXT,
    "ownerIdentity" TEXT,
    "authConfigOid" BIGINT,
    "generation" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "projectionDigest" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "tombstonedAt" TIMESTAMP(3),
    "tombstoneRetainUntil" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateProvisionedTenantAppProjection_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateTriggerRegistrationOutbox" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "receiverTriggerOid" BIGINT NOT NULL,
    "operation" "SlateTriggerRegistrationIntentKind" NOT NULL,
    "registrationGeneration" INTEGER NOT NULL,
    "authConfigId" TEXT,
    "callbackSecretIds" JSONB,
    "status" "SlateTriggerRegistrationOutboxStatus" NOT NULL DEFAULT 'pending',
    "enqueuedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateTriggerRegistrationOutbox_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateTriggerReceiverPathSecret" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "slateInstanceOid" BIGINT NOT NULL,
    "receiverOid" BIGINT NOT NULL,
    "secretOid" BIGINT NOT NULL,
    "lookupHash" TEXT NOT NULL,
    "generation" INTEGER NOT NULL DEFAULT 1,
    "plaintextIssuedAt" TIMESTAMP(3),
    "lastMutationId" TEXT,
    "lastMutationDigest" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateTriggerReceiverPathSecret_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateTriggerReceiverSecret" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "slateInstanceOid" BIGINT NOT NULL,
    "receiverOid" BIGINT NOT NULL,
    "receiverTriggerOid" BIGINT NOT NULL,
    "secretOid" BIGINT NOT NULL,
    "specHash" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "encoding" TEXT NOT NULL,
    "businessValidUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateTriggerReceiverSecret_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateTriggerWebhookReplayClaim" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "receiverOid" BIGINT NOT NULL,
    "receiverTriggerOid" BIGINT NOT NULL,
    "requestOid" BIGINT NOT NULL,
    "eventInputOid" BIGINT,
    "kind" "SlateTriggerWebhookReplayKind" NOT NULL,
    "status" "SlateTriggerWebhookReplayStatus" NOT NULL DEFAULT 'claimed',
    "specHash" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "itemBindingHash" TEXT NOT NULL,
    "deliveryIdHash" TEXT NOT NULL,
    "itemAdapterId" TEXT,
    "itemAdapterVersion" INTEGER,
    "originalRequestHash" TEXT NOT NULL,
    "dispatchRequestHash" TEXT NOT NULL,
    "callbackSecretIds" JSONB NOT NULL DEFAULT '[]',
    "syncResponse" JSONB,
    "syncResponseExpiresAt" TIMESTAMP(3),
    "leaseExpiresAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateTriggerWebhookReplayClaim_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateTriggerWebhookDispatchOutbox" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "receiverOid" BIGINT NOT NULL,
    "receiverTriggerOid" BIGINT NOT NULL,
    "replayClaimOid" BIGINT NOT NULL,
    "eventInputOid" BIGINT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "signalTenantId" TEXT,
    "adapterCandidateId" TEXT NOT NULL,
    "itemBindingHash" TEXT NOT NULL,
    "deliveryIdHashes" TEXT[],
    "itemAdapterId" TEXT,
    "itemAdapterVersion" INTEGER,
    "originalRequestHash" TEXT NOT NULL,
    "dispatchRequestHash" TEXT NOT NULL,
    "acceptedPayload" JSONB NOT NULL,
    "acceptedPayloadExpiresAt" TIMESTAMP(3) NOT NULL,
    "status" "SlateTriggerWebhookDispatchOutboxStatus" NOT NULL DEFAULT 'pending',
    "leaseOwner" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readyAt" TIMESTAMP(3),
    "safeTerminalCode" TEXT,
    "deadLetterMetadata" JSONB,
    "signalIdempotencyKey" TEXT NOT NULL,
    "signalRequestFingerprint" TEXT,
    "signalRequest" JSONB,
    "confirmedSignalEventId" TEXT,
    "localEventId" TEXT NOT NULL,
    "localSourceId" TEXT NOT NULL,
    "deliveredAt" TIMESTAMP(3),
    "retentionExpiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateTriggerWebhookDispatchOutbox_pkey" PRIMARY KEY ("oid")
);

-- CreateIndex
CREATE UNIQUE INDEX "SlateScopedInvocationGrant_id_key" ON "SlateScopedInvocationGrant"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SlateScopedInvocationGrant_tokenHash_key" ON "SlateScopedInvocationGrant"("tokenHash");

-- CreateIndex
CREATE INDEX "SlateScopedInvocationGrant_status_expiresAt_idx" ON "SlateScopedInvocationGrant"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "hub_provisioned_route_id_key" ON "SlateProvisionedAppRouteProjection"("id");

-- CreateIndex
CREATE UNIQUE INDEX "hub_provisioned_route_authority_key" ON "SlateProvisionedAppRouteProjection"("provisionedRouteId");

-- CreateIndex
CREATE UNIQUE INDEX "hub_provisioned_route_selector_key" ON "SlateProvisionedAppRouteProjection"("routeIdentifier");

-- CreateIndex
CREATE INDEX "hub_provisioned_route_status_idx" ON "SlateProvisionedAppRouteProjection"("vendor", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "hub_provisioned_route_tombstone_idx" ON "SlateProvisionedAppRouteProjection"("status", "tombstoneRetainUntil");

-- CreateIndex
CREATE UNIQUE INDEX "hub_provisioned_binding_id_key" ON "SlateProvisionedTenantAppProjection"("id");

-- CreateIndex
CREATE UNIQUE INDEX "hub_provisioned_binding_authority_key" ON "SlateProvisionedTenantAppProjection"("provisionedTenantAppId");

-- CreateIndex
CREATE UNIQUE INDEX "hub_provisioned_binding_external_owner_key" ON "SlateProvisionedTenantAppProjection"("externalOwnershipKey");

-- CreateIndex
CREATE INDEX "hub_provisioned_binding_route_status_idx" ON "SlateProvisionedTenantAppProjection"("routeProjectionOid", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "hub_provisioned_binding_receiver_idx" ON "SlateProvisionedTenantAppProjection"("tenantOid", "receiverOid", "receiverTriggerOid");

-- CreateIndex
CREATE INDEX "hub_provisioned_binding_tombstone_idx" ON "SlateProvisionedTenantAppProjection"("status", "tombstoneRetainUntil");

-- CreateIndex
CREATE INDEX "hub_provisioned_binding_retained_owner_idx" ON "SlateProvisionedTenantAppProjection"("routeProjectionOid", "retainedExternalOwnershipKey");

-- CreateIndex
CREATE UNIQUE INDEX "hub_provisioned_binding_route_owner_key" ON "SlateProvisionedTenantAppProjection"("routeIdentifier", "externalOwnershipKey");

-- CreateIndex
CREATE UNIQUE INDEX "hub_trigger_registration_outbox_id_key" ON "SlateTriggerRegistrationOutbox"("id");

-- CreateIndex
CREATE INDEX "hub_trigger_registration_outbox_pending_idx" ON "SlateTriggerRegistrationOutbox"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "hub_trigger_registration_outbox_intent_key" ON "SlateTriggerRegistrationOutbox"("receiverTriggerOid", "operation", "registrationGeneration");

-- CreateIndex
CREATE UNIQUE INDEX "hub_receiver_path_secret_id_key" ON "SlateTriggerReceiverPathSecret"("id");

-- CreateIndex
CREATE UNIQUE INDEX "hub_receiver_path_secret_receiver_key" ON "SlateTriggerReceiverPathSecret"("receiverOid");

-- CreateIndex
CREATE UNIQUE INDEX "hub_receiver_path_secret_secret_key" ON "SlateTriggerReceiverPathSecret"("secretOid");

-- CreateIndex
CREATE INDEX "hub_receiver_path_secret_owner_idx" ON "SlateTriggerReceiverPathSecret"("tenantOid", "slateInstanceOid", "receiverOid");

-- CreateIndex
CREATE UNIQUE INDEX "hub_trigger_secret_id_key" ON "SlateTriggerReceiverSecret"("id");

-- CreateIndex
CREATE UNIQUE INDEX "hub_trigger_secret_secret_key" ON "SlateTriggerReceiverSecret"("secretOid");

-- CreateIndex
CREATE INDEX "hub_trigger_secret_owner_idx" ON "SlateTriggerReceiverSecret"("tenantOid", "slateInstanceOid", "receiverOid");

-- CreateIndex
CREATE INDEX "hub_trigger_secret_validity_idx" ON "SlateTriggerReceiverSecret"("receiverTriggerOid", "businessValidUntil");

-- CreateIndex
CREATE UNIQUE INDEX "hub_trigger_secret_owner_name_key" ON "SlateTriggerReceiverSecret"("receiverTriggerOid", "name");

-- CreateIndex
CREATE UNIQUE INDEX "hub_webhook_replay_claim_id_key" ON "SlateTriggerWebhookReplayClaim"("id");

-- CreateIndex
CREATE UNIQUE INDEX "hub_webhook_replay_claim_event_input_key" ON "SlateTriggerWebhookReplayClaim"("eventInputOid");

-- CreateIndex
CREATE INDEX "hub_webhook_replay_claim_receiver_status_idx" ON "SlateTriggerWebhookReplayClaim"("receiverOid", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "hub_webhook_replay_claim_retention_idx" ON "SlateTriggerWebhookReplayClaim"("status", "leaseExpiresAt", "expiresAt");

-- CreateIndex
CREATE INDEX "SlateTriggerWebhookReplayClaim_syncResponseExpiresAt_idx" ON "SlateTriggerWebhookReplayClaim"("syncResponseExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "hub_webhook_replay_claim_identity_key" ON "SlateTriggerWebhookReplayClaim"("receiverTriggerOid", "specHash", "ruleId", "itemBindingHash", "deliveryIdHash");

-- CreateIndex
CREATE UNIQUE INDEX "hub_webhook_dispatch_outbox_id_key" ON "SlateTriggerWebhookDispatchOutbox"("id");

-- CreateIndex
CREATE UNIQUE INDEX "hub_webhook_dispatch_outbox_replay_claim_key" ON "SlateTriggerWebhookDispatchOutbox"("replayClaimOid");

-- CreateIndex
CREATE UNIQUE INDEX "hub_webhook_dispatch_outbox_event_input_key" ON "SlateTriggerWebhookDispatchOutbox"("eventInputOid");

-- CreateIndex
CREATE UNIQUE INDEX "hub_webhook_dispatch_signal_key" ON "SlateTriggerWebhookDispatchOutbox"("signalIdempotencyKey");

-- CreateIndex
CREATE INDEX "hub_webhook_dispatch_due_idx" ON "SlateTriggerWebhookDispatchOutbox"("status", "nextAttemptAt", "leaseExpiresAt");

-- CreateIndex
CREATE INDEX "hub_webhook_dispatch_tenant_signal_idx" ON "SlateTriggerWebhookDispatchOutbox"("tenantId", "signalIdempotencyKey");

-- CreateIndex
CREATE INDEX "hub_webhook_dispatch_retention_idx" ON "SlateTriggerWebhookDispatchOutbox"("retentionExpiresAt", "status", "leaseExpiresAt");

-- CreateIndex
CREATE INDEX "SlateTriggerWebhookDispatchOutbox_acceptedPayloadExpiresAt_idx" ON "SlateTriggerWebhookDispatchOutbox"("acceptedPayloadExpiresAt");

-- CreateIndex
CREATE INDEX "SlateTriggerReceiver_tombstonedAt_idx" ON "SlateTriggerReceiver"("tombstonedAt");

-- CreateIndex
CREATE INDEX "hub_telegram_webhook_lease_idx" ON "SlateTriggerReceiver"("telegramWebhookLeaseExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "SlateTriggerReceiverTrigger_registrationDetailsSecretOid_key" ON "SlateTriggerReceiverTrigger"("registrationDetailsSecretOid");

-- CreateIndex
CREATE INDEX "hub_telegram_detach_mutation_idx" ON "SlateTriggerReceiverTrigger"("telegramDetachMutationId", "telegramDetachGeneration");

-- CreateIndex
CREATE INDEX "hub_trigger_registration_repair_idx" ON "SlateTriggerReceiverTrigger"("registrationStatus", "registrationEnqueueDeadlineAt", "registrationLeaseExpiresAt");

-- CreateIndex
CREATE INDEX "hub_trigger_tombstone_cleanup_idx" ON "SlateTriggerReceiverTrigger"("tombstonedAt", "registrationStatus");

-- CreateIndex
CREATE INDEX "SlateTriggerWebhookRequest_outcome_createdAt_idx" ON "SlateTriggerWebhookRequest"("outcome", "createdAt");

-- CreateIndex
CREATE INDEX "SlateTriggerWebhookRequest_capturedRequestExpiresAt_idx" ON "SlateTriggerWebhookRequest"("capturedRequestExpiresAt");

-- AddForeignKey
ALTER TABLE "SlateTriggerReceiverTrigger" ADD CONSTRAINT "SlateTriggerReceiverTrigger_registrationDetailsSecretOid_fkey" FOREIGN KEY ("registrationDetailsSecretOid") REFERENCES "Secret"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateProvisionedAppRouteProjection" ADD CONSTRAINT "hub_provisioned_route_oauth_credentials_fk" FOREIGN KEY ("oauthCredentialsOid") REFERENCES "SlateOAuthCredentials"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateProvisionedAppRouteProjection" ADD CONSTRAINT "hub_provisioned_route_auth_config_fk" FOREIGN KEY ("authConfigOid") REFERENCES "SlateAuthConfig"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateProvisionedTenantAppProjection" ADD CONSTRAINT "hub_provisioned_binding_route_fk" FOREIGN KEY ("routeProjectionOid") REFERENCES "SlateProvisionedAppRouteProjection"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateProvisionedTenantAppProjection" ADD CONSTRAINT "hub_provisioned_binding_tenant_fk" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateProvisionedTenantAppProjection" ADD CONSTRAINT "hub_provisioned_binding_receiver_fk" FOREIGN KEY ("receiverOid") REFERENCES "SlateTriggerReceiver"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateProvisionedTenantAppProjection" ADD CONSTRAINT "hub_provisioned_binding_trigger_fk" FOREIGN KEY ("receiverTriggerOid") REFERENCES "SlateTriggerReceiverTrigger"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateProvisionedTenantAppProjection" ADD CONSTRAINT "hub_provisioned_binding_auth_config_fk" FOREIGN KEY ("authConfigOid") REFERENCES "SlateAuthConfig"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateTriggerRegistrationOutbox" ADD CONSTRAINT "hub_trigger_registration_outbox_trigger_fk" FOREIGN KEY ("receiverTriggerOid") REFERENCES "SlateTriggerReceiverTrigger"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateTriggerReceiverPathSecret" ADD CONSTRAINT "hub_receiver_path_secret_tenant_fk" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateTriggerReceiverPathSecret" ADD CONSTRAINT "hub_receiver_path_secret_instance_fk" FOREIGN KEY ("slateInstanceOid") REFERENCES "SlateInstance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateTriggerReceiverPathSecret" ADD CONSTRAINT "hub_receiver_path_secret_receiver_fk" FOREIGN KEY ("receiverOid") REFERENCES "SlateTriggerReceiver"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateTriggerReceiverPathSecret" ADD CONSTRAINT "hub_receiver_path_secret_secret_fk" FOREIGN KEY ("secretOid") REFERENCES "Secret"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateTriggerReceiverSecret" ADD CONSTRAINT "hub_trigger_secret_tenant_fk" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateTriggerReceiverSecret" ADD CONSTRAINT "hub_trigger_secret_instance_fk" FOREIGN KEY ("slateInstanceOid") REFERENCES "SlateInstance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateTriggerReceiverSecret" ADD CONSTRAINT "hub_trigger_secret_receiver_fk" FOREIGN KEY ("receiverOid") REFERENCES "SlateTriggerReceiver"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateTriggerReceiverSecret" ADD CONSTRAINT "hub_trigger_secret_trigger_fk" FOREIGN KEY ("receiverTriggerOid") REFERENCES "SlateTriggerReceiverTrigger"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateTriggerReceiverSecret" ADD CONSTRAINT "hub_trigger_secret_secret_fk" FOREIGN KEY ("secretOid") REFERENCES "Secret"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateTriggerWebhookReplayClaim" ADD CONSTRAINT "hub_webhook_replay_claim_receiver_fk" FOREIGN KEY ("receiverOid") REFERENCES "SlateTriggerReceiver"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateTriggerWebhookReplayClaim" ADD CONSTRAINT "hub_webhook_replay_claim_trigger_fk" FOREIGN KEY ("receiverTriggerOid") REFERENCES "SlateTriggerReceiverTrigger"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateTriggerWebhookReplayClaim" ADD CONSTRAINT "hub_webhook_replay_claim_request_fk" FOREIGN KEY ("requestOid") REFERENCES "SlateTriggerWebhookRequest"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateTriggerWebhookReplayClaim" ADD CONSTRAINT "hub_webhook_replay_claim_event_input_fk" FOREIGN KEY ("eventInputOid") REFERENCES "SlateTriggerEventInput"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateTriggerWebhookDispatchOutbox" ADD CONSTRAINT "hub_webhook_dispatch_outbox_receiver_fk" FOREIGN KEY ("receiverOid") REFERENCES "SlateTriggerReceiver"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateTriggerWebhookDispatchOutbox" ADD CONSTRAINT "hub_webhook_dispatch_outbox_trigger_fk" FOREIGN KEY ("receiverTriggerOid") REFERENCES "SlateTriggerReceiverTrigger"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateTriggerWebhookDispatchOutbox" ADD CONSTRAINT "hub_webhook_dispatch_outbox_replay_claim_fk" FOREIGN KEY ("replayClaimOid") REFERENCES "SlateTriggerWebhookReplayClaim"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateTriggerWebhookDispatchOutbox" ADD CONSTRAINT "hub_webhook_dispatch_outbox_event_input_fk" FOREIGN KEY ("eventInputOid") REFERENCES "SlateTriggerEventInput"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;
