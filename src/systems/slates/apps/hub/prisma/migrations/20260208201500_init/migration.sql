-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ChangeNotificationType" AS ENUM ('slate_version_created');

-- CreateEnum
CREATE TYPE "SlateInstanceEventType" AS ENUM ('slate_instance_created', 'slate_config_set', 'slate_auth_config_set_default', 'slate_auth_credentials_updated', 'slate_version_locked', 'slate_version_changed');

-- CreateEnum
CREATE TYPE "SlateAuthConfigType" AS ENUM ('manual', 'oauth_automated', 'oauth_manual');

-- CreateEnum
CREATE TYPE "SlateAuthConfigEventType" AS ENUM ('oauth_token_refresh_completed', 'oauth_token_refresh_failed');

-- CreateEnum
CREATE TYPE "SlateInstanceOAuthSetupStatus" AS ENUM ('unused', 'opened', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "SlateInstanceOAuthSetupEventType" AS ENUM ('setup_link_opened', 'get_authorization_url', 'exchange_authorization_code', 'access_token_received', 'oauth_setup_completed', 'oauth_setup_failed');

-- CreateEnum
CREATE TYPE "RegistryStatus" AS ENUM ('active', 'disabled');

-- CreateEnum
CREATE TYPE "SecretStatus" AS ENUM ('active', 'deleted');

-- CreateEnum
CREATE TYPE "SecretType" AS ENUM ('slate_authentication_configuration', 'slate_oauth_credentials', 'slate_oauth_setup');

-- CreateEnum
CREATE TYPE "SlateStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "SlateVersionStatus" AS ENUM ('active', 'unavailable', 'pending', 'deploying', 'discovering', 'deployment_failed', 'discovery_failed');

-- CreateEnum
CREATE TYPE "SlateAuthMethodType" AS ENUM ('oauth', 'token', 'service_account', 'custom');

-- CreateEnum
CREATE TYPE "SlateActionType" AS ENUM ('tool', 'trigger');

-- CreateEnum
CREATE TYPE "SlateVersionDiscoveryStatus" AS ENUM ('succeeded', 'failed');

-- CreateEnum
CREATE TYPE "SlateSpecificationChangeType" AS ENUM ('between_versions', 'same_version');

-- CreateEnum
CREATE TYPE "SlateEventType" AS ENUM ('version_pulled', 'version_set_as_current', 'deployment_started', 'deployment_succeeded', 'deployment_failed', 'discovery_started', 'discovery_succeeded', 'discovery_failed');

-- CreateEnum
CREATE TYPE "SlateDeploymentStatus" AS ENUM ('pending', 'running', 'succeeded', 'failed');

-- CreateEnum
CREATE TYPE "SlateSessionToolCallStatus" AS ENUM ('succeeded', 'failed');

-- CreateEnum
CREATE TYPE "SlateTriggerDestinationType" AS ENUM ('http_endpoint');

-- CreateEnum
CREATE TYPE "SlateTriggerDestinationStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "SlateTriggerReceiverStatus" AS ENUM ('active', 'paused');

-- CreateEnum
CREATE TYPE "SlateTriggerReceiverTriggerSource" AS ENUM ('polling', 'webhook');

-- CreateEnum
CREATE TYPE "SlateTriggerInvocationType" AS ENUM ('poll', 'webhook_handle', 'map_event', 'webhook_register', 'webhook_unregister');

-- CreateEnum
CREATE TYPE "SlateTriggerEventDeliveryStatus" AS ENUM ('pending', 'sent', 'failed', 'skipped');

-- CreateEnum
CREATE TYPE "SlateTriggerEventInputStatus" AS ENUM ('pending', 'processing', 'succeeded', 'failed', 'retrying', 'skipped');

-- CreateTable
CREATE TABLE "ChangeNotification" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "ChangeNotificationType" NOT NULL,
    "slateId" TEXT NOT NULL,
    "slateVersionId" TEXT,
    "slateOid" BIGINT NOT NULL,
    "slateVersionOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChangeNotification_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Hub" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "internalIdentifier" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Hub_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateInstance" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "slateOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "lockedSlateVersionOid" BIGINT,
    "currentConfigOid" BIGINT,
    "defaultAuthConfigOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateInstance_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateInstanceEvent" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "SlateInstanceEventType" NOT NULL,
    "payload" JSONB NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateInstanceEvent_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateInstanceConfig" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "schemaOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateInstanceConfig_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateOAuthCredentials" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "slateOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "clientId" TEXT NOT NULL,
    "scopes" TEXT[],
    "secretOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateOAuthCredentials_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateAuthConfig" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "SlateAuthConfigType" NOT NULL,
    "isProcessing" BOOLEAN NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "profile" JSONB,
    "profileUid" TEXT,
    "profileEmail" TEXT,
    "profileName" TEXT,
    "instanceOid" BIGINT,
    "slateOid" BIGINT NOT NULL,
    "authMethodOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "oauthCredentialsOid" BIGINT,
    "secretOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateAuthConfig_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateAuthConfigManualDecrypt" (
    "oid" BIGINT NOT NULL,
    "configOid" BIGINT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateAuthConfigManualDecrypt_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateAuthConfigUsedForInstance" (
    "oid" BIGINT NOT NULL,
    "configOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateAuthConfigUsedForInstance_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateAuthConfigEvent" (
    "oid" BIGINT NOT NULL,
    "type" "SlateAuthConfigEventType" NOT NULL,
    "configOid" BIGINT NOT NULL,
    "invocationOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateAuthConfigEvent_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateInstanceOAuthSetup" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SlateInstanceOAuthSetupStatus" NOT NULL DEFAULT 'unused',
    "redirectUrl" TEXT NOT NULL,
    "callbackUrlOverride" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "oauthCredentialsOid" BIGINT NOT NULL,
    "authMethodOid" BIGINT NOT NULL,
    "slateOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "slateVersionOid" BIGINT NOT NULL,
    "slateInstanceOid" BIGINT,
    "slateAuthConfigOid" BIGINT,
    "secretOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateInstanceOAuthSetup_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateInstanceOAuthSetupEvent" (
    "oid" BIGINT NOT NULL,
    "type" "SlateInstanceOAuthSetupEventType" NOT NULL,
    "setupOid" BIGINT NOT NULL,
    "invocationOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateInstanceOAuthSetupEvent_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateInvocationStorageBucket" (
    "oid" INTEGER NOT NULL,
    "bucket" TEXT NOT NULL,

    CONSTRAINT "SlateInvocationStorageBucket_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateInvocation" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "isPending" BOOLEAN NOT NULL,
    "hasResponseError" BOOLEAN NOT NULL DEFAULT false,
    "hasInvocationError" BOOLEAN NOT NULL DEFAULT false,
    "providerInvocationId" TEXT NOT NULL,
    "deploymentOid" BIGINT NOT NULL,
    "bucketOid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateInvocation_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Registry" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "RegistryStatus" NOT NULL,
    "isPredefined" BOOLEAN NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "encryptedReaderToken" TEXT,
    "changeNotificationCursor" TEXT,
    "tenantOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncedAt" TIMESTAMP(3),

    CONSTRAINT "Registry_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "RegistrySync" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "registryOid" BIGINT NOT NULL,
    "slatesSyncedIds" TEXT[],
    "slateVersionsSyncedIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistrySync_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Secret" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "SecretType" NOT NULL,
    "status" "SecretStatus" NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "encryptedSecret" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Secret_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Slate" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SlateStatus" NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "registryOid" BIGINT NOT NULL,
    "currentVersionOid" BIGINT,
    "slateScopeIdentifierOnRegistry" TEXT NOT NULL,
    "slateScopeIdOnRegistry" TEXT NOT NULL,
    "slateFullIdentifierOnRegistry" TEXT NOT NULL,
    "slateIdentifierOnRegistry" TEXT NOT NULL,
    "slateIdOnRegistry" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Slate_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateVersion" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SlateVersionStatus" NOT NULL,
    "isCurrent" BOOLEAN NOT NULL,
    "willBeCurrent" BOOLEAN NOT NULL,
    "version" TEXT NOT NULL,
    "versionIdOnRegistry" TEXT NOT NULL,
    "versionIdentifierOnRegistry" TEXT NOT NULL,
    "manifest" JSONB NOT NULL,
    "providerDeploymentInfo" JSONB NOT NULL DEFAULT 'null',
    "slateOid" BIGINT NOT NULL,
    "registryOid" BIGINT NOT NULL,
    "activeDeploymentOid" BIGINT,
    "specificationOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastDiscoveredAt" TIMESTAMP(3),

    CONSTRAINT "SlateVersion_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateAuthMethod" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "SlateAuthMethodType" NOT NULL,
    "identifier" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "spec" JSONB NOT NULL,
    "slateOid" BIGINT NOT NULL,
    "mostRecentSpecificationOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateAuthMethod_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateSpecificationAuthMethod" (
    "oid" BIGINT NOT NULL,
    "specificationOid" BIGINT NOT NULL,
    "authMethodOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateSpecificationAuthMethod_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateConfigSchema" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "schema" JSONB NOT NULL,
    "slateOid" BIGINT NOT NULL,
    "mostRecentSpecificationOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateConfigSchema_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateSpecificationConfigSchema" (
    "oid" BIGINT NOT NULL,
    "specificationOid" BIGINT NOT NULL,
    "configSchemaOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateSpecificationConfigSchema_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateAction" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "SlateActionType" NOT NULL,
    "identifier" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "spec" JSONB NOT NULL,
    "slateOid" BIGINT NOT NULL,
    "mostRecentSpecificationOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateAction_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateSpecificationAction" (
    "oid" BIGINT NOT NULL,
    "specificationOid" BIGINT NOT NULL,
    "actionOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateSpecificationAction_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateSpecification" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "protocolVersion" TEXT NOT NULL,
    "providerInfo" JSONB NOT NULL,
    "configSchema" JSONB NOT NULL,
    "authMethods" JSONB NOT NULL,
    "actions" JSONB NOT NULL,
    "slateOid" BIGINT NOT NULL,
    "mostRecentVersionOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateSpecification_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateVersionDiscovery" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SlateVersionDiscoveryStatus" NOT NULL,
    "errorMessage" TEXT,
    "errorCode" TEXT,
    "slateVersionOid" BIGINT NOT NULL,
    "specificationOid" BIGINT,
    "invocationOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateVersionDiscovery_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateSpecificationChange" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "SlateSpecificationChangeType" NOT NULL,
    "slateOid" BIGINT NOT NULL,
    "fromVersionOid" BIGINT NOT NULL,
    "toVersionOid" BIGINT NOT NULL,
    "fromSpecificationOid" BIGINT NOT NULL,
    "toSpecificationOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateSpecificationChange_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateEvent" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "SlateEventType" NOT NULL,
    "message" TEXT NOT NULL,
    "slateOid" BIGINT NOT NULL,
    "slateVersionOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateEvent_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "DeploymentProvider" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeploymentProvider_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateDeployment" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SlateDeploymentStatus" NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "slateVersionOid" BIGINT NOT NULL,
    "slateOid" BIGINT NOT NULL,
    "providerOid" BIGINT NOT NULL,
    "providerDeploymentInfo" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateDeployment_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Tenant" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "signalTenantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateSession" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "slateOid" BIGINT NOT NULL,
    "slateInstanceOid" BIGINT NOT NULL,
    "slateVersionOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3),

    CONSTRAINT "SlateSession_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateSessionToolCall" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SlateSessionToolCallStatus" NOT NULL,
    "actionOid" BIGINT NOT NULL,
    "invocationOid" BIGINT NOT NULL,
    "sessionOid" BIGINT NOT NULL,
    "slateVersionOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateSessionToolCall_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateTriggerDestination" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "SlateTriggerDestinationType" NOT NULL,
    "status" "SlateTriggerDestinationStatus" NOT NULL DEFAULT 'active',
    "url" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "eventTypes" TEXT[],
    "signalDestinationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateTriggerDestination_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateTriggerReceiver" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "slateOid" BIGINT NOT NULL,
    "slateInstanceOid" BIGINT NOT NULL,
    "authConfigOid" BIGINT,
    "status" "SlateTriggerReceiverStatus" NOT NULL DEFAULT 'active',
    "name" TEXT,
    "description" TEXT,
    "eventTypes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateTriggerReceiver_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateTriggerReceiverDestination" (
    "oid" BIGINT NOT NULL,
    "receiverOid" BIGINT NOT NULL,
    "destinationOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateTriggerReceiverDestination_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateTriggerReceiverTrigger" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "receiverOid" BIGINT NOT NULL,
    "actionOid" BIGINT NOT NULL,
    "source" "SlateTriggerReceiverTriggerSource" NOT NULL,
    "pollIntervalSeconds" INTEGER,
    "lastPolledAt" TIMESTAMP(3),
    "nextPollAt" TIMESTAMP(3),
    "state" JSONB NOT NULL DEFAULT 'null',
    "registrationDetails" JSONB NOT NULL DEFAULT 'null',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateTriggerReceiverTrigger_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateTriggerInvocation" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "SlateTriggerInvocationType" NOT NULL,
    "receiverOid" BIGINT NOT NULL,
    "receiverTriggerOid" BIGINT,
    "eventOid" BIGINT,
    "invocationOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateTriggerInvocation_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateTriggerEventInput" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "receiverOid" BIGINT NOT NULL,
    "receiverTriggerOid" BIGINT NOT NULL,
    "actionOid" BIGINT NOT NULL,
    "slateOid" BIGINT NOT NULL,
    "slateInstanceOid" BIGINT NOT NULL,
    "status" "SlateTriggerEventInputStatus" NOT NULL DEFAULT 'pending',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "input" JSONB DEFAULT 'null',
    "payloadStorageKey" TEXT,
    "payloadStoredAt" TIMESTAMP(3),
    "eventOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateTriggerEventInput_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateTriggerEvent" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "receiverOid" BIGINT NOT NULL,
    "receiverTriggerOid" BIGINT NOT NULL,
    "actionOid" BIGINT NOT NULL,
    "slateOid" BIGINT NOT NULL,
    "slateInstanceOid" BIGINT NOT NULL,
    "type" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "output" JSONB NOT NULL,
    "deliveryStatus" "SlateTriggerEventDeliveryStatus" NOT NULL DEFAULT 'pending',
    "signalEventId" TEXT NOT NULL,
    "invocationOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateTriggerEvent_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateTriggerDelivery" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "eventOid" BIGINT NOT NULL,
    "destinationOid" BIGINT NOT NULL,
    "signalEventId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateTriggerDelivery_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateTriggerWebhookRequest" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "receiverTriggerId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "headers" JSONB NOT NULL,
    "body" JSONB DEFAULT 'null',
    "bodyStorageKey" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateTriggerWebhookRequest_pkey" PRIMARY KEY ("oid")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChangeNotification_id_key" ON "ChangeNotification"("id");

-- CreateIndex
CREATE INDEX "ChangeNotification_type_idx" ON "ChangeNotification"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Hub_id_key" ON "Hub"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Hub_internalIdentifier_key" ON "Hub"("internalIdentifier");

-- CreateIndex
CREATE UNIQUE INDEX "Hub_identifier_key" ON "Hub"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "SlateInstance_id_key" ON "SlateInstance"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SlateInstanceEvent_id_key" ON "SlateInstanceEvent"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SlateInstanceConfig_id_key" ON "SlateInstanceConfig"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SlateOAuthCredentials_id_key" ON "SlateOAuthCredentials"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SlateAuthConfig_id_key" ON "SlateAuthConfig"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SlateAuthConfigUsedForInstance_configOid_instanceOid_key" ON "SlateAuthConfigUsedForInstance"("configOid", "instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "SlateInstanceOAuthSetup_id_key" ON "SlateInstanceOAuthSetup"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SlateInvocationStorageBucket_bucket_key" ON "SlateInvocationStorageBucket"("bucket");

-- CreateIndex
CREATE UNIQUE INDEX "SlateInvocation_id_key" ON "SlateInvocation"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Registry_id_key" ON "Registry"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Registry_identifier_key" ON "Registry"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "Registry_tenantOid_url_key" ON "Registry"("tenantOid", "url");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrySync_id_key" ON "RegistrySync"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Secret_id_key" ON "Secret"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Slate_id_key" ON "Slate"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Slate_identifier_key" ON "Slate"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "Slate_registryOid_slateIdOnRegistry_key" ON "Slate"("registryOid", "slateIdOnRegistry");

-- CreateIndex
CREATE UNIQUE INDEX "Slate_registryOid_slateFullIdentifierOnRegistry_key" ON "Slate"("registryOid", "slateFullIdentifierOnRegistry");

-- CreateIndex
CREATE UNIQUE INDEX "SlateVersion_id_key" ON "SlateVersion"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SlateVersion_slateOid_version_key" ON "SlateVersion"("slateOid", "version");

-- CreateIndex
CREATE UNIQUE INDEX "SlateAuthMethod_id_key" ON "SlateAuthMethod"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SlateAuthMethod_identifier_key" ON "SlateAuthMethod"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "SlateSpecificationAuthMethod_specificationOid_authMethodOid_key" ON "SlateSpecificationAuthMethod"("specificationOid", "authMethodOid");

-- CreateIndex
CREATE UNIQUE INDEX "SlateConfigSchema_id_key" ON "SlateConfigSchema"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SlateConfigSchema_identifier_key" ON "SlateConfigSchema"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "SlateSpecificationConfigSchema_specificationOid_configSchem_key" ON "SlateSpecificationConfigSchema"("specificationOid", "configSchemaOid");

-- CreateIndex
CREATE UNIQUE INDEX "SlateAction_id_key" ON "SlateAction"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SlateAction_identifier_key" ON "SlateAction"("identifier");

-- CreateIndex
CREATE INDEX "SlateAction_key_idx" ON "SlateAction"("key");

-- CreateIndex
CREATE UNIQUE INDEX "SlateSpecificationAction_specificationOid_actionOid_key" ON "SlateSpecificationAction"("specificationOid", "actionOid");

-- CreateIndex
CREATE UNIQUE INDEX "SlateSpecification_id_key" ON "SlateSpecification"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SlateSpecification_identifier_key" ON "SlateSpecification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "SlateVersionDiscovery_id_key" ON "SlateVersionDiscovery"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SlateSpecificationChange_id_key" ON "SlateSpecificationChange"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SlateEvent_id_key" ON "SlateEvent"("id");

-- CreateIndex
CREATE UNIQUE INDEX "DeploymentProvider_id_key" ON "DeploymentProvider"("id");

-- CreateIndex
CREATE UNIQUE INDEX "DeploymentProvider_identifier_key" ON "DeploymentProvider"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "SlateDeployment_id_key" ON "SlateDeployment"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SlateDeployment_slateVersionOid_key" ON "SlateDeployment"("slateVersionOid");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_id_key" ON "Tenant"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_identifier_key" ON "Tenant"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_signalTenantId_key" ON "Tenant"("signalTenantId");

-- CreateIndex
CREATE UNIQUE INDEX "SlateSession_id_key" ON "SlateSession"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SlateSessionToolCall_id_key" ON "SlateSessionToolCall"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SlateTriggerDestination_id_key" ON "SlateTriggerDestination"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SlateTriggerDestination_signalDestinationId_key" ON "SlateTriggerDestination"("signalDestinationId");

-- CreateIndex
CREATE INDEX "SlateTriggerDestination_tenantOid_status_idx" ON "SlateTriggerDestination"("tenantOid", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SlateTriggerReceiver_id_key" ON "SlateTriggerReceiver"("id");

-- CreateIndex
CREATE INDEX "SlateTriggerReceiver_tenantOid_slateInstanceOid_idx" ON "SlateTriggerReceiver"("tenantOid", "slateInstanceOid");

-- CreateIndex
CREATE INDEX "SlateTriggerReceiver_tenantOid_slateOid_idx" ON "SlateTriggerReceiver"("tenantOid", "slateOid");

-- CreateIndex
CREATE UNIQUE INDEX "SlateTriggerReceiverDestination_receiverOid_destinationOid_key" ON "SlateTriggerReceiverDestination"("receiverOid", "destinationOid");

-- CreateIndex
CREATE UNIQUE INDEX "SlateTriggerReceiverTrigger_id_key" ON "SlateTriggerReceiverTrigger"("id");

-- CreateIndex
CREATE INDEX "SlateTriggerReceiverTrigger_source_nextPollAt_idx" ON "SlateTriggerReceiverTrigger"("source", "nextPollAt");

-- CreateIndex
CREATE UNIQUE INDEX "SlateTriggerReceiverTrigger_receiverOid_actionOid_key" ON "SlateTriggerReceiverTrigger"("receiverOid", "actionOid");

-- CreateIndex
CREATE UNIQUE INDEX "SlateTriggerInvocation_id_key" ON "SlateTriggerInvocation"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SlateTriggerInvocation_invocationOid_key" ON "SlateTriggerInvocation"("invocationOid");

-- CreateIndex
CREATE UNIQUE INDEX "SlateTriggerEventInput_id_key" ON "SlateTriggerEventInput"("id");

-- CreateIndex
CREATE INDEX "SlateTriggerEventInput_status_idx" ON "SlateTriggerEventInput"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SlateTriggerEvent_id_key" ON "SlateTriggerEvent"("id");

-- CreateIndex
CREATE INDEX "SlateTriggerEvent_receiverOid_createdAt_idx" ON "SlateTriggerEvent"("receiverOid", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SlateTriggerEvent_receiverTriggerOid_sourceId_key" ON "SlateTriggerEvent"("receiverTriggerOid", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "SlateTriggerDelivery_id_key" ON "SlateTriggerDelivery"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SlateTriggerDelivery_eventOid_destinationOid_key" ON "SlateTriggerDelivery"("eventOid", "destinationOid");

-- CreateIndex
CREATE UNIQUE INDEX "SlateTriggerWebhookRequest_id_key" ON "SlateTriggerWebhookRequest"("id");

-- CreateIndex
CREATE INDEX "SlateTriggerWebhookRequest_receiverTriggerId_idx" ON "SlateTriggerWebhookRequest"("receiverTriggerId");

-- CreateIndex
CREATE INDEX "SlateTriggerWebhookRequest_processedAt_idx" ON "SlateTriggerWebhookRequest"("processedAt");

-- AddForeignKey
ALTER TABLE "ChangeNotification" ADD CONSTRAINT "ChangeNotification_slateOid_fkey" FOREIGN KEY ("slateOid") REFERENCES "Slate"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeNotification" ADD CONSTRAINT "ChangeNotification_slateVersionOid_fkey" FOREIGN KEY ("slateVersionOid") REFERENCES "SlateVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateInstance" ADD CONSTRAINT "SlateInstance_slateOid_fkey" FOREIGN KEY ("slateOid") REFERENCES "Slate"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateInstance" ADD CONSTRAINT "SlateInstance_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateInstance" ADD CONSTRAINT "SlateInstance_lockedSlateVersionOid_fkey" FOREIGN KEY ("lockedSlateVersionOid") REFERENCES "SlateVersion"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateInstance" ADD CONSTRAINT "SlateInstance_currentConfigOid_fkey" FOREIGN KEY ("currentConfigOid") REFERENCES "SlateInstanceConfig"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateInstance" ADD CONSTRAINT "SlateInstance_defaultAuthConfigOid_fkey" FOREIGN KEY ("defaultAuthConfigOid") REFERENCES "SlateAuthConfig"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateInstanceEvent" ADD CONSTRAINT "SlateInstanceEvent_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "SlateInstance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateInstanceEvent" ADD CONSTRAINT "SlateInstanceEvent_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateInstanceConfig" ADD CONSTRAINT "SlateInstanceConfig_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "SlateInstance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateInstanceConfig" ADD CONSTRAINT "SlateInstanceConfig_schemaOid_fkey" FOREIGN KEY ("schemaOid") REFERENCES "SlateConfigSchema"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateInstanceConfig" ADD CONSTRAINT "SlateInstanceConfig_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateOAuthCredentials" ADD CONSTRAINT "SlateOAuthCredentials_slateOid_fkey" FOREIGN KEY ("slateOid") REFERENCES "Slate"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateOAuthCredentials" ADD CONSTRAINT "SlateOAuthCredentials_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateOAuthCredentials" ADD CONSTRAINT "SlateOAuthCredentials_secretOid_fkey" FOREIGN KEY ("secretOid") REFERENCES "Secret"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateAuthConfig" ADD CONSTRAINT "SlateAuthConfig_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "SlateInstance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateAuthConfig" ADD CONSTRAINT "SlateAuthConfig_slateOid_fkey" FOREIGN KEY ("slateOid") REFERENCES "Slate"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateAuthConfig" ADD CONSTRAINT "SlateAuthConfig_authMethodOid_fkey" FOREIGN KEY ("authMethodOid") REFERENCES "SlateAuthMethod"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateAuthConfig" ADD CONSTRAINT "SlateAuthConfig_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateAuthConfig" ADD CONSTRAINT "SlateAuthConfig_oauthCredentialsOid_fkey" FOREIGN KEY ("oauthCredentialsOid") REFERENCES "SlateOAuthCredentials"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateAuthConfig" ADD CONSTRAINT "SlateAuthConfig_secretOid_fkey" FOREIGN KEY ("secretOid") REFERENCES "Secret"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateAuthConfigManualDecrypt" ADD CONSTRAINT "SlateAuthConfigManualDecrypt_configOid_fkey" FOREIGN KEY ("configOid") REFERENCES "SlateAuthConfig"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateAuthConfigUsedForInstance" ADD CONSTRAINT "SlateAuthConfigUsedForInstance_configOid_fkey" FOREIGN KEY ("configOid") REFERENCES "SlateAuthConfig"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateAuthConfigUsedForInstance" ADD CONSTRAINT "SlateAuthConfigUsedForInstance_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "SlateInstance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateAuthConfigEvent" ADD CONSTRAINT "SlateAuthConfigEvent_configOid_fkey" FOREIGN KEY ("configOid") REFERENCES "SlateAuthConfig"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateAuthConfigEvent" ADD CONSTRAINT "SlateAuthConfigEvent_invocationOid_fkey" FOREIGN KEY ("invocationOid") REFERENCES "SlateInvocation"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateInstanceOAuthSetup" ADD CONSTRAINT "SlateInstanceOAuthSetup_oauthCredentialsOid_fkey" FOREIGN KEY ("oauthCredentialsOid") REFERENCES "SlateOAuthCredentials"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateInstanceOAuthSetup" ADD CONSTRAINT "SlateInstanceOAuthSetup_authMethodOid_fkey" FOREIGN KEY ("authMethodOid") REFERENCES "SlateAuthMethod"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateInstanceOAuthSetup" ADD CONSTRAINT "SlateInstanceOAuthSetup_slateOid_fkey" FOREIGN KEY ("slateOid") REFERENCES "Slate"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateInstanceOAuthSetup" ADD CONSTRAINT "SlateInstanceOAuthSetup_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateInstanceOAuthSetup" ADD CONSTRAINT "SlateInstanceOAuthSetup_slateVersionOid_fkey" FOREIGN KEY ("slateVersionOid") REFERENCES "SlateVersion"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateInstanceOAuthSetup" ADD CONSTRAINT "SlateInstanceOAuthSetup_slateInstanceOid_fkey" FOREIGN KEY ("slateInstanceOid") REFERENCES "SlateInstance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateInstanceOAuthSetup" ADD CONSTRAINT "SlateInstanceOAuthSetup_slateAuthConfigOid_fkey" FOREIGN KEY ("slateAuthConfigOid") REFERENCES "SlateAuthConfig"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateInstanceOAuthSetup" ADD CONSTRAINT "SlateInstanceOAuthSetup_secretOid_fkey" FOREIGN KEY ("secretOid") REFERENCES "Secret"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateInstanceOAuthSetupEvent" ADD CONSTRAINT "SlateInstanceOAuthSetupEvent_setupOid_fkey" FOREIGN KEY ("setupOid") REFERENCES "SlateInstanceOAuthSetup"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateInstanceOAuthSetupEvent" ADD CONSTRAINT "SlateInstanceOAuthSetupEvent_invocationOid_fkey" FOREIGN KEY ("invocationOid") REFERENCES "SlateInvocation"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateInvocation" ADD CONSTRAINT "SlateInvocation_deploymentOid_fkey" FOREIGN KEY ("deploymentOid") REFERENCES "SlateDeployment"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateInvocation" ADD CONSTRAINT "SlateInvocation_bucketOid_fkey" FOREIGN KEY ("bucketOid") REFERENCES "SlateInvocationStorageBucket"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registry" ADD CONSTRAINT "Registry_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrySync" ADD CONSTRAINT "RegistrySync_registryOid_fkey" FOREIGN KEY ("registryOid") REFERENCES "Registry"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Secret" ADD CONSTRAINT "Secret_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Slate" ADD CONSTRAINT "Slate_registryOid_fkey" FOREIGN KEY ("registryOid") REFERENCES "Registry"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Slate" ADD CONSTRAINT "Slate_currentVersionOid_fkey" FOREIGN KEY ("currentVersionOid") REFERENCES "SlateVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateVersion" ADD CONSTRAINT "SlateVersion_slateOid_fkey" FOREIGN KEY ("slateOid") REFERENCES "Slate"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateVersion" ADD CONSTRAINT "SlateVersion_registryOid_fkey" FOREIGN KEY ("registryOid") REFERENCES "Registry"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateVersion" ADD CONSTRAINT "SlateVersion_activeDeploymentOid_fkey" FOREIGN KEY ("activeDeploymentOid") REFERENCES "SlateDeployment"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateVersion" ADD CONSTRAINT "SlateVersion_specificationOid_fkey" FOREIGN KEY ("specificationOid") REFERENCES "SlateSpecification"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateAuthMethod" ADD CONSTRAINT "SlateAuthMethod_slateOid_fkey" FOREIGN KEY ("slateOid") REFERENCES "Slate"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateAuthMethod" ADD CONSTRAINT "SlateAuthMethod_mostRecentSpecificationOid_fkey" FOREIGN KEY ("mostRecentSpecificationOid") REFERENCES "SlateSpecification"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateSpecificationAuthMethod" ADD CONSTRAINT "SlateSpecificationAuthMethod_specificationOid_fkey" FOREIGN KEY ("specificationOid") REFERENCES "SlateSpecification"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateSpecificationAuthMethod" ADD CONSTRAINT "SlateSpecificationAuthMethod_authMethodOid_fkey" FOREIGN KEY ("authMethodOid") REFERENCES "SlateAuthMethod"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateConfigSchema" ADD CONSTRAINT "SlateConfigSchema_slateOid_fkey" FOREIGN KEY ("slateOid") REFERENCES "Slate"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateConfigSchema" ADD CONSTRAINT "SlateConfigSchema_mostRecentSpecificationOid_fkey" FOREIGN KEY ("mostRecentSpecificationOid") REFERENCES "SlateSpecification"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateSpecificationConfigSchema" ADD CONSTRAINT "SlateSpecificationConfigSchema_specificationOid_fkey" FOREIGN KEY ("specificationOid") REFERENCES "SlateSpecification"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateSpecificationConfigSchema" ADD CONSTRAINT "SlateSpecificationConfigSchema_configSchemaOid_fkey" FOREIGN KEY ("configSchemaOid") REFERENCES "SlateConfigSchema"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateAction" ADD CONSTRAINT "SlateAction_slateOid_fkey" FOREIGN KEY ("slateOid") REFERENCES "Slate"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateAction" ADD CONSTRAINT "SlateAction_mostRecentSpecificationOid_fkey" FOREIGN KEY ("mostRecentSpecificationOid") REFERENCES "SlateSpecification"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateSpecificationAction" ADD CONSTRAINT "SlateSpecificationAction_specificationOid_fkey" FOREIGN KEY ("specificationOid") REFERENCES "SlateSpecification"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateSpecificationAction" ADD CONSTRAINT "SlateSpecificationAction_actionOid_fkey" FOREIGN KEY ("actionOid") REFERENCES "SlateAction"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateSpecification" ADD CONSTRAINT "SlateSpecification_slateOid_fkey" FOREIGN KEY ("slateOid") REFERENCES "Slate"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateSpecification" ADD CONSTRAINT "SlateSpecification_mostRecentVersionOid_fkey" FOREIGN KEY ("mostRecentVersionOid") REFERENCES "SlateVersion"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateVersionDiscovery" ADD CONSTRAINT "SlateVersionDiscovery_slateVersionOid_fkey" FOREIGN KEY ("slateVersionOid") REFERENCES "SlateVersion"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateVersionDiscovery" ADD CONSTRAINT "SlateVersionDiscovery_specificationOid_fkey" FOREIGN KEY ("specificationOid") REFERENCES "SlateSpecification"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateVersionDiscovery" ADD CONSTRAINT "SlateVersionDiscovery_invocationOid_fkey" FOREIGN KEY ("invocationOid") REFERENCES "SlateInvocation"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateSpecificationChange" ADD CONSTRAINT "SlateSpecificationChange_slateOid_fkey" FOREIGN KEY ("slateOid") REFERENCES "Slate"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateSpecificationChange" ADD CONSTRAINT "SlateSpecificationChange_fromVersionOid_fkey" FOREIGN KEY ("fromVersionOid") REFERENCES "SlateVersion"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateSpecificationChange" ADD CONSTRAINT "SlateSpecificationChange_toVersionOid_fkey" FOREIGN KEY ("toVersionOid") REFERENCES "SlateVersion"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateSpecificationChange" ADD CONSTRAINT "SlateSpecificationChange_fromSpecificationOid_fkey" FOREIGN KEY ("fromSpecificationOid") REFERENCES "SlateSpecification"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateSpecificationChange" ADD CONSTRAINT "SlateSpecificationChange_toSpecificationOid_fkey" FOREIGN KEY ("toSpecificationOid") REFERENCES "SlateSpecification"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateEvent" ADD CONSTRAINT "SlateEvent_slateOid_fkey" FOREIGN KEY ("slateOid") REFERENCES "Slate"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateEvent" ADD CONSTRAINT "SlateEvent_slateVersionOid_fkey" FOREIGN KEY ("slateVersionOid") REFERENCES "SlateVersion"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateDeployment" ADD CONSTRAINT "SlateDeployment_slateVersionOid_fkey" FOREIGN KEY ("slateVersionOid") REFERENCES "SlateVersion"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateDeployment" ADD CONSTRAINT "SlateDeployment_slateOid_fkey" FOREIGN KEY ("slateOid") REFERENCES "Slate"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateDeployment" ADD CONSTRAINT "SlateDeployment_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "DeploymentProvider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateSession" ADD CONSTRAINT "SlateSession_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateSession" ADD CONSTRAINT "SlateSession_slateOid_fkey" FOREIGN KEY ("slateOid") REFERENCES "Slate"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateSession" ADD CONSTRAINT "SlateSession_slateInstanceOid_fkey" FOREIGN KEY ("slateInstanceOid") REFERENCES "SlateInstance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateSession" ADD CONSTRAINT "SlateSession_slateVersionOid_fkey" FOREIGN KEY ("slateVersionOid") REFERENCES "SlateVersion"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateSessionToolCall" ADD CONSTRAINT "SlateSessionToolCall_actionOid_fkey" FOREIGN KEY ("actionOid") REFERENCES "SlateAction"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateSessionToolCall" ADD CONSTRAINT "SlateSessionToolCall_invocationOid_fkey" FOREIGN KEY ("invocationOid") REFERENCES "SlateInvocation"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateSessionToolCall" ADD CONSTRAINT "SlateSessionToolCall_sessionOid_fkey" FOREIGN KEY ("sessionOid") REFERENCES "SlateSession"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateSessionToolCall" ADD CONSTRAINT "SlateSessionToolCall_slateVersionOid_fkey" FOREIGN KEY ("slateVersionOid") REFERENCES "SlateVersion"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateTriggerDestination" ADD CONSTRAINT "SlateTriggerDestination_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateTriggerReceiver" ADD CONSTRAINT "SlateTriggerReceiver_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateTriggerReceiver" ADD CONSTRAINT "SlateTriggerReceiver_slateOid_fkey" FOREIGN KEY ("slateOid") REFERENCES "Slate"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateTriggerReceiver" ADD CONSTRAINT "SlateTriggerReceiver_slateInstanceOid_fkey" FOREIGN KEY ("slateInstanceOid") REFERENCES "SlateInstance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateTriggerReceiver" ADD CONSTRAINT "SlateTriggerReceiver_authConfigOid_fkey" FOREIGN KEY ("authConfigOid") REFERENCES "SlateAuthConfig"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateTriggerReceiverDestination" ADD CONSTRAINT "SlateTriggerReceiverDestination_receiverOid_fkey" FOREIGN KEY ("receiverOid") REFERENCES "SlateTriggerReceiver"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateTriggerReceiverDestination" ADD CONSTRAINT "SlateTriggerReceiverDestination_destinationOid_fkey" FOREIGN KEY ("destinationOid") REFERENCES "SlateTriggerDestination"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateTriggerReceiverTrigger" ADD CONSTRAINT "SlateTriggerReceiverTrigger_receiverOid_fkey" FOREIGN KEY ("receiverOid") REFERENCES "SlateTriggerReceiver"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateTriggerReceiverTrigger" ADD CONSTRAINT "SlateTriggerReceiverTrigger_actionOid_fkey" FOREIGN KEY ("actionOid") REFERENCES "SlateAction"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateTriggerInvocation" ADD CONSTRAINT "SlateTriggerInvocation_receiverOid_fkey" FOREIGN KEY ("receiverOid") REFERENCES "SlateTriggerReceiver"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateTriggerInvocation" ADD CONSTRAINT "SlateTriggerInvocation_receiverTriggerOid_fkey" FOREIGN KEY ("receiverTriggerOid") REFERENCES "SlateTriggerReceiverTrigger"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateTriggerInvocation" ADD CONSTRAINT "SlateTriggerInvocation_eventOid_fkey" FOREIGN KEY ("eventOid") REFERENCES "SlateTriggerEvent"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateTriggerInvocation" ADD CONSTRAINT "SlateTriggerInvocation_invocationOid_fkey" FOREIGN KEY ("invocationOid") REFERENCES "SlateInvocation"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateTriggerEventInput" ADD CONSTRAINT "SlateTriggerEventInput_receiverOid_fkey" FOREIGN KEY ("receiverOid") REFERENCES "SlateTriggerReceiver"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateTriggerEventInput" ADD CONSTRAINT "SlateTriggerEventInput_receiverTriggerOid_fkey" FOREIGN KEY ("receiverTriggerOid") REFERENCES "SlateTriggerReceiverTrigger"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateTriggerEventInput" ADD CONSTRAINT "SlateTriggerEventInput_actionOid_fkey" FOREIGN KEY ("actionOid") REFERENCES "SlateAction"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateTriggerEventInput" ADD CONSTRAINT "SlateTriggerEventInput_slateOid_fkey" FOREIGN KEY ("slateOid") REFERENCES "Slate"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateTriggerEventInput" ADD CONSTRAINT "SlateTriggerEventInput_slateInstanceOid_fkey" FOREIGN KEY ("slateInstanceOid") REFERENCES "SlateInstance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateTriggerEventInput" ADD CONSTRAINT "SlateTriggerEventInput_eventOid_fkey" FOREIGN KEY ("eventOid") REFERENCES "SlateTriggerEvent"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateTriggerEvent" ADD CONSTRAINT "SlateTriggerEvent_receiverOid_fkey" FOREIGN KEY ("receiverOid") REFERENCES "SlateTriggerReceiver"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateTriggerEvent" ADD CONSTRAINT "SlateTriggerEvent_receiverTriggerOid_fkey" FOREIGN KEY ("receiverTriggerOid") REFERENCES "SlateTriggerReceiverTrigger"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateTriggerEvent" ADD CONSTRAINT "SlateTriggerEvent_actionOid_fkey" FOREIGN KEY ("actionOid") REFERENCES "SlateAction"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateTriggerEvent" ADD CONSTRAINT "SlateTriggerEvent_slateOid_fkey" FOREIGN KEY ("slateOid") REFERENCES "Slate"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateTriggerEvent" ADD CONSTRAINT "SlateTriggerEvent_slateInstanceOid_fkey" FOREIGN KEY ("slateInstanceOid") REFERENCES "SlateInstance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateTriggerEvent" ADD CONSTRAINT "SlateTriggerEvent_invocationOid_fkey" FOREIGN KEY ("invocationOid") REFERENCES "SlateInvocation"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateTriggerDelivery" ADD CONSTRAINT "SlateTriggerDelivery_eventOid_fkey" FOREIGN KEY ("eventOid") REFERENCES "SlateTriggerEvent"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateTriggerDelivery" ADD CONSTRAINT "SlateTriggerDelivery_destinationOid_fkey" FOREIGN KEY ("destinationOid") REFERENCES "SlateTriggerDestination"("oid") ON DELETE CASCADE ON UPDATE CASCADE;
