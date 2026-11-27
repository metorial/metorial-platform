-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "CallbackStatus" AS ENUM ('active', 'deleted');

-- CreateEnum
CREATE TYPE "CallbackInstanceStatus" AS ENUM ('active', 'deleted');

-- CreateEnum
CREATE TYPE "ChangeNotificationType" AS ENUM ('slate_version_created');

-- CreateEnum
CREATE TYPE "SlateErrorType" AS ENUM ('tool_call_failed', 'config_validation_failed', 'auth_processing_failed', 'oauth_token_refresh_failed', 'oauth_setup_failed', 'profile_fetch_failed', 'attachment_refresh_failed');

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
CREATE TYPE "SecretType" AS ENUM ('slate_authentication_configuration', 'slate_oauth_credentials', 'slate_oauth_setup', 'slate_webhook_registration_payload');

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
CREATE TYPE "SlatePublicToolCallStatus" AS ENUM ('succeeded', 'failed');

-- CreateEnum
CREATE TYPE "TriggerEventStatus" AS ENUM ('pending', 'mapping_failed', 'mapping_failed_final', 'mapped');

-- CreateEnum
CREATE TYPE "TriggerEventInvocationStatus" AS ENUM ('failed', 'succeeded');

-- CreateEnum
CREATE TYPE "TriggerRegistrationStatus" AS ENUM ('active', 'deleted');

-- CreateEnum
CREATE TYPE "TriggerRawEventSource" AS ENUM ('polling', 'webhook', 'gateway');

-- CreateEnum
CREATE TYPE "TriggerRawEventProcessingStatus" AS ENUM ('pending', 'failed');

-- CreateEnum
CREATE TYPE "TriggerPollingRunStatus" AS ENUM ('succeeded', 'failed');

-- CreateEnum
CREATE TYPE "TriggerWebhookTargetStatus" AS ENUM ('creating', 'active', 'failed', 'deleting', 'deleted');

-- CreateEnum
CREATE TYPE "TriggerWebhookTargetRegistrationAttemptStatus" AS ENUM ('failed', 'succeeded');

-- CreateEnum
CREATE TYPE "TriggerRoutingDropReason" AS ENUM ('no_matcher', 'no_match', 'registration_inactive', 'registration_not_matchable', 'no_subscribers', 'callbacks_disabled');

-- CreateEnum
CREATE TYPE "SlateWebhookEventStatus" AS ENUM ('pending', 'failed_retrying', 'failed_final', 'succeeded');

-- CreateEnum
CREATE TYPE "SlateWebhookEventInvocationStatus" AS ENUM ('failed', 'succeeded');

-- CreateEnum
CREATE TYPE "SlateWebhookRegistrationType" AS ENUM ('automated', 'manual');

-- CreateEnum
CREATE TYPE "SlateWebhookRegistrationOwner" AS ENUM ('tenant', 'global');

-- CreateEnum
CREATE TYPE "SlateWebhookRegistrationStatus" AS ENUM ('awaiting_setup', 'active', 'deleted');

-- CreateEnum
CREATE TYPE "SlateWebhookRegistrationAuthRouting" AS ENUM ('any', 'restricted_method', 'restricted_credential');

