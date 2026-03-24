-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ChangeNotificationType" AS ENUM ('public_server_version_created', 'private_server_version_created');

-- CreateEnum
CREATE TYPE "ContainerRegistryType" AS ENUM ('docker');

-- CreateEnum
CREATE TYPE "ContainerRepositoryType" AS ENUM ('docker');

-- CreateEnum
CREATE TYPE "ContainerRepositoryTagDiscoveryStatus" AS ENUM ('pending', 'succeeded', 'failed');

-- CreateEnum
CREATE TYPE "ContainerRepositoryTagType" AS ENUM ('tag', 'digest');

-- CreateEnum
CREATE TYPE "ServerDeploymentStatus" AS ENUM ('queued', 'deploying', 'succeeded', 'failed');

-- CreateEnum
CREATE TYPE "ServerDeploymentStepType" AS ENUM ('started', 'discovering', 'deploying', 'publishing');

-- CreateEnum
CREATE TYPE "ServerDeploymentStepStatus" AS ENUM ('running', 'succeeded', 'failed');

-- CreateEnum
CREATE TYPE "ServerDiscoveryStatus" AS ENUM ('pending', 'succeeded', 'failed');

-- CreateEnum
CREATE TYPE "FunctionServerStatus" AS ENUM ('pending', 'succeeded', 'failed');

-- CreateEnum
CREATE TYPE "ServerAuthConfigType" AS ENUM ('remote', 'delegated');

-- CreateEnum
CREATE TYPE "ServerConnectionStatus" AS ENUM ('new', 'connected', 'disconnected');

-- CreateEnum
CREATE TYPE "NetworkingRuleStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "ServerOAuthCredentialsType" AS ENUM ('remote', 'delegated');

-- CreateEnum
CREATE TYPE "ServerOAuthSetupType" AS ENUM ('remote', 'delegated');

-- CreateEnum
CREATE TYPE "ServerOAuthSetupStatus" AS ENUM ('pending', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "DelegatedOAuthConnectionStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "DelegatedOAuthConnectionEventType" AS ENUM ('errors');

-- CreateEnum
CREATE TYPE "DelegatedOAuthConnectionSetupStatus" AS ENUM ('pending', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "DelegatedOAuthConnectionAuthTokenSource" AS ENUM ('import', 'oauth');

-- CreateEnum
CREATE TYPE "RemoteOAuthConfigDiscoveryStatus" AS ENUM ('discovering', 'failed', 'manual', 'supports_auto_registration');

-- CreateEnum
CREATE TYPE "RemoteOAuthConnectionStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "RemoteOAuthConnectionDiscoveryStatus" AS ENUM ('discovering', 'failed', 'succeeded');

-- CreateEnum
CREATE TYPE "RemoteOAuthConnectionEventType" AS ENUM ('errors', 'auto_registration_succeeded', 'auto_registration_failed', 'config_auto_discovered', 'config_auto_updated');

-- CreateEnum
CREATE TYPE "RemoteOAuthConnectionSetupStatus" AS ENUM ('pending', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "RemoteOAuthConnectionAuthTokenSource" AS ENUM ('import', 'oauth');

-- CreateEnum
CREATE TYPE "SecretStatus" AS ENUM ('active', 'deleted');

-- CreateEnum
CREATE TYPE "SecretType" AS ENUM ('registry_credentials', 'server_config_value', 'oauth_connection_credentials', 'oauth_token');

-- CreateEnum
CREATE TYPE "ServerType" AS ENUM ('container', 'remote', 'function');

-- CreateEnum
CREATE TYPE "ServerRemoteProtocol" AS ENUM ('sse', 'streamable_http');

-- CreateTable
CREATE TABLE "ConnectionLogsStorageBucket" (
    "oid" BIGINT NOT NULL,
    "bucket" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConnectionLogsStorageBucket_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ChangeNotification" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "ChangeNotificationType" NOT NULL,
    "serverOid" BIGINT,
    "serverVersionOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChangeNotification_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ContainerRegistry" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "ContainerRegistryType" NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secretOid" BIGINT,
    "tenantOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContainerRegistry_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ContainerRepository" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "ContainerRepositoryType" NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "registryOid" BIGINT NOT NULL,
    "tenantOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "registryConnectionOid" BIGINT,

    CONSTRAINT "ContainerRepository_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ContainerRepositoryTag" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "ContainerRepositoryTagType" NOT NULL,
    "discoveryStatus" "ContainerRepositoryTagDiscoveryStatus" NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tag" TEXT,
    "digest" TEXT,
    "currentVersionOid" BIGINT,
    "repositoryOid" BIGINT NOT NULL,
    "tenantOid" BIGINT,
    "lastDiscoveryErrorOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncedAt" TIMESTAMP(3),

    CONSTRAINT "ContainerRepositoryTag_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ContainerRepositoryVersion" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "digest" TEXT NOT NULL,
    "repositoryOid" BIGINT NOT NULL,
    "tenantOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContainerRepositoryVersion_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ContainerRepositoryTagVersion" (
    "oid" BIGINT NOT NULL,
    "repositoryVersionOid" BIGINT NOT NULL,
    "repositoryTagOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContainerRepositoryTagVersion_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ContainerRepositoryTagDiscoveryError" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "repositoryTagOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContainerRepositoryTagDiscoveryError_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ServerDeployment" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "ServerDeploymentStatus" NOT NULL,
    "serverOid" BIGINT NOT NULL,
    "tenantOid" BIGINT,
    "functionServerOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "ServerDeployment_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ServerDeploymentStep" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "ServerDeploymentStepStatus" NOT NULL,
    "type" "ServerDeploymentStepType" NOT NULL,
    "deploymentOid" BIGINT NOT NULL,
    "logs" JSONB[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "ServerDeploymentStep_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ServerDiscovery" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "ServerDiscoveryStatus" NOT NULL,
    "connectionOid" BIGINT,
    "specificationOid" BIGINT,
    "serverConfigOid" BIGINT NOT NULL,
    "serverAuthConfigOid" BIGINT,
    "serverVersionOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServerDiscovery_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ServerSpecification" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "serverOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServerSpecification_pkey" PRIMARY KEY ("oid")
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
CREATE TABLE "FunctionServer" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "FunctionServerStatus" NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "functionBayTenantId" TEXT NOT NULL,
    "functionBayFunctionId" TEXT NOT NULL,
    "functionBayDeploymentId" TEXT NOT NULL,
    "functionBayVersionId" TEXT,
    "supportsOAuth" BOOLEAN NOT NULL,
    "supportsOauthTokenRefresh" BOOLEAN NOT NULL,
    "info" JSONB NOT NULL,
    "configSchema" JSONB NOT NULL,
    "authConfigSchema" JSONB NOT NULL,
    "delegatedOauthConfigOid" BIGINT,
    "serverOid" BIGINT NOT NULL,
    "providerOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FunctionServer_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "UpcomingFunctionServer" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "serverOid" BIGINT NOT NULL,
    "tenantOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UpcomingFunctionServer_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "FunctionServerInvocation" (
    "oid" BIGINT NOT NULL,
    "isError" BOOLEAN NOT NULL,
    "functionBayInvocationId" TEXT NOT NULL,
    "connectionOid" BIGINT,
    "functionServerOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FunctionServerInvocation_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ServerConfig" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "secretOid" BIGINT NOT NULL,
    "serverOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServerConfig_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ServerAuthConfig" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "ServerAuthConfigType" NOT NULL,
    "serverOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "credentialsOid" BIGINT,
    "remoteOAuthConnectionOid" BIGINT,
    "remoteOAuthConnectionAuthTokenOid" BIGINT,
    "delegatedOAuthConnectionOid" BIGINT,
    "delegatedOAuthConnectionAuthTokenOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServerAuthConfig_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ServerAuthConfigExport" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "serverAuthConfigOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServerAuthConfigExport_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ServerConnection" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "ServerConnectionStatus" NOT NULL,
    "isLogsInStorage" BOOLEAN NOT NULL,
    "logBucketOid" BIGINT NOT NULL,
    "client" JSONB NOT NULL,
    "capabilities" JSONB NOT NULL,
    "serverConfigOid" BIGINT NOT NULL,
    "serverVersionOid" BIGINT NOT NULL,
    "serverAuthConfigOid" BIGINT,
    "tenantOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastPingAt" TIMESTAMP(3),

    CONSTRAINT "ServerConnection_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ServerConnectionNetworkRule" (
    "oid" BIGINT NOT NULL,
    "serverConnectionOid" BIGINT NOT NULL,
    "networkingRulesetOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServerConnectionNetworkRule_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ServerConnectionLogsTemp" (
    "oid" BIGINT NOT NULL,
    "serverConnectionOid" BIGINT NOT NULL,
    "logLines" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServerConnectionLogsTemp_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "NetworkingRuleset" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "NetworkingRuleStatus" NOT NULL,
    "rules" JSONB NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NetworkingRuleset_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "GlobalNetworkingRuleset" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "NetworkingRuleStatus" NOT NULL,
    "rules" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GlobalNetworkingRuleset_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ServerOAuthCredentials" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "ServerOAuthCredentialsType" NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "remoteConnectionOid" BIGINT,
    "delegatedConnectionOid" BIGINT,
    "serverOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServerOAuthCredentials_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ServerOAuthSetup" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "ServerOAuthSetupStatus" NOT NULL,
    "type" "ServerOAuthSetupType" NOT NULL,
    "authConfigValue" JSONB NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "callbackUrlOverride" TEXT,
    "credentialsOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "serverOid" BIGINT NOT NULL,
    "authConfigOid" BIGINT,
    "remoteOAuthConnectionSetupOid" BIGINT,
    "delegatedOAuthConnectionSetupOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServerOAuthSetup_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "DelegatedOAuthConfig" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT,
    "authConfigSchema" JSONB NOT NULL,
    "authConfigSchemaHash" TEXT NOT NULL,
    "supportsOauthTokenRefresh" BOOLEAN NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "serverOid" BIGINT NOT NULL,
    "functionServerOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DelegatedOAuthConfig_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "DelegatedOAuthConnection" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "DelegatedOAuthConnectionStatus" NOT NULL,
    "clientId" TEXT NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "secretOid" BIGINT,
    "configOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "serverOid" BIGINT NOT NULL,
    "functionServerOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DelegatedOAuthConnection_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "DelegatedOAuthConnectionEvent" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "DelegatedOAuthConnectionEventType" NOT NULL,
    "discriminator" TEXT,
    "metadata" JSONB,
    "connectionOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DelegatedOAuthConnectionEvent_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "DelegatedOAuthConnectionSetup" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "DelegatedOAuthConnectionSetupStatus" NOT NULL,
    "stateIdentifier" TEXT,
    "authConfigValue" JSONB NOT NULL,
    "authStateValue" JSONB NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "connectionOid" BIGINT NOT NULL,
    "authTokenOid" BIGINT,
    "authConfigOid" BIGINT,
    "tenantOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DelegatedOAuthConnectionSetup_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "DelegatedOAuthConnectionAuthToken" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "source" "DelegatedOAuthConnectionAuthTokenSource" NOT NULL,
    "authConfigValue" JSONB NOT NULL,
    "authStateValue" JSONB NOT NULL,
    "scope" TEXT,
    "tokenType" TEXT,
    "idToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "firstErrorAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "errorDisabledAt" TIMESTAMP(3),
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "secretOid" BIGINT NOT NULL,
    "connectionOid" BIGINT,
    "configOid" BIGINT NOT NULL,
    "serverOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "refreshedAt" TIMESTAMP(3),

    CONSTRAINT "DelegatedOAuthConnectionAuthToken_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "DelegatedOAuthConnectionAuthTokenError" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "authTokenOid" BIGINT NOT NULL,
    "errorCode" TEXT NOT NULL,
    "errorMessage" TEXT,
    "functionInvocationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DelegatedOAuthConnectionAuthTokenError_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "RemoteOAuthDiscoveryDocument" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "providerName" TEXT NOT NULL,
    "providerUrl" TEXT NOT NULL,
    "discoveryUrl" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "configHash" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "refreshedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RemoteOAuthDiscoveryDocument_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "RemoteOAuthAutoRegistration" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientSecret" TEXT,
    "autoRegistrationName" TEXT,
    "registrationClientUri" TEXT,
    "registrationAccessToken" TEXT,
    "clientSecretExpiresAt" TIMESTAMP(3),
    "data" JSONB NOT NULL,
    "discoveryDocumentOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RemoteOAuthAutoRegistration_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "RemoteOAuthRegistrationError" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "endpoint" TEXT NOT NULL,
    "configOid" BIGINT,
    "connectionOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RemoteOAuthRegistrationError_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "RemoteOAuthConfig" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "discoverStatus" "RemoteOAuthConfigDiscoveryStatus" NOT NULL DEFAULT 'manual',
    "name" TEXT,
    "config" JSONB NOT NULL,
    "providerName" TEXT NOT NULL,
    "providerUrl" TEXT NOT NULL,
    "discoveryUrl" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "scopes" TEXT[],
    "serverOid" BIGINT NOT NULL,
    "oauthDiscoveryDocumentOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastDiscoveredAt" TIMESTAMP(3),

    CONSTRAINT "RemoteOAuthConfig_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "RemoteOAuthConnection" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "RemoteOAuthConnectionStatus" NOT NULL,
    "discoveryStatus" "RemoteOAuthConnectionDiscoveryStatus" NOT NULL,
    "clientId" TEXT,
    "scopes" TEXT[],
    "secretOid" BIGINT,
    "providerName" TEXT NOT NULL,
    "providerUrl" TEXT NOT NULL,
    "discoveryUrl" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "configOid" BIGINT NOT NULL,
    "registrationOid" BIGINT,
    "tenantOid" BIGINT NOT NULL,
    "serverOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RemoteOAuthConnection_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "RemoteOAuthConnectionEvent" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "RemoteOAuthConnectionEventType" NOT NULL,
    "discriminator" TEXT,
    "metadata" JSONB,
    "connectionOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RemoteOAuthConnectionEvent_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "RemoteOAuthConnectionProfile" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "sub" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "rawProfile" JSONB,
    "connectionOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RemoteOAuthConnectionProfile_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "RemoteOAuthConnectionSetup" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "stateIdentifier" TEXT,
    "status" "RemoteOAuthConnectionSetupStatus" NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "codeVerifier" TEXT,
    "connectionOid" BIGINT NOT NULL,
    "authTokenOid" BIGINT,
    "authConfigOid" BIGINT,
    "profileOid" BIGINT,
    "tenantOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RemoteOAuthConnectionSetup_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "RemoteOAuthConnectionAuthToken" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "source" "RemoteOAuthConnectionAuthTokenSource" NOT NULL,
    "scope" TEXT,
    "tokenType" TEXT,
    "idToken" TEXT,
    "secretOid" BIGINT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "connectionProfileOid" BIGINT,
    "connectionOid" BIGINT,
    "configOid" BIGINT NOT NULL,
    "serverOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "firstErrorAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "errorDisabledAt" TIMESTAMP(3),
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "refreshedAt" TIMESTAMP(3),

    CONSTRAINT "RemoteOAuthConnectionAuthToken_pkey" PRIMARY KEY ("oid")
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
CREATE TABLE "Server" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "ServerType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "draftConfigSchema" JSONB NOT NULL,
    "draftConfigTransformer" TEXT NOT NULL,
    "draftRemoteUrl" TEXT,
    "draftRemoteProtocol" "ServerRemoteProtocol",
    "draftRepositoryTagOid" BIGINT,
    "tenantOid" BIGINT,
    "currentVersionOid" BIGINT,
    "remoteOauthConfigOid" BIGINT,
    "delegatedOauthConfigOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Server_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ServerVersion" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "identifier" TEXT NOT NULL,
    "configSchema" JSONB NOT NULL,
    "configTransformer" TEXT NOT NULL,
    "remoteUrl" TEXT,
    "remoteProtocol" "ServerRemoteProtocol",
    "serverOid" BIGINT NOT NULL,
    "repositoryTagOid" BIGINT,
    "repositoryVersionOid" BIGINT,
    "functionServerOid" BIGINT,
    "deploymentOid" BIGINT NOT NULL,
    "tenantOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServerVersion_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Tenant" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "functionBayTenantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("oid")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConnectionLogsStorageBucket_bucket_key" ON "ConnectionLogsStorageBucket"("bucket");

-- CreateIndex
CREATE UNIQUE INDEX "ChangeNotification_id_key" ON "ChangeNotification"("id");

-- CreateIndex
CREATE INDEX "ChangeNotification_type_idx" ON "ChangeNotification"("type");

-- CreateIndex
CREATE UNIQUE INDEX "ContainerRegistry_id_key" ON "ContainerRegistry"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ContainerRegistry_identifier_key" ON "ContainerRegistry"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "ContainerRepository_id_key" ON "ContainerRepository"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ContainerRepository_identifier_key" ON "ContainerRepository"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "ContainerRepositoryTag_id_key" ON "ContainerRepositoryTag"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ContainerRepositoryTag_repositoryOid_identifier_key" ON "ContainerRepositoryTag"("repositoryOid", "identifier");

-- CreateIndex
CREATE UNIQUE INDEX "ContainerRepositoryVersion_id_key" ON "ContainerRepositoryVersion"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ContainerRepositoryVersion_repositoryOid_digest_key" ON "ContainerRepositoryVersion"("repositoryOid", "digest");

-- CreateIndex
CREATE UNIQUE INDEX "ContainerRepositoryTagVersion_repositoryVersionOid_reposito_key" ON "ContainerRepositoryTagVersion"("repositoryVersionOid", "repositoryTagOid");

-- CreateIndex
CREATE UNIQUE INDEX "ContainerRepositoryTagDiscoveryError_id_key" ON "ContainerRepositoryTagDiscoveryError"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ServerDeployment_id_key" ON "ServerDeployment"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ServerDeploymentStep_id_key" ON "ServerDeploymentStep"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ServerDiscovery_id_key" ON "ServerDiscovery"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ServerSpecification_id_key" ON "ServerSpecification"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ServerSpecification_serverOid_hash_key" ON "ServerSpecification"("serverOid", "hash");

-- CreateIndex
CREATE UNIQUE INDEX "DeploymentProvider_id_key" ON "DeploymentProvider"("id");

-- CreateIndex
CREATE UNIQUE INDEX "DeploymentProvider_identifier_key" ON "DeploymentProvider"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "FunctionServer_id_key" ON "FunctionServer"("id");

-- CreateIndex
CREATE UNIQUE INDEX "UpcomingFunctionServer_id_key" ON "UpcomingFunctionServer"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ServerConfig_id_key" ON "ServerConfig"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ServerAuthConfig_id_key" ON "ServerAuthConfig"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ServerAuthConfigExport_id_key" ON "ServerAuthConfigExport"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ServerConnection_id_key" ON "ServerConnection"("id");

-- CreateIndex
CREATE UNIQUE INDEX "NetworkingRuleset_id_key" ON "NetworkingRuleset"("id");

-- CreateIndex
CREATE UNIQUE INDEX "GlobalNetworkingRuleset_id_key" ON "GlobalNetworkingRuleset"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ServerOAuthCredentials_id_key" ON "ServerOAuthCredentials"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ServerOAuthCredentials_remoteConnectionOid_key" ON "ServerOAuthCredentials"("remoteConnectionOid");

-- CreateIndex
CREATE UNIQUE INDEX "ServerOAuthCredentials_delegatedConnectionOid_key" ON "ServerOAuthCredentials"("delegatedConnectionOid");

-- CreateIndex
CREATE INDEX "ServerOAuthCredentials_isDefault_idx" ON "ServerOAuthCredentials"("isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "ServerOAuthSetup_id_key" ON "ServerOAuthSetup"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ServerOAuthSetup_remoteOAuthConnectionSetupOid_key" ON "ServerOAuthSetup"("remoteOAuthConnectionSetupOid");

-- CreateIndex
CREATE UNIQUE INDEX "ServerOAuthSetup_delegatedOAuthConnectionSetupOid_key" ON "ServerOAuthSetup"("delegatedOAuthConnectionSetupOid");

-- CreateIndex
CREATE UNIQUE INDEX "DelegatedOAuthConfig_id_key" ON "DelegatedOAuthConfig"("id");

-- CreateIndex
CREATE UNIQUE INDEX "DelegatedOAuthConfig_serverOid_key" ON "DelegatedOAuthConfig"("serverOid");

-- CreateIndex
CREATE UNIQUE INDEX "DelegatedOAuthConfig_functionServerOid_key" ON "DelegatedOAuthConfig"("functionServerOid");

-- CreateIndex
CREATE UNIQUE INDEX "DelegatedOAuthConfig_serverOid_authConfigSchemaHash_key" ON "DelegatedOAuthConfig"("serverOid", "authConfigSchemaHash");

-- CreateIndex
CREATE UNIQUE INDEX "DelegatedOAuthConnection_id_key" ON "DelegatedOAuthConnection"("id");

-- CreateIndex
CREATE UNIQUE INDEX "DelegatedOAuthConnectionEvent_id_key" ON "DelegatedOAuthConnectionEvent"("id");

-- CreateIndex
CREATE UNIQUE INDEX "DelegatedOAuthConnectionEvent_connectionOid_type_discrimina_key" ON "DelegatedOAuthConnectionEvent"("connectionOid", "type", "discriminator");

-- CreateIndex
CREATE UNIQUE INDEX "DelegatedOAuthConnectionSetup_id_key" ON "DelegatedOAuthConnectionSetup"("id");

-- CreateIndex
CREATE UNIQUE INDEX "DelegatedOAuthConnectionSetup_stateIdentifier_key" ON "DelegatedOAuthConnectionSetup"("stateIdentifier");

-- CreateIndex
CREATE INDEX "DelegatedOAuthConnectionSetup_status_idx" ON "DelegatedOAuthConnectionSetup"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DelegatedOAuthConnectionAuthToken_id_key" ON "DelegatedOAuthConnectionAuthToken"("id");

-- CreateIndex
CREATE UNIQUE INDEX "DelegatedOAuthConnectionAuthTokenError_id_key" ON "DelegatedOAuthConnectionAuthTokenError"("id");

-- CreateIndex
CREATE UNIQUE INDEX "RemoteOAuthDiscoveryDocument_id_key" ON "RemoteOAuthDiscoveryDocument"("id");

-- CreateIndex
CREATE UNIQUE INDEX "RemoteOAuthDiscoveryDocument_discoveryUrl_key" ON "RemoteOAuthDiscoveryDocument"("discoveryUrl");

-- CreateIndex
CREATE UNIQUE INDEX "RemoteOAuthAutoRegistration_id_key" ON "RemoteOAuthAutoRegistration"("id");

-- CreateIndex
CREATE UNIQUE INDEX "RemoteOAuthRegistrationError_id_key" ON "RemoteOAuthRegistrationError"("id");

-- CreateIndex
CREATE UNIQUE INDEX "RemoteOAuthConfig_id_key" ON "RemoteOAuthConfig"("id");

-- CreateIndex
CREATE UNIQUE INDEX "RemoteOAuthConfig_serverOid_key" ON "RemoteOAuthConfig"("serverOid");

-- CreateIndex
CREATE UNIQUE INDEX "RemoteOAuthConnection_id_key" ON "RemoteOAuthConnection"("id");

-- CreateIndex
CREATE UNIQUE INDEX "RemoteOAuthConnectionEvent_id_key" ON "RemoteOAuthConnectionEvent"("id");

-- CreateIndex
CREATE UNIQUE INDEX "RemoteOAuthConnectionEvent_connectionOid_type_discriminator_key" ON "RemoteOAuthConnectionEvent"("connectionOid", "type", "discriminator");

-- CreateIndex
CREATE UNIQUE INDEX "RemoteOAuthConnectionProfile_id_key" ON "RemoteOAuthConnectionProfile"("id");

-- CreateIndex
CREATE UNIQUE INDEX "RemoteOAuthConnectionProfile_connectionOid_sub_key" ON "RemoteOAuthConnectionProfile"("connectionOid", "sub");

-- CreateIndex
CREATE UNIQUE INDEX "RemoteOAuthConnectionSetup_id_key" ON "RemoteOAuthConnectionSetup"("id");

-- CreateIndex
CREATE UNIQUE INDEX "RemoteOAuthConnectionSetup_stateIdentifier_key" ON "RemoteOAuthConnectionSetup"("stateIdentifier");

-- CreateIndex
CREATE INDEX "RemoteOAuthConnectionSetup_status_idx" ON "RemoteOAuthConnectionSetup"("status");

-- CreateIndex
CREATE UNIQUE INDEX "RemoteOAuthConnectionAuthToken_id_key" ON "RemoteOAuthConnectionAuthToken"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Secret_id_key" ON "Secret"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Server_id_key" ON "Server"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ServerVersion_id_key" ON "ServerVersion"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ServerVersion_deploymentOid_key" ON "ServerVersion"("deploymentOid");

-- CreateIndex
CREATE UNIQUE INDEX "ServerVersion_serverOid_identifier_key" ON "ServerVersion"("serverOid", "identifier");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_id_key" ON "Tenant"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_identifier_key" ON "Tenant"("identifier");

-- AddForeignKey
ALTER TABLE "ChangeNotification" ADD CONSTRAINT "ChangeNotification_serverOid_fkey" FOREIGN KEY ("serverOid") REFERENCES "Server"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeNotification" ADD CONSTRAINT "ChangeNotification_serverVersionOid_fkey" FOREIGN KEY ("serverVersionOid") REFERENCES "ServerVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContainerRegistry" ADD CONSTRAINT "ContainerRegistry_secretOid_fkey" FOREIGN KEY ("secretOid") REFERENCES "Secret"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContainerRegistry" ADD CONSTRAINT "ContainerRegistry_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContainerRepository" ADD CONSTRAINT "ContainerRepository_registryOid_fkey" FOREIGN KEY ("registryOid") REFERENCES "ContainerRegistry"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContainerRepository" ADD CONSTRAINT "ContainerRepository_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContainerRepositoryTag" ADD CONSTRAINT "ContainerRepositoryTag_currentVersionOid_fkey" FOREIGN KEY ("currentVersionOid") REFERENCES "ContainerRepositoryVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContainerRepositoryTag" ADD CONSTRAINT "ContainerRepositoryTag_repositoryOid_fkey" FOREIGN KEY ("repositoryOid") REFERENCES "ContainerRepository"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContainerRepositoryTag" ADD CONSTRAINT "ContainerRepositoryTag_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContainerRepositoryTag" ADD CONSTRAINT "ContainerRepositoryTag_lastDiscoveryErrorOid_fkey" FOREIGN KEY ("lastDiscoveryErrorOid") REFERENCES "ContainerRepositoryTagDiscoveryError"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContainerRepositoryVersion" ADD CONSTRAINT "ContainerRepositoryVersion_repositoryOid_fkey" FOREIGN KEY ("repositoryOid") REFERENCES "ContainerRepository"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContainerRepositoryVersion" ADD CONSTRAINT "ContainerRepositoryVersion_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContainerRepositoryTagVersion" ADD CONSTRAINT "ContainerRepositoryTagVersion_repositoryVersionOid_fkey" FOREIGN KEY ("repositoryVersionOid") REFERENCES "ContainerRepositoryVersion"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContainerRepositoryTagVersion" ADD CONSTRAINT "ContainerRepositoryTagVersion_repositoryTagOid_fkey" FOREIGN KEY ("repositoryTagOid") REFERENCES "ContainerRepositoryTag"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContainerRepositoryTagDiscoveryError" ADD CONSTRAINT "ContainerRepositoryTagDiscoveryError_repositoryTagOid_fkey" FOREIGN KEY ("repositoryTagOid") REFERENCES "ContainerRepositoryTag"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerDeployment" ADD CONSTRAINT "ServerDeployment_serverOid_fkey" FOREIGN KEY ("serverOid") REFERENCES "Server"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerDeployment" ADD CONSTRAINT "ServerDeployment_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerDeployment" ADD CONSTRAINT "ServerDeployment_functionServerOid_fkey" FOREIGN KEY ("functionServerOid") REFERENCES "FunctionServer"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerDeploymentStep" ADD CONSTRAINT "ServerDeploymentStep_deploymentOid_fkey" FOREIGN KEY ("deploymentOid") REFERENCES "ServerDeployment"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerDiscovery" ADD CONSTRAINT "ServerDiscovery_connectionOid_fkey" FOREIGN KEY ("connectionOid") REFERENCES "ServerConnection"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerDiscovery" ADD CONSTRAINT "ServerDiscovery_specificationOid_fkey" FOREIGN KEY ("specificationOid") REFERENCES "ServerSpecification"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerDiscovery" ADD CONSTRAINT "ServerDiscovery_serverConfigOid_fkey" FOREIGN KEY ("serverConfigOid") REFERENCES "ServerConfig"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerDiscovery" ADD CONSTRAINT "ServerDiscovery_serverAuthConfigOid_fkey" FOREIGN KEY ("serverAuthConfigOid") REFERENCES "ServerAuthConfig"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerDiscovery" ADD CONSTRAINT "ServerDiscovery_serverVersionOid_fkey" FOREIGN KEY ("serverVersionOid") REFERENCES "ServerVersion"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerDiscovery" ADD CONSTRAINT "ServerDiscovery_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerSpecification" ADD CONSTRAINT "ServerSpecification_serverOid_fkey" FOREIGN KEY ("serverOid") REFERENCES "Server"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunctionServer" ADD CONSTRAINT "FunctionServer_delegatedOauthConfigOid_fkey" FOREIGN KEY ("delegatedOauthConfigOid") REFERENCES "DelegatedOAuthConfig"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunctionServer" ADD CONSTRAINT "FunctionServer_serverOid_fkey" FOREIGN KEY ("serverOid") REFERENCES "Server"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunctionServer" ADD CONSTRAINT "FunctionServer_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "DeploymentProvider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UpcomingFunctionServer" ADD CONSTRAINT "UpcomingFunctionServer_serverOid_fkey" FOREIGN KEY ("serverOid") REFERENCES "Server"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UpcomingFunctionServer" ADD CONSTRAINT "UpcomingFunctionServer_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunctionServerInvocation" ADD CONSTRAINT "FunctionServerInvocation_connectionOid_fkey" FOREIGN KEY ("connectionOid") REFERENCES "ServerConnection"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunctionServerInvocation" ADD CONSTRAINT "FunctionServerInvocation_functionServerOid_fkey" FOREIGN KEY ("functionServerOid") REFERENCES "FunctionServer"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunctionServerInvocation" ADD CONSTRAINT "FunctionServerInvocation_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerConfig" ADD CONSTRAINT "ServerConfig_secretOid_fkey" FOREIGN KEY ("secretOid") REFERENCES "Secret"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerConfig" ADD CONSTRAINT "ServerConfig_serverOid_fkey" FOREIGN KEY ("serverOid") REFERENCES "Server"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerConfig" ADD CONSTRAINT "ServerConfig_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerAuthConfig" ADD CONSTRAINT "ServerAuthConfig_serverOid_fkey" FOREIGN KEY ("serverOid") REFERENCES "Server"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerAuthConfig" ADD CONSTRAINT "ServerAuthConfig_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerAuthConfig" ADD CONSTRAINT "ServerAuthConfig_credentialsOid_fkey" FOREIGN KEY ("credentialsOid") REFERENCES "ServerOAuthCredentials"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerAuthConfig" ADD CONSTRAINT "ServerAuthConfig_remoteOAuthConnectionOid_fkey" FOREIGN KEY ("remoteOAuthConnectionOid") REFERENCES "RemoteOAuthConnection"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerAuthConfig" ADD CONSTRAINT "ServerAuthConfig_remoteOAuthConnectionAuthTokenOid_fkey" FOREIGN KEY ("remoteOAuthConnectionAuthTokenOid") REFERENCES "RemoteOAuthConnectionAuthToken"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerAuthConfig" ADD CONSTRAINT "ServerAuthConfig_delegatedOAuthConnectionOid_fkey" FOREIGN KEY ("delegatedOAuthConnectionOid") REFERENCES "DelegatedOAuthConnection"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerAuthConfig" ADD CONSTRAINT "ServerAuthConfig_delegatedOAuthConnectionAuthTokenOid_fkey" FOREIGN KEY ("delegatedOAuthConnectionAuthTokenOid") REFERENCES "DelegatedOAuthConnectionAuthToken"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerAuthConfigExport" ADD CONSTRAINT "ServerAuthConfigExport_serverAuthConfigOid_fkey" FOREIGN KEY ("serverAuthConfigOid") REFERENCES "ServerAuthConfig"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerConnection" ADD CONSTRAINT "ServerConnection_logBucketOid_fkey" FOREIGN KEY ("logBucketOid") REFERENCES "ConnectionLogsStorageBucket"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerConnection" ADD CONSTRAINT "ServerConnection_serverConfigOid_fkey" FOREIGN KEY ("serverConfigOid") REFERENCES "ServerConfig"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerConnection" ADD CONSTRAINT "ServerConnection_serverVersionOid_fkey" FOREIGN KEY ("serverVersionOid") REFERENCES "ServerVersion"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerConnection" ADD CONSTRAINT "ServerConnection_serverAuthConfigOid_fkey" FOREIGN KEY ("serverAuthConfigOid") REFERENCES "ServerAuthConfig"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerConnection" ADD CONSTRAINT "ServerConnection_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerConnectionNetworkRule" ADD CONSTRAINT "ServerConnectionNetworkRule_serverConnectionOid_fkey" FOREIGN KEY ("serverConnectionOid") REFERENCES "ServerConnection"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerConnectionNetworkRule" ADD CONSTRAINT "ServerConnectionNetworkRule_networkingRulesetOid_fkey" FOREIGN KEY ("networkingRulesetOid") REFERENCES "NetworkingRuleset"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerConnectionLogsTemp" ADD CONSTRAINT "ServerConnectionLogsTemp_serverConnectionOid_fkey" FOREIGN KEY ("serverConnectionOid") REFERENCES "ServerConnection"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkingRuleset" ADD CONSTRAINT "NetworkingRuleset_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerOAuthCredentials" ADD CONSTRAINT "ServerOAuthCredentials_remoteConnectionOid_fkey" FOREIGN KEY ("remoteConnectionOid") REFERENCES "RemoteOAuthConnection"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerOAuthCredentials" ADD CONSTRAINT "ServerOAuthCredentials_delegatedConnectionOid_fkey" FOREIGN KEY ("delegatedConnectionOid") REFERENCES "DelegatedOAuthConnection"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerOAuthCredentials" ADD CONSTRAINT "ServerOAuthCredentials_serverOid_fkey" FOREIGN KEY ("serverOid") REFERENCES "Server"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerOAuthCredentials" ADD CONSTRAINT "ServerOAuthCredentials_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerOAuthSetup" ADD CONSTRAINT "ServerOAuthSetup_credentialsOid_fkey" FOREIGN KEY ("credentialsOid") REFERENCES "ServerOAuthCredentials"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerOAuthSetup" ADD CONSTRAINT "ServerOAuthSetup_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerOAuthSetup" ADD CONSTRAINT "ServerOAuthSetup_serverOid_fkey" FOREIGN KEY ("serverOid") REFERENCES "Server"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerOAuthSetup" ADD CONSTRAINT "ServerOAuthSetup_authConfigOid_fkey" FOREIGN KEY ("authConfigOid") REFERENCES "ServerAuthConfig"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerOAuthSetup" ADD CONSTRAINT "ServerOAuthSetup_remoteOAuthConnectionSetupOid_fkey" FOREIGN KEY ("remoteOAuthConnectionSetupOid") REFERENCES "RemoteOAuthConnectionSetup"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerOAuthSetup" ADD CONSTRAINT "ServerOAuthSetup_delegatedOAuthConnectionSetupOid_fkey" FOREIGN KEY ("delegatedOAuthConnectionSetupOid") REFERENCES "DelegatedOAuthConnectionSetup"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DelegatedOAuthConfig" ADD CONSTRAINT "DelegatedOAuthConfig_serverOid_fkey" FOREIGN KEY ("serverOid") REFERENCES "Server"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DelegatedOAuthConfig" ADD CONSTRAINT "DelegatedOAuthConfig_functionServerOid_fkey" FOREIGN KEY ("functionServerOid") REFERENCES "FunctionServer"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DelegatedOAuthConnection" ADD CONSTRAINT "DelegatedOAuthConnection_secretOid_fkey" FOREIGN KEY ("secretOid") REFERENCES "Secret"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DelegatedOAuthConnection" ADD CONSTRAINT "DelegatedOAuthConnection_configOid_fkey" FOREIGN KEY ("configOid") REFERENCES "DelegatedOAuthConfig"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DelegatedOAuthConnection" ADD CONSTRAINT "DelegatedOAuthConnection_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DelegatedOAuthConnection" ADD CONSTRAINT "DelegatedOAuthConnection_serverOid_fkey" FOREIGN KEY ("serverOid") REFERENCES "Server"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DelegatedOAuthConnection" ADD CONSTRAINT "DelegatedOAuthConnection_functionServerOid_fkey" FOREIGN KEY ("functionServerOid") REFERENCES "FunctionServer"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DelegatedOAuthConnectionEvent" ADD CONSTRAINT "DelegatedOAuthConnectionEvent_connectionOid_fkey" FOREIGN KEY ("connectionOid") REFERENCES "DelegatedOAuthConnection"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DelegatedOAuthConnectionSetup" ADD CONSTRAINT "DelegatedOAuthConnectionSetup_connectionOid_fkey" FOREIGN KEY ("connectionOid") REFERENCES "DelegatedOAuthConnection"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DelegatedOAuthConnectionSetup" ADD CONSTRAINT "DelegatedOAuthConnectionSetup_authTokenOid_fkey" FOREIGN KEY ("authTokenOid") REFERENCES "DelegatedOAuthConnectionAuthToken"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DelegatedOAuthConnectionSetup" ADD CONSTRAINT "DelegatedOAuthConnectionSetup_authConfigOid_fkey" FOREIGN KEY ("authConfigOid") REFERENCES "ServerAuthConfig"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DelegatedOAuthConnectionSetup" ADD CONSTRAINT "DelegatedOAuthConnectionSetup_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DelegatedOAuthConnectionAuthToken" ADD CONSTRAINT "DelegatedOAuthConnectionAuthToken_secretOid_fkey" FOREIGN KEY ("secretOid") REFERENCES "Secret"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DelegatedOAuthConnectionAuthToken" ADD CONSTRAINT "DelegatedOAuthConnectionAuthToken_connectionOid_fkey" FOREIGN KEY ("connectionOid") REFERENCES "DelegatedOAuthConnection"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DelegatedOAuthConnectionAuthToken" ADD CONSTRAINT "DelegatedOAuthConnectionAuthToken_configOid_fkey" FOREIGN KEY ("configOid") REFERENCES "DelegatedOAuthConfig"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DelegatedOAuthConnectionAuthToken" ADD CONSTRAINT "DelegatedOAuthConnectionAuthToken_serverOid_fkey" FOREIGN KEY ("serverOid") REFERENCES "Server"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DelegatedOAuthConnectionAuthToken" ADD CONSTRAINT "DelegatedOAuthConnectionAuthToken_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DelegatedOAuthConnectionAuthTokenError" ADD CONSTRAINT "DelegatedOAuthConnectionAuthTokenError_authTokenOid_fkey" FOREIGN KEY ("authTokenOid") REFERENCES "DelegatedOAuthConnectionAuthToken"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemoteOAuthAutoRegistration" ADD CONSTRAINT "RemoteOAuthAutoRegistration_discoveryDocumentOid_fkey" FOREIGN KEY ("discoveryDocumentOid") REFERENCES "RemoteOAuthDiscoveryDocument"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemoteOAuthRegistrationError" ADD CONSTRAINT "RemoteOAuthRegistrationError_configOid_fkey" FOREIGN KEY ("configOid") REFERENCES "RemoteOAuthConfig"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemoteOAuthRegistrationError" ADD CONSTRAINT "RemoteOAuthRegistrationError_connectionOid_fkey" FOREIGN KEY ("connectionOid") REFERENCES "RemoteOAuthConnection"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemoteOAuthConfig" ADD CONSTRAINT "RemoteOAuthConfig_serverOid_fkey" FOREIGN KEY ("serverOid") REFERENCES "Server"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemoteOAuthConfig" ADD CONSTRAINT "RemoteOAuthConfig_oauthDiscoveryDocumentOid_fkey" FOREIGN KEY ("oauthDiscoveryDocumentOid") REFERENCES "RemoteOAuthDiscoveryDocument"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemoteOAuthConnection" ADD CONSTRAINT "RemoteOAuthConnection_secretOid_fkey" FOREIGN KEY ("secretOid") REFERENCES "Secret"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemoteOAuthConnection" ADD CONSTRAINT "RemoteOAuthConnection_configOid_fkey" FOREIGN KEY ("configOid") REFERENCES "RemoteOAuthConfig"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemoteOAuthConnection" ADD CONSTRAINT "RemoteOAuthConnection_registrationOid_fkey" FOREIGN KEY ("registrationOid") REFERENCES "RemoteOAuthAutoRegistration"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemoteOAuthConnection" ADD CONSTRAINT "RemoteOAuthConnection_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemoteOAuthConnection" ADD CONSTRAINT "RemoteOAuthConnection_serverOid_fkey" FOREIGN KEY ("serverOid") REFERENCES "Server"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemoteOAuthConnectionEvent" ADD CONSTRAINT "RemoteOAuthConnectionEvent_connectionOid_fkey" FOREIGN KEY ("connectionOid") REFERENCES "RemoteOAuthConnection"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemoteOAuthConnectionProfile" ADD CONSTRAINT "RemoteOAuthConnectionProfile_connectionOid_fkey" FOREIGN KEY ("connectionOid") REFERENCES "RemoteOAuthConnection"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemoteOAuthConnectionProfile" ADD CONSTRAINT "RemoteOAuthConnectionProfile_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemoteOAuthConnectionSetup" ADD CONSTRAINT "RemoteOAuthConnectionSetup_connectionOid_fkey" FOREIGN KEY ("connectionOid") REFERENCES "RemoteOAuthConnection"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemoteOAuthConnectionSetup" ADD CONSTRAINT "RemoteOAuthConnectionSetup_authTokenOid_fkey" FOREIGN KEY ("authTokenOid") REFERENCES "RemoteOAuthConnectionAuthToken"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemoteOAuthConnectionSetup" ADD CONSTRAINT "RemoteOAuthConnectionSetup_authConfigOid_fkey" FOREIGN KEY ("authConfigOid") REFERENCES "ServerAuthConfig"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemoteOAuthConnectionSetup" ADD CONSTRAINT "RemoteOAuthConnectionSetup_profileOid_fkey" FOREIGN KEY ("profileOid") REFERENCES "RemoteOAuthConnectionProfile"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemoteOAuthConnectionSetup" ADD CONSTRAINT "RemoteOAuthConnectionSetup_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemoteOAuthConnectionAuthToken" ADD CONSTRAINT "RemoteOAuthConnectionAuthToken_secretOid_fkey" FOREIGN KEY ("secretOid") REFERENCES "Secret"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemoteOAuthConnectionAuthToken" ADD CONSTRAINT "RemoteOAuthConnectionAuthToken_connectionProfileOid_fkey" FOREIGN KEY ("connectionProfileOid") REFERENCES "RemoteOAuthConnectionProfile"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemoteOAuthConnectionAuthToken" ADD CONSTRAINT "RemoteOAuthConnectionAuthToken_connectionOid_fkey" FOREIGN KEY ("connectionOid") REFERENCES "RemoteOAuthConnection"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemoteOAuthConnectionAuthToken" ADD CONSTRAINT "RemoteOAuthConnectionAuthToken_configOid_fkey" FOREIGN KEY ("configOid") REFERENCES "RemoteOAuthConfig"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemoteOAuthConnectionAuthToken" ADD CONSTRAINT "RemoteOAuthConnectionAuthToken_serverOid_fkey" FOREIGN KEY ("serverOid") REFERENCES "Server"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemoteOAuthConnectionAuthToken" ADD CONSTRAINT "RemoteOAuthConnectionAuthToken_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Secret" ADD CONSTRAINT "Secret_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Server" ADD CONSTRAINT "Server_draftRepositoryTagOid_fkey" FOREIGN KEY ("draftRepositoryTagOid") REFERENCES "ContainerRepositoryTag"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Server" ADD CONSTRAINT "Server_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Server" ADD CONSTRAINT "Server_currentVersionOid_fkey" FOREIGN KEY ("currentVersionOid") REFERENCES "ServerVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Server" ADD CONSTRAINT "Server_remoteOauthConfigOid_fkey" FOREIGN KEY ("remoteOauthConfigOid") REFERENCES "RemoteOAuthConfig"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Server" ADD CONSTRAINT "Server_delegatedOauthConfigOid_fkey" FOREIGN KEY ("delegatedOauthConfigOid") REFERENCES "DelegatedOAuthConfig"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerVersion" ADD CONSTRAINT "ServerVersion_serverOid_fkey" FOREIGN KEY ("serverOid") REFERENCES "Server"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerVersion" ADD CONSTRAINT "ServerVersion_repositoryTagOid_fkey" FOREIGN KEY ("repositoryTagOid") REFERENCES "ContainerRepositoryTag"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerVersion" ADD CONSTRAINT "ServerVersion_repositoryVersionOid_fkey" FOREIGN KEY ("repositoryVersionOid") REFERENCES "ContainerRepositoryVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerVersion" ADD CONSTRAINT "ServerVersion_functionServerOid_fkey" FOREIGN KEY ("functionServerOid") REFERENCES "FunctionServer"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerVersion" ADD CONSTRAINT "ServerVersion_deploymentOid_fkey" FOREIGN KEY ("deploymentOid") REFERENCES "ServerDeployment"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerVersion" ADD CONSTRAINT "ServerVersion_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