-- CreateTable
CREATE TABLE "Adapter" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Adapter_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "AdapterCapability" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "adapterOid" BIGINT NOT NULL,
    "identifier" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdapterCapability_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateAdapter" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "slateOid" BIGINT NOT NULL,
    "adapterOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateAdapter_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateVersionAdapter" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "slateVersionOid" BIGINT NOT NULL,
    "adapterOid" BIGINT NOT NULL,
    "slateAdapterOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateVersionAdapter_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateVersionAdapterCapability" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "slateVersionAdapterOid" BIGINT NOT NULL,
    "adapterCapabilityOid" BIGINT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateVersionAdapterCapability_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "AdminSession" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "adminUserOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateAttachment" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "digest" BYTEA,
    "tenantOid" BIGINT,
    "authConfigOid" BIGINT,
    "slateInstanceOid" BIGINT,
    "targetUrl" TEXT,
    "storageBucket" TEXT,
    "storageKey" TEXT,
    "headers" JSONB,
    "query" JSONB,
    "mimeType" TEXT,
    "refreshReference" JSONB,
    "refreshAfter" TIMESTAMP(3),
    "lastRefreshedAt" TIMESTAMP(3),
    "refreshFailureCount" INTEGER NOT NULL DEFAULT 0,
    "lastRefreshErrorCode" TEXT,
    "lastRefreshErrorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlateAttachment_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateAttachmentBlob" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "digest" BYTEA NOT NULL,
    "storageBucket" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateAttachmentBlob_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateAttachmentUpload" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "invocationOid" BIGINT NOT NULL,
    "mimeType" TEXT,
    "filename" TEXT,
    "sizeBytes" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "storageBucket" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlateAttachmentUpload_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Callback" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "CallbackStatus" NOT NULL DEFAULT 'active',
    "tenantOid" BIGINT NOT NULL,
    "slateOid" BIGINT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Callback_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "CallbackInstance" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "CallbackInstanceStatus" NOT NULL DEFAULT 'active',
    "tenantOid" BIGINT NOT NULL,
    "callbackOid" BIGINT NOT NULL,
    "triggerRegistrationOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallbackInstance_pkey" PRIMARY KEY ("oid")
);

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
CREATE TABLE "SlateError" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "SlateErrorType" NOT NULL,
    "errorCode" TEXT NOT NULL,
    "errorMessage" TEXT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "slateOid" BIGINT,
    "slateVersionOid" BIGINT,
    "slateInstanceOid" BIGINT,
    "invocationOid" BIGINT,
    "toolCallOid" BIGINT,
    "sessionOid" BIGINT,
    "authConfigOid" BIGINT,
    "instanceConfigOid" BIGINT,
    "oauthSetupOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateError_pkey" PRIMARY KEY ("oid")
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
CREATE TABLE "SlateInstanceConfiguration" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "enclaveId" TEXT NOT NULL,
    "egressPolicy" JSONB NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateInstanceConfiguration_pkey" PRIMARY KEY ("oid")
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
    "errorInvocationId" TEXT,
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
    "errorInvocationId" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "grantedScopes" TEXT[],
    "profile" JSONB,
    "profileUid" TEXT,
    "profileEmail" TEXT,
    "profileName" TEXT,
    "routingMatchers" JSONB,
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
    "id" TEXT,
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
    "isAdminSetup" BOOLEAN NOT NULL DEFAULT false,
    "adminInstructions" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "oauthCredentialsOid" BIGINT NOT NULL,
    "authMethodOid" BIGINT NOT NULL,
    "slateOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "slateVersionOid" BIGINT NOT NULL,
    "slateInstanceOid" BIGINT,
    "slateAuthConfigOid" BIGINT,
    "instanceConfigurationOid" BIGINT,
    "secretOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateInstanceOAuthSetup_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateInstanceOAuthSetupEvent" (
    "oid" BIGINT NOT NULL,
    "id" TEXT,
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
CREATE TABLE "SlateInvocationAttachment" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "invocationOid" BIGINT NOT NULL,
    "attachmentsOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateInvocationAttachment_pkey" PRIMARY KEY ("oid")
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
    "isDelegatedToNebula" BOOLEAN NOT NULL DEFAULT false,
    "nebulaSecretId" TEXT,
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
    "capabilities" JSONB NOT NULL DEFAULT '{}',
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
    "docs" JSONB NOT NULL DEFAULT '[]',
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
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "spec" JSONB NOT NULL,
    "slateOid" BIGINT NOT NULL,
    "slateAdapterOid" BIGINT,
    "mostRecentSpecificationOid" BIGINT NOT NULL,
    "triggerGroupOid" BIGINT,
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
CREATE TABLE "SlateTriggerGroup" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "spec" JSONB NOT NULL,
    "slateOid" BIGINT NOT NULL,
    "mostRecentSpecificationOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateTriggerGroup_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateSpecificationTriggerGroup" (
    "oid" BIGINT NOT NULL,
    "specificationOid" BIGINT NOT NULL,
    "triggerGroupOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateSpecificationTriggerGroup_pkey" PRIMARY KEY ("oid")
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
    "providerDocs" JSONB NOT NULL DEFAULT '[]',
    "configSchema" JSONB NOT NULL,
    "configSchemaDocs" JSONB NOT NULL DEFAULT '[]',
    "authMethods" JSONB NOT NULL,
    "actions" JSONB NOT NULL,
    "triggerGroups" JSONB NOT NULL DEFAULT '[]',
    "toolCategories" JSONB NOT NULL DEFAULT '[]',
    "capabilities" JSONB NOT NULL DEFAULT '{}',
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
    "isCancelledByRedeploy" BOOLEAN NOT NULL DEFAULT false,
    "slateVersionOid" BIGINT NOT NULL,
    "slateOid" BIGINT NOT NULL,
    "providerOid" BIGINT NOT NULL,
    "providerDeploymentInfo" JSONB NOT NULL,
    "internalLogs" TEXT[],
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
    "nebulaTenantId" TEXT,
    "functionBayTenantId" TEXT,
    "functionBayTenantIdentifier" TEXT,
    "tenantIsolationEnabled" BOOLEAN NOT NULL DEFAULT false,
    "logRetentionInDays" INTEGER NOT NULL DEFAULT 30,
    "storeContent" BOOLEAN NOT NULL DEFAULT true,
    "collectErrors" BOOLEAN NOT NULL DEFAULT true,
    "storeToolCallAttachments" BOOLEAN NOT NULL DEFAULT true,
    "disableCallbacks" BOOLEAN NOT NULL DEFAULT false,
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
    "instanceConfigurationOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3),

    CONSTRAINT "SlateSession_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateSessionToolCall" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SlateSessionToolCallStatus" NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "durationMs" INTEGER,
    "actionOid" BIGINT NOT NULL,
    "invocationOid" BIGINT NOT NULL,
    "sessionOid" BIGINT NOT NULL,
    "slateVersionOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateSessionToolCall_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlatePublicToolCall" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SlatePublicToolCallStatus" NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "durationMs" INTEGER,
    "tenantOid" BIGINT NOT NULL,
    "actionOid" BIGINT NOT NULL,
    "invocationOid" BIGINT NOT NULL,
    "slateOid" BIGINT NOT NULL,
    "slateVersionOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlatePublicToolCall_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "TriggerEvent" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "TriggerEventStatus" NOT NULL DEFAULT 'pending',
    "triggerRegistrationInstanceOid" BIGINT NOT NULL,
    "source" "TriggerRawEventSource" NOT NULL,
    "triggerId" TEXT NOT NULL,
    "rawEventOid" BIGINT,
    "webhookEventOid" BIGINT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB,
    "payloadStorageKey" TEXT,
    "mappedType" TEXT,
    "mappedId" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TriggerEvent_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "TriggerEventInvocation" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "TriggerEventInvocationStatus" NOT NULL,
    "attempt" INTEGER NOT NULL,
    "triggerEventOid" BIGINT NOT NULL,
    "invocationOid" BIGINT NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TriggerEventInvocation_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "TriggerRegistration" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "TriggerRegistrationStatus" NOT NULL DEFAULT 'active',
    "tenantOid" BIGINT NOT NULL,
    "slateOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "instanceConfigOid" BIGINT NOT NULL,
    "authConfigOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TriggerRegistration_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "TriggerRegistrationInstance" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "triggerRegistrationOid" BIGINT NOT NULL,
    "triggerGroupOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TriggerRegistrationInstance_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "TriggerRawEvent" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "source" "TriggerRawEventSource" NOT NULL,
    "processingStatus" "TriggerRawEventProcessingStatus" NOT NULL DEFAULT 'pending',
    "triggerRegistrationInstanceOid" BIGINT NOT NULL,
    "webhookEventOid" BIGINT,
    "payload" JSONB,
    "payloadStorageKey" TEXT,
    "idempotencyKey" TEXT,
    "triggerIds" TEXT[],
    "pendingTriggerMapCount" INTEGER NOT NULL DEFAULT 0,
    "matchers" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TriggerRawEvent_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "TriggerRegistrationSchedule" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "isDisabled" BOOLEAN NOT NULL DEFAULT false,
    "intervalSeconds" INTEGER NOT NULL,
    "firstRunAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "claimedUntil" TIMESTAMP(3),
    "triggerRegistrationInstanceOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TriggerRegistrationSchedule_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "TriggerRegistrationGateway" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "isDisabled" BOOLEAN NOT NULL DEFAULT false,
    "state" JSONB,
    "claimedBy" TEXT,
    "claimedUntil" TIMESTAMP(3),
    "lastConnectedAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "triggerRegistrationInstanceOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TriggerRegistrationGateway_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "TriggerPollingRun" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "TriggerPollingRunStatus" NOT NULL,
    "scheduleOid" BIGINT NOT NULL,
    "invocationOid" BIGINT NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TriggerPollingRun_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "TriggerWebhookTarget" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "TriggerWebhookTargetStatus" NOT NULL DEFAULT 'creating',
    "tenantOid" BIGINT NOT NULL,
    "triggerGroupOid" BIGINT NOT NULL,
    "targetIdentifier" TEXT NOT NULL,
    "normalizedTargetIdentifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB NOT NULL,
    "webhookTargetPayload" JSONB NOT NULL,
    "webhookRegistrationOid" BIGINT,
    "registeredByTriggerRegistrationOid" BIGINT,
    "unregistrationStarted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TriggerWebhookTarget_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "TriggerRegistrationWebhook" (
    "oid" BIGINT NOT NULL,
    "triggerRegistrationInstanceOid" BIGINT NOT NULL,
    "triggerWebhookTargetOid" BIGINT,
    "webhookRegistrationOid" BIGINT,
    "lastDiscoveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TriggerRegistrationWebhook_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "TriggerWebhookTargetRegistrationAttempt" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "TriggerWebhookTargetRegistrationAttemptStatus" NOT NULL,
    "triggerWebhookTargetOid" BIGINT NOT NULL,
    "invocationOid" BIGINT NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TriggerWebhookTargetRegistrationAttempt_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "TriggerRegistrationInstanceError" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "triggerRegistrationInstanceOid" BIGINT NOT NULL,
    "triggerWebhookTargetOid" BIGINT,
    "registrationAttemptOid" BIGINT,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TriggerRegistrationInstanceError_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "TriggerRoutingDrop" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "reason" "TriggerRoutingDropReason" NOT NULL,
    "tenantOid" BIGINT,
    "webhookRegistrationOid" BIGINT NOT NULL,
    "triggerGroupOid" BIGINT NOT NULL,
    "bucketStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "lastMatchers" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TriggerRoutingDrop_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "TriggerRoutingMatcher" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "triggerGroupOid" BIGINT NOT NULL,
    "hash" TEXT NOT NULL,
    "values" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TriggerRoutingMatcher_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "TriggerRegistrationInstanceRoutingMatcher" (
    "oid" BIGINT NOT NULL,
    "triggerRegistrationInstanceOid" BIGINT NOT NULL,
    "matcherOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TriggerRegistrationInstanceRoutingMatcher_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "TriggerRoutingMatcherEvaluation" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "matched" BOOLEAN NOT NULL,
    "tenantOid" BIGINT,
    "webhookRegistrationOid" BIGINT NOT NULL,
    "triggerGroupOid" BIGINT NOT NULL,
    "hash" TEXT NOT NULL,
    "matcher" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TriggerRoutingMatcherEvaluation_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateWebhookEvent" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SlateWebhookEventStatus" NOT NULL DEFAULT 'pending',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "skipped" BOOLEAN NOT NULL DEFAULT false,
    "skipReason" TEXT,
    "webhookRegistrationOid" BIGINT NOT NULL,
    "request" JSONB,
    "requestStorageKey" TEXT,
    "slateResponse" JSONB,
    "responseOverride" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateWebhookEvent_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateWebhookEventInvocation" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SlateWebhookEventInvocationStatus" NOT NULL,
    "attempt" INTEGER NOT NULL,
    "webhookEventOid" BIGINT NOT NULL,
    "invocationOid" BIGINT NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateWebhookEventInvocation_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateWebhookRegistration" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "SlateWebhookRegistrationType" NOT NULL,
    "owner" "SlateWebhookRegistrationOwner" NOT NULL,
    "status" "SlateWebhookRegistrationStatus" NOT NULL DEFAULT 'active',
    "urlKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "tenantOid" BIGINT,
    "slateOid" BIGINT NOT NULL,
    "triggerGroupOid" BIGINT NOT NULL,
    "secretOid" BIGINT NOT NULL,
    "registrationIdentifier" TEXT,
    "authRouting" "SlateWebhookRegistrationAuthRouting" NOT NULL DEFAULT 'any',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateWebhookRegistration_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateWebhookRegistrationAuthMethod" (
    "oid" BIGINT NOT NULL,
    "registrationOid" BIGINT NOT NULL,
    "authMethodOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateWebhookRegistrationAuthMethod_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateWebhookRegistrationOAuthCredentials" (
    "oid" BIGINT NOT NULL,
    "registrationOid" BIGINT NOT NULL,
    "oauthCredentialsOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateWebhookRegistrationOAuthCredentials_pkey" PRIMARY KEY ("oid")
);

-- CreateIndex
CREATE UNIQUE INDEX "Adapter_id_key" ON "Adapter"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Adapter_identifier_key" ON "Adapter"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "AdapterCapability_id_key" ON "AdapterCapability"("id");

-- CreateIndex
CREATE UNIQUE INDEX "AdapterCapability_adapterOid_identifier_key" ON "AdapterCapability"("adapterOid", "identifier");

-- CreateIndex
CREATE UNIQUE INDEX "SlateAdapter_id_key" ON "SlateAdapter"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SlateAdapter_identifier_key" ON "SlateAdapter"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "SlateAdapter_slateOid_adapterOid_key" ON "SlateAdapter"("slateOid", "adapterOid");

-- CreateIndex
CREATE UNIQUE INDEX "SlateVersionAdapter_id_key" ON "SlateVersionAdapter"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SlateVersionAdapter_slateVersionOid_adapterOid_key" ON "SlateVersionAdapter"("slateVersionOid", "adapterOid");

-- CreateIndex
CREATE UNIQUE INDEX "SlateVersionAdapter_slateVersionOid_slateAdapterOid_key" ON "SlateVersionAdapter"("slateVersionOid", "slateAdapterOid");

-- CreateIndex
CREATE UNIQUE INDEX "SlateVersionAdapterCapability_id_key" ON "SlateVersionAdapterCapability"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SlateVersionAdapterCapability_slateVersionAdapterOid_adapte_key" ON "SlateVersionAdapterCapability"("slateVersionAdapterOid", "adapterCapabilityOid");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_id_key" ON "AdminUser"("id");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AdminSession_id_key" ON "AdminSession"("id");

-- CreateIndex
CREATE UNIQUE INDEX "AdminSession_token_key" ON "AdminSession"("token");

-- CreateIndex
CREATE INDEX "AdminSession_token_idx" ON "AdminSession"("token");

-- CreateIndex
CREATE INDEX "AdminSession_expiresAt_idx" ON "AdminSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "SlateAttachment_id_key" ON "SlateAttachment"("id");

-- CreateIndex
CREATE INDEX "SlateAttachment_digest_idx" ON "SlateAttachment"("digest");

-- CreateIndex
CREATE INDEX "SlateAttachment_expiresAt_idx" ON "SlateAttachment"("expiresAt");

-- CreateIndex
CREATE INDEX "SlateAttachment_refreshAfter_idx" ON "SlateAttachment"("refreshAfter");

-- CreateIndex
CREATE UNIQUE INDEX "SlateAttachmentBlob_id_key" ON "SlateAttachmentBlob"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SlateAttachmentBlob_digest_key" ON "SlateAttachmentBlob"("digest");

-- CreateIndex
CREATE UNIQUE INDEX "SlateAttachmentUpload_id_key" ON "SlateAttachmentUpload"("id");

-- CreateIndex
CREATE INDEX "SlateAttachmentUpload_expiresAt_status_idx" ON "SlateAttachmentUpload"("expiresAt", "status");

-- CreateIndex
CREATE INDEX "SlateAttachmentUpload_invocationOid_idx" ON "SlateAttachmentUpload"("invocationOid");

-- CreateIndex
CREATE UNIQUE INDEX "Callback_id_key" ON "Callback"("id");

-- CreateIndex
CREATE INDEX "Callback_tenantOid_createdAt_idx" ON "Callback"("tenantOid", "createdAt");

-- CreateIndex
CREATE INDEX "Callback_slateOid_idx" ON "Callback"("slateOid");

-- CreateIndex
CREATE UNIQUE INDEX "CallbackInstance_id_key" ON "CallbackInstance"("id");

-- CreateIndex
CREATE UNIQUE INDEX "CallbackInstance_triggerRegistrationOid_key" ON "CallbackInstance"("triggerRegistrationOid");

-- CreateIndex
CREATE INDEX "CallbackInstance_callbackOid_createdAt_idx" ON "CallbackInstance"("callbackOid", "createdAt");

-- CreateIndex
CREATE INDEX "CallbackInstance_tenantOid_createdAt_idx" ON "CallbackInstance"("tenantOid", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChangeNotification_id_key" ON "ChangeNotification"("id");

-- CreateIndex
CREATE INDEX "ChangeNotification_type_idx" ON "ChangeNotification"("type");

-- CreateIndex
CREATE UNIQUE INDEX "SlateError_id_key" ON "SlateError"("id");

-- CreateIndex
CREATE INDEX "SlateError_type_createdAt_idx" ON "SlateError"("type", "createdAt");

-- CreateIndex
CREATE INDEX "SlateError_tenantOid_createdAt_idx" ON "SlateError"("tenantOid", "createdAt");

-- CreateIndex
CREATE INDEX "SlateError_slateOid_createdAt_idx" ON "SlateError"("slateOid", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Hub_id_key" ON "Hub"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Hub_internalIdentifier_key" ON "Hub"("internalIdentifier");

-- CreateIndex
CREATE UNIQUE INDEX "Hub_identifier_key" ON "Hub"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "SlateInstance_id_key" ON "SlateInstance"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SlateInstanceConfiguration_id_key" ON "SlateInstanceConfiguration"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SlateInstanceEvent_id_key" ON "SlateInstanceEvent"("id");

-- CreateIndex
CREATE INDEX "SlateInstanceEvent_tenantOid_createdAt_idx" ON "SlateInstanceEvent"("tenantOid", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SlateInstanceConfig_id_key" ON "SlateInstanceConfig"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SlateOAuthCredentials_id_key" ON "SlateOAuthCredentials"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SlateAuthConfig_id_key" ON "SlateAuthConfig"("id");

-- CreateIndex
CREATE INDEX "SlateAuthConfig_slateOid_profileUid_idx" ON "SlateAuthConfig"("slateOid", "profileUid");

-- CreateIndex
CREATE UNIQUE INDEX "SlateAuthConfigUsedForInstance_configOid_instanceOid_key" ON "SlateAuthConfigUsedForInstance"("configOid", "instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "SlateAuthConfigEvent_id_key" ON "SlateAuthConfigEvent"("id");

-- CreateIndex
CREATE INDEX "SlateAuthConfigEvent_configOid_createdAt_idx" ON "SlateAuthConfigEvent"("configOid", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SlateInstanceOAuthSetup_id_key" ON "SlateInstanceOAuthSetup"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SlateInstanceOAuthSetupEvent_id_key" ON "SlateInstanceOAuthSetupEvent"("id");

-- CreateIndex
CREATE INDEX "SlateInstanceOAuthSetupEvent_setupOid_createdAt_idx" ON "SlateInstanceOAuthSetupEvent"("setupOid", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SlateInvocationStorageBucket_bucket_key" ON "SlateInvocationStorageBucket"("bucket");

-- CreateIndex
CREATE UNIQUE INDEX "SlateInvocation_id_key" ON "SlateInvocation"("id");

-- CreateIndex
CREATE INDEX "SlateInvocation_deploymentOid_createdAt_idx" ON "SlateInvocation"("deploymentOid", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SlateInvocationAttachment_id_key" ON "SlateInvocationAttachment"("id");

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
CREATE UNIQUE INDEX "SlateTriggerGroup_id_key" ON "SlateTriggerGroup"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SlateTriggerGroup_identifier_key" ON "SlateTriggerGroup"("identifier");

-- CreateIndex
CREATE INDEX "SlateTriggerGroup_key_idx" ON "SlateTriggerGroup"("key");

-- CreateIndex
CREATE UNIQUE INDEX "SlateSpecificationTriggerGroup_specificationOid_triggerGrou_key" ON "SlateSpecificationTriggerGroup"("specificationOid", "triggerGroupOid");

-- CreateIndex
CREATE UNIQUE INDEX "SlateSpecification_id_key" ON "SlateSpecification"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SlateSpecification_identifier_key" ON "SlateSpecification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "SlateVersionDiscovery_id_key" ON "SlateVersionDiscovery"("id");

-- CreateIndex
CREATE INDEX "SlateVersionDiscovery_slateVersionOid_createdAt_idx" ON "SlateVersionDiscovery"("slateVersionOid", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SlateSpecificationChange_id_key" ON "SlateSpecificationChange"("id");

-- CreateIndex
CREATE INDEX "SlateSpecificationChange_slateOid_createdAt_idx" ON "SlateSpecificationChange"("slateOid", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SlateEvent_id_key" ON "SlateEvent"("id");

-- CreateIndex
CREATE INDEX "SlateEvent_slateOid_createdAt_idx" ON "SlateEvent"("slateOid", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeploymentProvider_id_key" ON "DeploymentProvider"("id");

-- CreateIndex
CREATE UNIQUE INDEX "DeploymentProvider_identifier_key" ON "DeploymentProvider"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "SlateDeployment_id_key" ON "SlateDeployment"("id");

-- CreateIndex
CREATE INDEX "SlateDeployment_slateOid_createdAt_idx" ON "SlateDeployment"("slateOid", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_id_key" ON "Tenant"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_identifier_key" ON "Tenant"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_signalTenantId_key" ON "Tenant"("signalTenantId");

-- CreateIndex
CREATE UNIQUE INDEX "SlateSession_id_key" ON "SlateSession"("id");

-- CreateIndex
CREATE INDEX "SlateSession_tenantOid_createdAt_idx" ON "SlateSession"("tenantOid", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SlateSessionToolCall_id_key" ON "SlateSessionToolCall"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SlatePublicToolCall_id_key" ON "SlatePublicToolCall"("id");

-- CreateIndex
CREATE INDEX "SlatePublicToolCall_tenantOid_createdAt_idx" ON "SlatePublicToolCall"("tenantOid", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TriggerEvent_id_key" ON "TriggerEvent"("id");

-- CreateIndex
CREATE INDEX "TriggerEvent_triggerRegistrationInstanceOid_createdAt_idx" ON "TriggerEvent"("triggerRegistrationInstanceOid", "createdAt");

-- CreateIndex
CREATE INDEX "TriggerEvent_status_idx" ON "TriggerEvent"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TriggerEvent_rawEventOid_triggerId_key" ON "TriggerEvent"("rawEventOid", "triggerId");

-- CreateIndex
CREATE UNIQUE INDEX "TriggerEventInvocation_id_key" ON "TriggerEventInvocation"("id");

-- CreateIndex
CREATE INDEX "TriggerEventInvocation_triggerEventOid_createdAt_idx" ON "TriggerEventInvocation"("triggerEventOid", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TriggerRegistration_id_key" ON "TriggerRegistration"("id");

-- CreateIndex
CREATE INDEX "TriggerRegistration_tenantOid_createdAt_idx" ON "TriggerRegistration"("tenantOid", "createdAt");

-- CreateIndex
CREATE INDEX "TriggerRegistration_instanceOid_idx" ON "TriggerRegistration"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "TriggerRegistrationInstance_id_key" ON "TriggerRegistrationInstance"("id");

-- CreateIndex
CREATE UNIQUE INDEX "TriggerRegistrationInstance_triggerRegistrationOid_triggerG_key" ON "TriggerRegistrationInstance"("triggerRegistrationOid", "triggerGroupOid");

-- CreateIndex
CREATE UNIQUE INDEX "TriggerRawEvent_id_key" ON "TriggerRawEvent"("id");

-- CreateIndex
CREATE INDEX "TriggerRawEvent_triggerRegistrationInstanceOid_createdAt_idx" ON "TriggerRawEvent"("triggerRegistrationInstanceOid", "createdAt");

-- CreateIndex
CREATE INDEX "TriggerRawEvent_processingStatus_createdAt_idx" ON "TriggerRawEvent"("processingStatus", "createdAt");

-- CreateIndex
CREATE INDEX "TriggerRawEvent_createdAt_idx" ON "TriggerRawEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TriggerRawEvent_triggerRegistrationInstanceOid_idempotencyK_key" ON "TriggerRawEvent"("triggerRegistrationInstanceOid", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "TriggerRegistrationSchedule_id_key" ON "TriggerRegistrationSchedule"("id");

-- CreateIndex
CREATE UNIQUE INDEX "TriggerRegistrationSchedule_triggerRegistrationInstanceOid_key" ON "TriggerRegistrationSchedule"("triggerRegistrationInstanceOid");

-- CreateIndex
CREATE INDEX "TriggerRegistrationSchedule_nextRunAt_claimedUntil_idx" ON "TriggerRegistrationSchedule"("nextRunAt", "claimedUntil");

-- CreateIndex
CREATE INDEX "TriggerRegistrationSchedule_claimedUntil_idx" ON "TriggerRegistrationSchedule"("claimedUntil");

-- CreateIndex
CREATE UNIQUE INDEX "TriggerRegistrationGateway_id_key" ON "TriggerRegistrationGateway"("id");

-- CreateIndex
CREATE UNIQUE INDEX "TriggerRegistrationGateway_triggerRegistrationInstanceOid_key" ON "TriggerRegistrationGateway"("triggerRegistrationInstanceOid");

-- CreateIndex
CREATE INDEX "TriggerRegistrationGateway_isDisabled_claimedUntil_idx" ON "TriggerRegistrationGateway"("isDisabled", "claimedUntil");

-- CreateIndex
CREATE UNIQUE INDEX "TriggerPollingRun_id_key" ON "TriggerPollingRun"("id");

-- CreateIndex
CREATE INDEX "TriggerPollingRun_scheduleOid_createdAt_idx" ON "TriggerPollingRun"("scheduleOid", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TriggerWebhookTarget_id_key" ON "TriggerWebhookTarget"("id");

-- CreateIndex
CREATE UNIQUE INDEX "TriggerWebhookTarget_webhookRegistrationOid_key" ON "TriggerWebhookTarget"("webhookRegistrationOid");

-- CreateIndex
CREATE UNIQUE INDEX "TriggerWebhookTarget_tenantOid_triggerGroupOid_normalizedTa_key" ON "TriggerWebhookTarget"("tenantOid", "triggerGroupOid", "normalizedTargetIdentifier");

-- CreateIndex
CREATE UNIQUE INDEX "TriggerRegistrationWebhook_triggerRegistrationInstanceOid_t_key" ON "TriggerRegistrationWebhook"("triggerRegistrationInstanceOid", "triggerWebhookTargetOid");

-- CreateIndex
CREATE UNIQUE INDEX "TriggerRegistrationWebhook_triggerRegistrationInstanceOid_w_key" ON "TriggerRegistrationWebhook"("triggerRegistrationInstanceOid", "webhookRegistrationOid");

-- CreateIndex
CREATE UNIQUE INDEX "TriggerWebhookTargetRegistrationAttempt_id_key" ON "TriggerWebhookTargetRegistrationAttempt"("id");

-- CreateIndex
CREATE INDEX "TriggerWebhookTargetRegistrationAttempt_triggerWebhookTarge_idx" ON "TriggerWebhookTargetRegistrationAttempt"("triggerWebhookTargetOid", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TriggerRegistrationInstanceError_id_key" ON "TriggerRegistrationInstanceError"("id");

-- CreateIndex
CREATE INDEX "TriggerRegistrationInstanceError_triggerRegistrationInstanc_idx" ON "TriggerRegistrationInstanceError"("triggerRegistrationInstanceOid", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TriggerRoutingDrop_id_key" ON "TriggerRoutingDrop"("id");

-- CreateIndex
CREATE INDEX "TriggerRoutingDrop_tenantOid_bucketStart_idx" ON "TriggerRoutingDrop"("tenantOid", "bucketStart");

-- CreateIndex
CREATE INDEX "TriggerRoutingDrop_triggerGroupOid_bucketStart_idx" ON "TriggerRoutingDrop"("triggerGroupOid", "bucketStart");

-- CreateIndex
CREATE INDEX "TriggerRoutingDrop_bucketStart_idx" ON "TriggerRoutingDrop"("bucketStart");

-- CreateIndex
CREATE UNIQUE INDEX "TriggerRoutingDrop_webhookRegistrationOid_reason_bucketStar_key" ON "TriggerRoutingDrop"("webhookRegistrationOid", "reason", "bucketStart");

-- CreateIndex
CREATE UNIQUE INDEX "TriggerRoutingMatcher_id_key" ON "TriggerRoutingMatcher"("id");

-- CreateIndex
CREATE INDEX "TriggerRoutingMatcher_triggerGroupOid_hash_idx" ON "TriggerRoutingMatcher"("triggerGroupOid", "hash");

-- CreateIndex
CREATE UNIQUE INDEX "TriggerRoutingMatcher_tenantOid_triggerGroupOid_hash_key" ON "TriggerRoutingMatcher"("tenantOid", "triggerGroupOid", "hash");

-- CreateIndex
CREATE INDEX "TriggerRegistrationInstanceRoutingMatcher_matcherOid_idx" ON "TriggerRegistrationInstanceRoutingMatcher"("matcherOid");

-- CreateIndex
CREATE UNIQUE INDEX "TriggerRegistrationInstanceRoutingMatcher_triggerRegistrati_key" ON "TriggerRegistrationInstanceRoutingMatcher"("triggerRegistrationInstanceOid", "matcherOid");

-- CreateIndex
CREATE UNIQUE INDEX "TriggerRoutingMatcherEvaluation_id_key" ON "TriggerRoutingMatcherEvaluation"("id");

-- CreateIndex
CREATE INDEX "TriggerRoutingMatcherEvaluation_webhookRegistrationOid_crea_idx" ON "TriggerRoutingMatcherEvaluation"("webhookRegistrationOid", "createdAt");

-- CreateIndex
CREATE INDEX "TriggerRoutingMatcherEvaluation_triggerGroupOid_createdAt_idx" ON "TriggerRoutingMatcherEvaluation"("triggerGroupOid", "createdAt");

-- CreateIndex
CREATE INDEX "TriggerRoutingMatcherEvaluation_createdAt_idx" ON "TriggerRoutingMatcherEvaluation"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SlateWebhookEvent_id_key" ON "SlateWebhookEvent"("id");

-- CreateIndex
CREATE INDEX "SlateWebhookEvent_webhookRegistrationOid_createdAt_idx" ON "SlateWebhookEvent"("webhookRegistrationOid", "createdAt");

-- CreateIndex
CREATE INDEX "SlateWebhookEvent_webhookRegistrationOid_skipped_createdAt_idx" ON "SlateWebhookEvent"("webhookRegistrationOid", "skipped", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SlateWebhookEventInvocation_id_key" ON "SlateWebhookEventInvocation"("id");

-- CreateIndex
CREATE INDEX "SlateWebhookEventInvocation_webhookEventOid_createdAt_idx" ON "SlateWebhookEventInvocation"("webhookEventOid", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SlateWebhookRegistration_id_key" ON "SlateWebhookRegistration"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SlateWebhookRegistration_urlKey_key" ON "SlateWebhookRegistration"("urlKey");

-- CreateIndex
CREATE INDEX "SlateWebhookRegistration_tenantOid_createdAt_idx" ON "SlateWebhookRegistration"("tenantOid", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SlateWebhookRegistrationAuthMethod_registrationOid_authMeth_key" ON "SlateWebhookRegistrationAuthMethod"("registrationOid", "authMethodOid");

-- CreateIndex
CREATE UNIQUE INDEX "SlateWebhookRegistrationOAuthCredentials_registrationOid_oa_key" ON "SlateWebhookRegistrationOAuthCredentials"("registrationOid", "oauthCredentialsOid");

-- AddForeignKey
ALTER TABLE "AdapterCapability" ADD CONSTRAINT "AdapterCapability_adapterOid_fkey" FOREIGN KEY ("adapterOid") REFERENCES "Adapter"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateAdapter" ADD CONSTRAINT "SlateAdapter_slateOid_fkey" FOREIGN KEY ("slateOid") REFERENCES "Slate"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateAdapter" ADD CONSTRAINT "SlateAdapter_adapterOid_fkey" FOREIGN KEY ("adapterOid") REFERENCES "Adapter"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateVersionAdapter" ADD CONSTRAINT "SlateVersionAdapter_slateVersionOid_fkey" FOREIGN KEY ("slateVersionOid") REFERENCES "SlateVersion"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateVersionAdapter" ADD CONSTRAINT "SlateVersionAdapter_adapterOid_fkey" FOREIGN KEY ("adapterOid") REFERENCES "Adapter"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateVersionAdapter" ADD CONSTRAINT "SlateVersionAdapter_slateAdapterOid_fkey" FOREIGN KEY ("slateAdapterOid") REFERENCES "SlateAdapter"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateVersionAdapterCapability" ADD CONSTRAINT "SlateVersionAdapterCapability_slateVersionAdapterOid_fkey" FOREIGN KEY ("slateVersionAdapterOid") REFERENCES "SlateVersionAdapter"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateVersionAdapterCapability" ADD CONSTRAINT "SlateVersionAdapterCapability_adapterCapabilityOid_fkey" FOREIGN KEY ("adapterCapabilityOid") REFERENCES "AdapterCapability"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminSession" ADD CONSTRAINT "AdminSession_adminUserOid_fkey" FOREIGN KEY ("adminUserOid") REFERENCES "AdminUser"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateAttachment" ADD CONSTRAINT "SlateAttachment_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateAttachment" ADD CONSTRAINT "SlateAttachment_authConfigOid_fkey" FOREIGN KEY ("authConfigOid") REFERENCES "SlateAuthConfig"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateAttachment" ADD CONSTRAINT "SlateAttachment_slateInstanceOid_fkey" FOREIGN KEY ("slateInstanceOid") REFERENCES "SlateInstance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateAttachmentUpload" ADD CONSTRAINT "SlateAttachmentUpload_invocationOid_fkey" FOREIGN KEY ("invocationOid") REFERENCES "SlateInvocation"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Callback" ADD CONSTRAINT "Callback_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Callback" ADD CONSTRAINT "Callback_slateOid_fkey" FOREIGN KEY ("slateOid") REFERENCES "Slate"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallbackInstance" ADD CONSTRAINT "CallbackInstance_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallbackInstance" ADD CONSTRAINT "CallbackInstance_callbackOid_fkey" FOREIGN KEY ("callbackOid") REFERENCES "Callback"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallbackInstance" ADD CONSTRAINT "CallbackInstance_triggerRegistrationOid_fkey" FOREIGN KEY ("triggerRegistrationOid") REFERENCES "TriggerRegistration"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeNotification" ADD CONSTRAINT "ChangeNotification_slateOid_fkey" FOREIGN KEY ("slateOid") REFERENCES "Slate"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeNotification" ADD CONSTRAINT "ChangeNotification_slateVersionOid_fkey" FOREIGN KEY ("slateVersionOid") REFERENCES "SlateVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateError" ADD CONSTRAINT "SlateError_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateError" ADD CONSTRAINT "SlateError_slateOid_fkey" FOREIGN KEY ("slateOid") REFERENCES "Slate"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateError" ADD CONSTRAINT "SlateError_slateVersionOid_fkey" FOREIGN KEY ("slateVersionOid") REFERENCES "SlateVersion"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateError" ADD CONSTRAINT "SlateError_slateInstanceOid_fkey" FOREIGN KEY ("slateInstanceOid") REFERENCES "SlateInstance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateError" ADD CONSTRAINT "SlateError_invocationOid_fkey" FOREIGN KEY ("invocationOid") REFERENCES "SlateInvocation"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateError" ADD CONSTRAINT "SlateError_toolCallOid_fkey" FOREIGN KEY ("toolCallOid") REFERENCES "SlateSessionToolCall"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateError" ADD CONSTRAINT "SlateError_sessionOid_fkey" FOREIGN KEY ("sessionOid") REFERENCES "SlateSession"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateError" ADD CONSTRAINT "SlateError_authConfigOid_fkey" FOREIGN KEY ("authConfigOid") REFERENCES "SlateAuthConfig"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateError" ADD CONSTRAINT "SlateError_instanceConfigOid_fkey" FOREIGN KEY ("instanceConfigOid") REFERENCES "SlateInstanceConfig"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateError" ADD CONSTRAINT "SlateError_oauthSetupOid_fkey" FOREIGN KEY ("oauthSetupOid") REFERENCES "SlateInstanceOAuthSetup"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "SlateInstanceConfiguration" ADD CONSTRAINT "SlateInstanceConfiguration_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "SlateInstanceOAuthSetup" ADD CONSTRAINT "SlateInstanceOAuthSetup_instanceConfigurationOid_fkey" FOREIGN KEY ("instanceConfigurationOid") REFERENCES "SlateInstanceConfiguration"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE "SlateInvocationAttachment" ADD CONSTRAINT "SlateInvocationAttachment_invocationOid_fkey" FOREIGN KEY ("invocationOid") REFERENCES "SlateInvocation"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateInvocationAttachment" ADD CONSTRAINT "SlateInvocationAttachment_attachmentsOid_fkey" FOREIGN KEY ("attachmentsOid") REFERENCES "SlateAttachment"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

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
ALTER TABLE "SlateAction" ADD CONSTRAINT "SlateAction_slateAdapterOid_fkey" FOREIGN KEY ("slateAdapterOid") REFERENCES "SlateAdapter"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateAction" ADD CONSTRAINT "SlateAction_mostRecentSpecificationOid_fkey" FOREIGN KEY ("mostRecentSpecificationOid") REFERENCES "SlateSpecification"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateAction" ADD CONSTRAINT "SlateAction_triggerGroupOid_fkey" FOREIGN KEY ("triggerGroupOid") REFERENCES "SlateTriggerGroup"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateSpecificationAction" ADD CONSTRAINT "SlateSpecificationAction_specificationOid_fkey" FOREIGN KEY ("specificationOid") REFERENCES "SlateSpecification"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateSpecificationAction" ADD CONSTRAINT "SlateSpecificationAction_actionOid_fkey" FOREIGN KEY ("actionOid") REFERENCES "SlateAction"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateTriggerGroup" ADD CONSTRAINT "SlateTriggerGroup_slateOid_fkey" FOREIGN KEY ("slateOid") REFERENCES "Slate"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateTriggerGroup" ADD CONSTRAINT "SlateTriggerGroup_mostRecentSpecificationOid_fkey" FOREIGN KEY ("mostRecentSpecificationOid") REFERENCES "SlateSpecification"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateSpecificationTriggerGroup" ADD CONSTRAINT "SlateSpecificationTriggerGroup_specificationOid_fkey" FOREIGN KEY ("specificationOid") REFERENCES "SlateSpecification"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateSpecificationTriggerGroup" ADD CONSTRAINT "SlateSpecificationTriggerGroup_triggerGroupOid_fkey" FOREIGN KEY ("triggerGroupOid") REFERENCES "SlateTriggerGroup"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

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
ALTER TABLE "SlateSession" ADD CONSTRAINT "SlateSession_instanceConfigurationOid_fkey" FOREIGN KEY ("instanceConfigurationOid") REFERENCES "SlateInstanceConfiguration"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateSessionToolCall" ADD CONSTRAINT "SlateSessionToolCall_actionOid_fkey" FOREIGN KEY ("actionOid") REFERENCES "SlateAction"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateSessionToolCall" ADD CONSTRAINT "SlateSessionToolCall_invocationOid_fkey" FOREIGN KEY ("invocationOid") REFERENCES "SlateInvocation"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateSessionToolCall" ADD CONSTRAINT "SlateSessionToolCall_sessionOid_fkey" FOREIGN KEY ("sessionOid") REFERENCES "SlateSession"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateSessionToolCall" ADD CONSTRAINT "SlateSessionToolCall_slateVersionOid_fkey" FOREIGN KEY ("slateVersionOid") REFERENCES "SlateVersion"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlatePublicToolCall" ADD CONSTRAINT "SlatePublicToolCall_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlatePublicToolCall" ADD CONSTRAINT "SlatePublicToolCall_actionOid_fkey" FOREIGN KEY ("actionOid") REFERENCES "SlateAction"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlatePublicToolCall" ADD CONSTRAINT "SlatePublicToolCall_invocationOid_fkey" FOREIGN KEY ("invocationOid") REFERENCES "SlateInvocation"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlatePublicToolCall" ADD CONSTRAINT "SlatePublicToolCall_slateOid_fkey" FOREIGN KEY ("slateOid") REFERENCES "Slate"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlatePublicToolCall" ADD CONSTRAINT "SlatePublicToolCall_slateVersionOid_fkey" FOREIGN KEY ("slateVersionOid") REFERENCES "SlateVersion"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriggerEvent" ADD CONSTRAINT "TriggerEvent_triggerRegistrationInstanceOid_fkey" FOREIGN KEY ("triggerRegistrationInstanceOid") REFERENCES "TriggerRegistrationInstance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriggerEvent" ADD CONSTRAINT "TriggerEvent_rawEventOid_fkey" FOREIGN KEY ("rawEventOid") REFERENCES "TriggerRawEvent"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriggerEvent" ADD CONSTRAINT "TriggerEvent_webhookEventOid_fkey" FOREIGN KEY ("webhookEventOid") REFERENCES "SlateWebhookEvent"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriggerEventInvocation" ADD CONSTRAINT "TriggerEventInvocation_triggerEventOid_fkey" FOREIGN KEY ("triggerEventOid") REFERENCES "TriggerEvent"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriggerEventInvocation" ADD CONSTRAINT "TriggerEventInvocation_invocationOid_fkey" FOREIGN KEY ("invocationOid") REFERENCES "SlateInvocation"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriggerRegistration" ADD CONSTRAINT "TriggerRegistration_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriggerRegistration" ADD CONSTRAINT "TriggerRegistration_slateOid_fkey" FOREIGN KEY ("slateOid") REFERENCES "Slate"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriggerRegistration" ADD CONSTRAINT "TriggerRegistration_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "SlateInstance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriggerRegistration" ADD CONSTRAINT "TriggerRegistration_instanceConfigOid_fkey" FOREIGN KEY ("instanceConfigOid") REFERENCES "SlateInstanceConfig"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriggerRegistration" ADD CONSTRAINT "TriggerRegistration_authConfigOid_fkey" FOREIGN KEY ("authConfigOid") REFERENCES "SlateAuthConfig"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriggerRegistrationInstance" ADD CONSTRAINT "TriggerRegistrationInstance_triggerRegistrationOid_fkey" FOREIGN KEY ("triggerRegistrationOid") REFERENCES "TriggerRegistration"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriggerRegistrationInstance" ADD CONSTRAINT "TriggerRegistrationInstance_triggerGroupOid_fkey" FOREIGN KEY ("triggerGroupOid") REFERENCES "SlateTriggerGroup"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriggerRawEvent" ADD CONSTRAINT "TriggerRawEvent_triggerRegistrationInstanceOid_fkey" FOREIGN KEY ("triggerRegistrationInstanceOid") REFERENCES "TriggerRegistrationInstance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriggerRawEvent" ADD CONSTRAINT "TriggerRawEvent_webhookEventOid_fkey" FOREIGN KEY ("webhookEventOid") REFERENCES "SlateWebhookEvent"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriggerRegistrationSchedule" ADD CONSTRAINT "TriggerRegistrationSchedule_triggerRegistrationInstanceOid_fkey" FOREIGN KEY ("triggerRegistrationInstanceOid") REFERENCES "TriggerRegistrationInstance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriggerRegistrationGateway" ADD CONSTRAINT "TriggerRegistrationGateway_triggerRegistrationInstanceOid_fkey" FOREIGN KEY ("triggerRegistrationInstanceOid") REFERENCES "TriggerRegistrationInstance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriggerPollingRun" ADD CONSTRAINT "TriggerPollingRun_scheduleOid_fkey" FOREIGN KEY ("scheduleOid") REFERENCES "TriggerRegistrationSchedule"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriggerPollingRun" ADD CONSTRAINT "TriggerPollingRun_invocationOid_fkey" FOREIGN KEY ("invocationOid") REFERENCES "SlateInvocation"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriggerWebhookTarget" ADD CONSTRAINT "TriggerWebhookTarget_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriggerWebhookTarget" ADD CONSTRAINT "TriggerWebhookTarget_triggerGroupOid_fkey" FOREIGN KEY ("triggerGroupOid") REFERENCES "SlateTriggerGroup"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriggerWebhookTarget" ADD CONSTRAINT "TriggerWebhookTarget_webhookRegistrationOid_fkey" FOREIGN KEY ("webhookRegistrationOid") REFERENCES "SlateWebhookRegistration"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriggerWebhookTarget" ADD CONSTRAINT "TriggerWebhookTarget_registeredByTriggerRegistrationOid_fkey" FOREIGN KEY ("registeredByTriggerRegistrationOid") REFERENCES "TriggerRegistration"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriggerRegistrationWebhook" ADD CONSTRAINT "TriggerRegistrationWebhook_triggerRegistrationInstanceOid_fkey" FOREIGN KEY ("triggerRegistrationInstanceOid") REFERENCES "TriggerRegistrationInstance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriggerRegistrationWebhook" ADD CONSTRAINT "TriggerRegistrationWebhook_triggerWebhookTargetOid_fkey" FOREIGN KEY ("triggerWebhookTargetOid") REFERENCES "TriggerWebhookTarget"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriggerRegistrationWebhook" ADD CONSTRAINT "TriggerRegistrationWebhook_webhookRegistrationOid_fkey" FOREIGN KEY ("webhookRegistrationOid") REFERENCES "SlateWebhookRegistration"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriggerWebhookTargetRegistrationAttempt" ADD CONSTRAINT "TriggerWebhookTargetRegistrationAttempt_triggerWebhookTarg_fkey" FOREIGN KEY ("triggerWebhookTargetOid") REFERENCES "TriggerWebhookTarget"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriggerWebhookTargetRegistrationAttempt" ADD CONSTRAINT "TriggerWebhookTargetRegistrationAttempt_invocationOid_fkey" FOREIGN KEY ("invocationOid") REFERENCES "SlateInvocation"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriggerRegistrationInstanceError" ADD CONSTRAINT "TriggerRegistrationInstanceError_triggerRegistrationInstan_fkey" FOREIGN KEY ("triggerRegistrationInstanceOid") REFERENCES "TriggerRegistrationInstance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriggerRegistrationInstanceError" ADD CONSTRAINT "TriggerRegistrationInstanceError_triggerWebhookTargetOid_fkey" FOREIGN KEY ("triggerWebhookTargetOid") REFERENCES "TriggerWebhookTarget"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriggerRegistrationInstanceError" ADD CONSTRAINT "TriggerRegistrationInstanceError_registrationAttemptOid_fkey" FOREIGN KEY ("registrationAttemptOid") REFERENCES "TriggerWebhookTargetRegistrationAttempt"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriggerRoutingDrop" ADD CONSTRAINT "TriggerRoutingDrop_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriggerRoutingDrop" ADD CONSTRAINT "TriggerRoutingDrop_webhookRegistrationOid_fkey" FOREIGN KEY ("webhookRegistrationOid") REFERENCES "SlateWebhookRegistration"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriggerRoutingDrop" ADD CONSTRAINT "TriggerRoutingDrop_triggerGroupOid_fkey" FOREIGN KEY ("triggerGroupOid") REFERENCES "SlateTriggerGroup"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriggerRoutingMatcher" ADD CONSTRAINT "TriggerRoutingMatcher_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriggerRoutingMatcher" ADD CONSTRAINT "TriggerRoutingMatcher_triggerGroupOid_fkey" FOREIGN KEY ("triggerGroupOid") REFERENCES "SlateTriggerGroup"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriggerRegistrationInstanceRoutingMatcher" ADD CONSTRAINT "TriggerRegistrationInstanceRoutingMatcher_triggerRegistrat_fkey" FOREIGN KEY ("triggerRegistrationInstanceOid") REFERENCES "TriggerRegistrationInstance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriggerRegistrationInstanceRoutingMatcher" ADD CONSTRAINT "TriggerRegistrationInstanceRoutingMatcher_matcherOid_fkey" FOREIGN KEY ("matcherOid") REFERENCES "TriggerRoutingMatcher"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriggerRoutingMatcherEvaluation" ADD CONSTRAINT "TriggerRoutingMatcherEvaluation_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriggerRoutingMatcherEvaluation" ADD CONSTRAINT "TriggerRoutingMatcherEvaluation_webhookRegistrationOid_fkey" FOREIGN KEY ("webhookRegistrationOid") REFERENCES "SlateWebhookRegistration"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriggerRoutingMatcherEvaluation" ADD CONSTRAINT "TriggerRoutingMatcherEvaluation_triggerGroupOid_fkey" FOREIGN KEY ("triggerGroupOid") REFERENCES "SlateTriggerGroup"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateWebhookEvent" ADD CONSTRAINT "SlateWebhookEvent_webhookRegistrationOid_fkey" FOREIGN KEY ("webhookRegistrationOid") REFERENCES "SlateWebhookRegistration"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateWebhookEventInvocation" ADD CONSTRAINT "SlateWebhookEventInvocation_webhookEventOid_fkey" FOREIGN KEY ("webhookEventOid") REFERENCES "SlateWebhookEvent"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateWebhookEventInvocation" ADD CONSTRAINT "SlateWebhookEventInvocation_invocationOid_fkey" FOREIGN KEY ("invocationOid") REFERENCES "SlateInvocation"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateWebhookRegistration" ADD CONSTRAINT "SlateWebhookRegistration_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateWebhookRegistration" ADD CONSTRAINT "SlateWebhookRegistration_slateOid_fkey" FOREIGN KEY ("slateOid") REFERENCES "Slate"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateWebhookRegistration" ADD CONSTRAINT "SlateWebhookRegistration_triggerGroupOid_fkey" FOREIGN KEY ("triggerGroupOid") REFERENCES "SlateTriggerGroup"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateWebhookRegistration" ADD CONSTRAINT "SlateWebhookRegistration_secretOid_fkey" FOREIGN KEY ("secretOid") REFERENCES "Secret"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateWebhookRegistrationAuthMethod" ADD CONSTRAINT "SlateWebhookRegistrationAuthMethod_registrationOid_fkey" FOREIGN KEY ("registrationOid") REFERENCES "SlateWebhookRegistration"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateWebhookRegistrationAuthMethod" ADD CONSTRAINT "SlateWebhookRegistrationAuthMethod_authMethodOid_fkey" FOREIGN KEY ("authMethodOid") REFERENCES "SlateAuthMethod"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateWebhookRegistrationOAuthCredentials" ADD CONSTRAINT "SlateWebhookRegistrationOAuthCredentials_registrationOid_fkey" FOREIGN KEY ("registrationOid") REFERENCES "SlateWebhookRegistration"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateWebhookRegistrationOAuthCredentials" ADD CONSTRAINT "SlateWebhookRegistrationOAuthCredentials_oauthCredentialsO_fkey" FOREIGN KEY ("oauthCredentialsOid") REFERENCES "SlateOAuthCredentials"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

