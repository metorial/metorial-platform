-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('active', 'deleting');

-- CreateEnum
CREATE TYPE "AppMode" AS ENUM ('standard', 'horizon');

-- CreateEnum
CREATE TYPE "OAuthProviderType" AS ENUM ('github', 'google');

-- CreateEnum
CREATE TYPE "AuthIntentType" AS ENUM ('email_code', 'oauth', 'password');

-- CreateEnum
CREATE TYPE "AuthIntentIdentifier" AS ENUM ('email');

-- CreateEnum
CREATE TYPE "AuthIntentStepType" AS ENUM ('email_code', 'password', 'two_factor');

-- CreateEnum
CREATE TYPE "AuthIntentVerificationAttemptStatus" AS ENUM ('success', 'failure');

-- CreateEnum
CREATE TYPE "AuthAttemptStatus" AS ENUM ('pending', 'consumed');

-- CreateEnum
CREATE TYPE "AuthLoginMethod" AS ENUM ('email', 'oauth', 'sso', 'password');

-- CreateEnum
CREATE TYPE "AuthBlockIdentifierType" AS ENUM ('email', 'ip');

-- CreateEnum
CREATE TYPE "SsoAuthStatus" AS ENUM ('pending', 'completed');

-- CreateEnum
CREATE TYPE "SsoAuthPurpose" AS ENUM ('authentication', 'connection_test', 'elevation');

-- CreateEnum
CREATE TYPE "SsoConnectionProviderType" AS ENUM ('saml', 'oidc');

-- CreateEnum
CREATE TYPE "SsoConnectionStatus" AS ENUM ('active', 'disabled');

-- CreateEnum
CREATE TYPE "SsoDirectoryStatus" AS ENUM ('active', 'disabled');

-- CreateEnum
CREATE TYPE "SsoImportedDelegationStatus" AS ENUM ('active', 'disabled');

-- CreateEnum
CREATE TYPE "SsoDelegationTokenType" AS ENUM ('identity', 'metadata');

-- CreateEnum
CREATE TYPE "SsoUserProfileStatus" AS ENUM ('active', 'deprovisioned');

-- CreateEnum
CREATE TYPE "SsoConnectionSetupStatus" AS ENUM ('pending', 'completed');

-- CreateEnum
CREATE TYPE "SsoTenantStatus" AS ENUM ('pending', 'completed', 'disabled');

-- CreateEnum
CREATE TYPE "SsoTenantEnrollment" AS ENUM ('app', 'account', 'disabled');

-- CreateEnum
CREATE TYPE "SsoTestStatus" AS ENUM ('pending', 'completed');

-- CreateEnum
CREATE TYPE "SsoUserStatus" AS ENUM ('active', 'deprovisioned');

-- CreateEnum
CREATE TYPE "UserTwoFactorMethod" AS ENUM ('totp', 'passkey');

-- CreateEnum
CREATE TYPE "UserTwoFactorSetupStatus" AS ENUM ('pending', 'ready', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('user', 'system');

-- CreateEnum
CREATE TYPE "UserOwner" AS ENUM ('self', 'tenant');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'deleted');

-- CreateEnum
CREATE TYPE "UserSignupMethod" AS ENUM ('unknown', 'email', 'oauth', 'sso');

-- CreateTable
CREATE TABLE "Account" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "AccountStatus" NOT NULL DEFAULT 'active',
    "allowEmailLogin" BOOLEAN NOT NULL DEFAULT true,
    "allowSocialLogin" BOOLEAN NOT NULL DEFAULT true,
    "appOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "AccountDomain" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "appOid" BIGINT NOT NULL,
    "accountOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountDomain_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "AccountDomainSsoTenant" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "domainOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountDomainSsoTenant_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "AccountDomainSsoConnection" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "domainOid" BIGINT NOT NULL,
    "connectionOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountDomainSsoConnection_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Admin" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "AdminSession" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "clientSecret" TEXT NOT NULL,
    "adminOid" BIGINT NOT NULL,
    "ip" TEXT,
    "ua" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "AccessGroup" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "appOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessGroup_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "AccessGroupRule" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "accessGroupOid" BIGINT NOT NULL,
    "type" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessGroupRule_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "AccessGroupAssignment" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "accessGroupOid" BIGINT NOT NULL,
    "appOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessGroupAssignment_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "App" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "slug" TEXT,
    "mode" "AppMode" NOT NULL DEFAULT 'standard',
    "hasTerms" BOOLEAN NOT NULL DEFAULT true,
    "isSessionless" BOOLEAN NOT NULL DEFAULT false,
    "disableEmailAuth" BOOLEAN NOT NULL DEFAULT false,
    "defaultRedirectUrl" TEXT NOT NULL,
    "redirectDomains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "defaultTenantOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "App_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SyncListener" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "callbackUrl" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "eventTypes" TEXT[] DEFAULT ARRAY['user.changed']::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncListener_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "AppOAuthProvider" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "appOid" BIGINT NOT NULL,
    "provider" "OAuthProviderType" NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientSecret" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppOAuthProvider_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Tenant" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "appOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "appOid" BIGINT NOT NULL,
    "type" TEXT NOT NULL,
    "userOid" BIGINT,
    "ip" TEXT,
    "ua" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "AuthIntent" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "clientSecret" TEXT NOT NULL,
    "type" "AuthIntentType" NOT NULL,
    "ua" TEXT,
    "ip" TEXT NOT NULL,
    "redirectUrl" TEXT NOT NULL,
    "identifierType" "AuthIntentIdentifier" NOT NULL,
    "identifier" TEXT NOT NULL,
    "captchaVerifiedAt" TIMESTAMP(3),
    "passwordVersion" TEXT,
    "twoFactorRevision" INTEGER,
    "userOid" BIGINT,
    "userIdentityOid" BIGINT,
    "deviceOid" BIGINT NOT NULL,
    "appOid" BIGINT NOT NULL,
    "accountOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),

    CONSTRAINT "AuthIntent_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "AuthIntentStep" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "type" "AuthIntentStepType" NOT NULL,
    "email" TEXT,
    "challenge" TEXT,
    "challengeExpiresAt" TIMESTAMP(3),
    "authIntentOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3),

    CONSTRAINT "AuthIntentStep_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "AuthIntentVerificationAttempt" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "AuthIntentVerificationAttemptStatus" NOT NULL,
    "method" "AuthIntentStepType" NOT NULL DEFAULT 'email_code',
    "authIntentOid" BIGINT NOT NULL,
    "stepId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthIntentVerificationAttempt_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "AuthIntentCode" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "authIntentOid" BIGINT NOT NULL,
    "stepOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthIntentCode_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "AuthAttempt" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "clientSecret" TEXT NOT NULL,
    "status" "AuthAttemptStatus" NOT NULL,
    "loginMethod" "AuthLoginMethod",
    "authorizationCode" TEXT,
    "redirectUrl" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "ua" TEXT,
    "userOid" BIGINT NOT NULL,
    "deviceOid" BIGINT NOT NULL,
    "appOid" BIGINT NOT NULL,
    "accountOid" BIGINT,
    "authIntentOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthAttempt_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "AuthBlock" (
    "id" UUID NOT NULL,
    "identifierType" "AuthBlockIdentifierType" NOT NULL,
    "identifier" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "blockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "blockedUntil" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthDevice" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "clientSecret" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "ua" TEXT,
    "lastIp" TEXT NOT NULL,
    "lastUa" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3),

    CONSTRAINT "AuthDevice_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "AuthDeviceHistory" (
    "id" BIGINT NOT NULL,
    "ip" TEXT NOT NULL,
    "ua" TEXT,
    "deviceOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthDeviceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthDeviceUserSession" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "deviceOid" BIGINT NOT NULL,
    "userOid" BIGINT NOT NULL,
    "appOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "loggedOutAt" TIMESTAMP(3),
    "lastActiveAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lifecycleOwner" TEXT,
    "lifecycleOwnerSessionId" TEXT,
    "lifecycleOwnerRevision" BIGINT,
    "lifecycleOwnerLogoutUrl" TEXT,
    "lifecycleClaimedAt" TIMESTAMP(3),
    "lifecycleSyncedAt" TIMESTAMP(3),

    CONSTRAINT "AuthDeviceUserSession_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "QueueCheckpoint" (
    "queue" TEXT NOT NULL,
    "processedThrough" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QueueCheckpoint_pkey" PRIMARY KEY ("queue")
);

-- CreateTable
CREATE TABLE "SsoAuth" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "clientSecret" TEXT NOT NULL,
    "status" "SsoAuthStatus" NOT NULL DEFAULT 'pending',
    "purpose" "SsoAuthPurpose" NOT NULL DEFAULT 'authentication',
    "redirectUri" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "codeVerifier" TEXT,
    "email" TEXT,
    "forceAuthn" BOOLEAN NOT NULL DEFAULT false,
    "tenantOid" BIGINT NOT NULL,
    "accountOid" BIGINT,
    "connectionOid" BIGINT,
    "userProfileOid" BIGINT,
    "userOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "SsoAuth_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SsoConnection" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "status" "SsoConnectionStatus" NOT NULL DEFAULT 'active',
    "internalId" TEXT,
    "internalClientId" TEXT,
    "internalClientSecret" TEXT,
    "sourceId" TEXT,
    "importedDelegationOid" BIGINT,
    "providerType" "SsoConnectionProviderType" NOT NULL,
    "providerName" TEXT,
    "name" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SsoConnection_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "AresInstance" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "singletonKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AresInstance_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "RemoteAresInstance" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "remoteId" TEXT NOT NULL,
    "authorizationEndpointUrl" TEXT NOT NULL,
    "tokenUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RemoteAresInstance_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SsoExportedDelegation" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientSecret" TEXT NOT NULL,
    "redirectUri" TEXT,
    "tenantOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SsoExportedDelegation_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SsoImportedDelegation" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SsoImportedDelegationStatus" NOT NULL DEFAULT 'active',
    "clientId" TEXT NOT NULL,
    "clientSecret" TEXT NOT NULL,
    "sourceDelegationId" TEXT NOT NULL,
    "sourceTenantId" TEXT NOT NULL,
    "sourceExternalId" TEXT,
    "remoteInstanceOid" BIGINT NOT NULL,
    "appOid" BIGINT NOT NULL,
    "localExportedDelegationOid" BIGINT,
    "lastSyncAttemptAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "syncFailureCount" INTEGER NOT NULL DEFAULT 0,
    "lastSyncError" TEXT,
    "disabledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SsoImportedDelegation_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SsoDelegationAuthRequest" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "codeChallenge" TEXT NOT NULL,
    "codeChallengeMethod" TEXT NOT NULL,
    "sourceConnectionId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "exportedDelegationOid" BIGINT NOT NULL,
    "ssoAuthOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SsoDelegationAuthRequest_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SsoDelegationAuthorizationCode" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "codeChallenge" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "exportedDelegationOid" BIGINT NOT NULL,
    "connectionOid" BIGINT NOT NULL,
    "userProfileOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SsoDelegationAuthorizationCode_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SsoDelegationToken" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "SsoDelegationTokenType" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "exportedDelegationOid" BIGINT NOT NULL,
    "connectionOid" BIGINT,
    "userProfileOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SsoDelegationToken_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SsoDirectory" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SsoDirectoryStatus" NOT NULL DEFAULT 'active',
    "connectionOid" BIGINT NOT NULL,
    "internalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "scimPath" TEXT NOT NULL,
    "scimEndpoint" TEXT NOT NULL,
    "scimSecret" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SsoDirectory_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SsoDirectoryGroup" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "directoryOid" BIGINT NOT NULL,
    "groupOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SsoDirectoryGroup_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SsoDirectoryRole" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "directoryOid" BIGINT NOT NULL,
    "roleOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SsoDirectoryRole_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SsoScimOperation" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "directoryOid" BIGINT,
    "appOid" BIGINT,
    "internalDirectoryId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "statusCode" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "eventNames" TEXT[],
    "errorMessage" TEXT,
    "query" JSONB,
    "requestBody" JSONB,
    "responseBody" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SsoScimOperation_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SsoConnectionGroup" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "connectionOid" BIGINT NOT NULL,
    "rootGroupOid" BIGINT,
    "value" TEXT NOT NULL,
    "displayName" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SsoConnectionGroup_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SsoConnectionRole" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "connectionOid" BIGINT NOT NULL,
    "rootRoleOid" BIGINT,
    "value" TEXT NOT NULL,
    "displayName" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SsoConnectionRole_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SsoGroup" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "value" TEXT NOT NULL,
    "displayName" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SsoGroup_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SsoRole" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "value" TEXT NOT NULL,
    "displayName" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SsoRole_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SsoUserProfile" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SsoUserProfileStatus" NOT NULL DEFAULT 'active',
    "tenantOid" BIGINT NOT NULL,
    "connectionOid" BIGINT NOT NULL,
    "userOid" BIGINT NOT NULL,
    "email" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "uidHash" TEXT NOT NULL,
    "sub" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "roles" TEXT[],
    "groups" TEXT[],
    "isGroupRoleMemberReconciled" BOOLEAN NOT NULL DEFAULT false,
    "ownerDirectoryOid" BIGINT,
    "raw" JSONB NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SsoUserProfile_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SsoUserGroup" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "userOid" BIGINT NOT NULL,
    "groupOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SsoUserGroup_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SsoUserRole" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "userOid" BIGINT NOT NULL,
    "roleOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SsoUserRole_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SsoUserProfileGroup" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "userProfileOid" BIGINT NOT NULL,
    "groupOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SsoUserProfileGroup_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SsoUserProfileRole" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "userProfileOid" BIGINT NOT NULL,
    "roleOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SsoUserProfileRole_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SsoDirectoryUserProfile" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "directoryOid" BIGINT NOT NULL,
    "userProfileOid" BIGINT NOT NULL,
    "externalId" TEXT,
    "raw" JSONB,
    "lastSeenAt" TIMESTAMP(3),
    "deprovisionedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SsoDirectoryUserProfile_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SsoConnectionSetup" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SsoConnectionSetupStatus" NOT NULL DEFAULT 'pending',
    "tenantOid" BIGINT NOT NULL,
    "connectionOid" BIGINT,
    "clientSecret" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SsoConnectionSetup_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SsoTenant" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SsoTenantStatus" NOT NULL DEFAULT 'pending',
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "externalId" TEXT,
    "metadata" JSONB,
    "enrollment" "SsoTenantEnrollment" NOT NULL DEFAULT 'app',
    "hideInUI" BOOLEAN NOT NULL DEFAULT false,
    "appOid" BIGINT NOT NULL,
    "accountOid" BIGINT,
    "importedDelegationOid" BIGINT,
    "syncRevision" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SsoTenant_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SsoTest" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SsoTestStatus" NOT NULL DEFAULT 'pending',
    "authId" TEXT NOT NULL,
    "authOid" BIGINT,
    "tenantOid" BIGINT NOT NULL,
    "connectionOid" BIGINT NOT NULL,
    "email" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "uid" TEXT,
    "sub" TEXT,
    "groups" TEXT[],
    "roles" TEXT[],
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "SsoTest_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SsoUser" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SsoUserStatus" NOT NULL DEFAULT 'active',
    "tenantOid" BIGINT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "ownerProfileOid" BIGINT,
    "syncRevision" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SsoUser_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SsoUserChange" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "userOid" BIGINT,
    "userId" TEXT NOT NULL,
    "status" "SsoUserStatus" NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "ownerProfileOid" BIGINT,
    "source" TEXT NOT NULL,
    "changedFields" TEXT[],
    "scimOperationOid" BIGINT,
    "assignedGroups" JSONB NOT NULL,
    "assignedRoles" JSONB NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SsoUserChange_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "EmailDomain" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "appOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailDomain_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "UserEmail" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "email" TEXT NOT NULL,
    "normalizedEmail" TEXT NOT NULL,
    "domainOid" BIGINT NOT NULL,
    "userOid" BIGINT NOT NULL,
    "appOid" BIGINT NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "lastResentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserEmail_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "UserEmailVerification" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "userOid" BIGINT NOT NULL,
    "userEmailOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "UserEmailVerification_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "UserIdentityProvider" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "oauthProviderOid" BIGINT,
    "ssoTenantOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserIdentityProvider_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "UserIdentity" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "providerOid" BIGINT NOT NULL,
    "userOid" BIGINT,
    "uid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "photoUrl" TEXT,
    "ssoUserProfileOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserIdentity_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "UserTermsType" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserTermsType_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "UserTermsAgreement" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "userOid" BIGINT NOT NULL,
    "typeOid" BIGINT NOT NULL,
    "ip" TEXT NOT NULL,
    "ua" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserTermsAgreement_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "UserTwoFactor" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "method" "UserTwoFactorMethod" NOT NULL,
    "name" TEXT NOT NULL,
    "encryptedSecret" TEXT,
    "lastTimeStep" INTEGER,
    "credentialId" TEXT,
    "publicKey" BYTEA,
    "counter" BIGINT NOT NULL DEFAULT 0,
    "transports" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "deviceType" TEXT,
    "backedUp" BOOLEAN NOT NULL DEFAULT false,
    "userOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "UserTwoFactor_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "UserRecoveryCode" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "userOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumedAt" TIMESTAMP(3),

    CONSTRAINT "UserRecoveryCode_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "UserTwoFactorSetup" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "method" "UserTwoFactorMethod",
    "status" "UserTwoFactorSetupStatus" NOT NULL DEFAULT 'pending',
    "revision" INTEGER NOT NULL,
    "name" TEXT,
    "encryptedSecret" TEXT,
    "lastTimeStep" INTEGER,
    "credentialId" TEXT,
    "publicKey" BYTEA,
    "counter" BIGINT NOT NULL DEFAULT 0,
    "transports" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "deviceType" TEXT,
    "backedUp" BOOLEAN NOT NULL DEFAULT false,
    "challenge" TEXT,
    "challengeExpiresAt" TIMESTAMP(3),
    "failures" INTEGER NOT NULL DEFAULT 0,
    "encryptedRecoveryCodes" TEXT,
    "callbackUrl" TEXT NOT NULL,
    "returnUrl" TEXT NOT NULL,
    "userOid" BIGINT NOT NULL,
    "sessionOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "UserTwoFactorSetup_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "User" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "UserType" NOT NULL,
    "owner" "UserOwner" NOT NULL,
    "status" "UserStatus" NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "appOid" BIGINT NOT NULL,
    "accountOid" BIGINT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "image" JSONB NOT NULL,
    "isFullyCreated" BOOLEAN NOT NULL DEFAULT true,
    "signupMethod" "UserSignupMethod" NOT NULL DEFAULT 'email',
    "hasLoggedIn" BOOLEAN NOT NULL DEFAULT true,
    "syncRevision" BIGINT NOT NULL DEFAULT 0,
    "hyperplaneRevision" BIGINT,
    "lastLoginAt" TIMESTAMP(3),
    "lastActiveAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "twoFactorRevision" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "User_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "UserPassword" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "userOid" BIGINT NOT NULL,
    "hash" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPassword_pkey" PRIMARY KEY ("oid")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_id_key" ON "Account"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Account_clientId_key" ON "Account"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_identifier_key" ON "Account"("identifier");

-- CreateIndex
CREATE INDEX "Account_appOid_status_idx" ON "Account"("appOid", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Account_appOid_identifier_key" ON "Account"("appOid", "identifier");

-- CreateIndex
CREATE UNIQUE INDEX "AccountDomain_id_key" ON "AccountDomain"("id");

-- CreateIndex
CREATE INDEX "AccountDomain_accountOid_idx" ON "AccountDomain"("accountOid");

-- CreateIndex
CREATE UNIQUE INDEX "AccountDomain_appOid_domain_key" ON "AccountDomain"("appOid", "domain");

-- CreateIndex
CREATE UNIQUE INDEX "AccountDomainSsoTenant_id_key" ON "AccountDomainSsoTenant"("id");

-- CreateIndex
CREATE INDEX "AccountDomainSsoTenant_tenantOid_idx" ON "AccountDomainSsoTenant"("tenantOid");

-- CreateIndex
CREATE UNIQUE INDEX "AccountDomainSsoTenant_domainOid_tenantOid_key" ON "AccountDomainSsoTenant"("domainOid", "tenantOid");

-- CreateIndex
CREATE UNIQUE INDEX "AccountDomainSsoConnection_id_key" ON "AccountDomainSsoConnection"("id");

-- CreateIndex
CREATE INDEX "AccountDomainSsoConnection_connectionOid_idx" ON "AccountDomainSsoConnection"("connectionOid");

-- CreateIndex
CREATE UNIQUE INDEX "AccountDomainSsoConnection_domainOid_connectionOid_key" ON "AccountDomainSsoConnection"("domainOid", "connectionOid");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_id_key" ON "Admin"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AdminSession_id_key" ON "AdminSession"("id");

-- CreateIndex
CREATE UNIQUE INDEX "AdminSession_clientSecret_key" ON "AdminSession"("clientSecret");

-- CreateIndex
CREATE UNIQUE INDEX "AccessGroup_id_key" ON "AccessGroup"("id");

-- CreateIndex
CREATE UNIQUE INDEX "AccessGroupRule_id_key" ON "AccessGroupRule"("id");

-- CreateIndex
CREATE UNIQUE INDEX "AccessGroupAssignment_id_key" ON "AccessGroupAssignment"("id");

-- CreateIndex
CREATE UNIQUE INDEX "AccessGroupAssignment_accessGroupOid_appOid_key" ON "AccessGroupAssignment"("accessGroupOid", "appOid");

-- CreateIndex
CREATE UNIQUE INDEX "App_id_key" ON "App"("id");

-- CreateIndex
CREATE UNIQUE INDEX "App_clientId_key" ON "App"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "App_slug_key" ON "App"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "SyncListener_id_key" ON "SyncListener"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SyncListener_identifier_key" ON "SyncListener"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "AppOAuthProvider_id_key" ON "AppOAuthProvider"("id");

-- CreateIndex
CREATE UNIQUE INDEX "AppOAuthProvider_appOid_provider_key" ON "AppOAuthProvider"("appOid", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_id_key" ON "Tenant"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_clientId_key" ON "Tenant"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditLog_id_key" ON "AuditLog"("id");

-- CreateIndex
CREATE INDEX "AuditLog_appOid_createdAt_idx" ON "AuditLog"("appOid", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userOid_createdAt_idx" ON "AuditLog"("userOid", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_type_createdAt_idx" ON "AuditLog"("type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuthIntent_id_key" ON "AuthIntent"("id");

-- CreateIndex
CREATE UNIQUE INDEX "AuthIntent_clientSecret_key" ON "AuthIntent"("clientSecret");

-- CreateIndex
CREATE UNIQUE INDEX "AuthIntentStep_id_key" ON "AuthIntentStep"("id");

-- CreateIndex
CREATE UNIQUE INDEX "AuthIntentVerificationAttempt_id_key" ON "AuthIntentVerificationAttempt"("id");

-- CreateIndex
CREATE INDEX "AuthIntentVerificationAttempt_authIntentOid_method_status_c_idx" ON "AuthIntentVerificationAttempt"("authIntentOid", "method", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuthIntentCode_id_key" ON "AuthIntentCode"("id");

-- CreateIndex
CREATE UNIQUE INDEX "AuthAttempt_id_key" ON "AuthAttempt"("id");

-- CreateIndex
CREATE UNIQUE INDEX "AuthAttempt_clientSecret_key" ON "AuthAttempt"("clientSecret");

-- CreateIndex
CREATE UNIQUE INDEX "AuthAttempt_authorizationCode_key" ON "AuthAttempt"("authorizationCode");

-- CreateIndex
CREATE INDEX "AuthBlock_identifierType_identifier_idx" ON "AuthBlock"("identifierType", "identifier");

-- CreateIndex
CREATE INDEX "AuthBlock_ip_idx" ON "AuthBlock"("ip");

-- CreateIndex
CREATE INDEX "AuthBlock_blockedUntil_idx" ON "AuthBlock"("blockedUntil");

-- CreateIndex
CREATE UNIQUE INDEX "AuthDevice_id_key" ON "AuthDevice"("id");

-- CreateIndex
CREATE UNIQUE INDEX "AuthDevice_clientSecret_key" ON "AuthDevice"("clientSecret");

-- CreateIndex
CREATE UNIQUE INDEX "AuthDeviceUserSession_id_key" ON "AuthDeviceUserSession"("id");

-- CreateIndex
CREATE INDEX "AuthDeviceUserSession_lifecycleOwner_lifecycleOwnerSessionI_idx" ON "AuthDeviceUserSession"("lifecycleOwner", "lifecycleOwnerSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "SsoAuth_id_key" ON "SsoAuth"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SsoAuth_clientSecret_key" ON "SsoAuth"("clientSecret");

-- CreateIndex
CREATE UNIQUE INDEX "SsoAuth_state_key" ON "SsoAuth"("state");

-- CreateIndex
CREATE UNIQUE INDEX "SsoConnection_id_key" ON "SsoConnection"("id");

-- CreateIndex
CREATE INDEX "SsoConnection_importedDelegationOid_status_idx" ON "SsoConnection"("importedDelegationOid", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SsoConnection_importedDelegationOid_sourceId_key" ON "SsoConnection"("importedDelegationOid", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "AresInstance_id_key" ON "AresInstance"("id");

-- CreateIndex
CREATE UNIQUE INDEX "AresInstance_singletonKey_key" ON "AresInstance"("singletonKey");

-- CreateIndex
CREATE UNIQUE INDEX "RemoteAresInstance_id_key" ON "RemoteAresInstance"("id");

-- CreateIndex
CREATE UNIQUE INDEX "RemoteAresInstance_remoteId_key" ON "RemoteAresInstance"("remoteId");

-- CreateIndex
CREATE UNIQUE INDEX "SsoExportedDelegation_id_key" ON "SsoExportedDelegation"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SsoExportedDelegation_clientId_key" ON "SsoExportedDelegation"("clientId");

-- CreateIndex
CREATE INDEX "SsoExportedDelegation_instanceOid_idx" ON "SsoExportedDelegation"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "SsoExportedDelegation_tenantOid_identifier_key" ON "SsoExportedDelegation"("tenantOid", "identifier");

-- CreateIndex
CREATE UNIQUE INDEX "SsoImportedDelegation_id_key" ON "SsoImportedDelegation"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SsoImportedDelegation_clientId_key" ON "SsoImportedDelegation"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "SsoImportedDelegation_localExportedDelegationOid_key" ON "SsoImportedDelegation"("localExportedDelegationOid");

-- CreateIndex
CREATE INDEX "SsoImportedDelegation_appOid_status_idx" ON "SsoImportedDelegation"("appOid", "status");

-- CreateIndex
CREATE INDEX "SsoImportedDelegation_lastSyncedAt_idx" ON "SsoImportedDelegation"("lastSyncedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SsoImportedDelegation_remoteInstanceOid_sourceDelegationId_key" ON "SsoImportedDelegation"("remoteInstanceOid", "sourceDelegationId");

-- CreateIndex
CREATE UNIQUE INDEX "SsoDelegationAuthRequest_id_key" ON "SsoDelegationAuthRequest"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SsoDelegationAuthRequest_ssoAuthOid_key" ON "SsoDelegationAuthRequest"("ssoAuthOid");

-- CreateIndex
CREATE INDEX "SsoDelegationAuthRequest_exportedDelegationOid_expiresAt_idx" ON "SsoDelegationAuthRequest"("exportedDelegationOid", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "SsoDelegationAuthorizationCode_id_key" ON "SsoDelegationAuthorizationCode"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SsoDelegationAuthorizationCode_codeHash_key" ON "SsoDelegationAuthorizationCode"("codeHash");

-- CreateIndex
CREATE INDEX "SsoDelegationAuthorizationCode_exportedDelegationOid_expire_idx" ON "SsoDelegationAuthorizationCode"("exportedDelegationOid", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "SsoDelegationToken_id_key" ON "SsoDelegationToken"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SsoDelegationToken_tokenHash_key" ON "SsoDelegationToken"("tokenHash");

-- CreateIndex
CREATE INDEX "SsoDelegationToken_exportedDelegationOid_expiresAt_idx" ON "SsoDelegationToken"("exportedDelegationOid", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "SsoDirectory_id_key" ON "SsoDirectory"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SsoDirectory_internalId_key" ON "SsoDirectory"("internalId");

-- CreateIndex
CREATE UNIQUE INDEX "SsoDirectory_connectionOid_internalId_key" ON "SsoDirectory"("connectionOid", "internalId");

-- CreateIndex
CREATE UNIQUE INDEX "SsoDirectoryGroup_id_key" ON "SsoDirectoryGroup"("id");

-- CreateIndex
CREATE INDEX "SsoDirectoryGroup_groupOid_idx" ON "SsoDirectoryGroup"("groupOid");

-- CreateIndex
CREATE UNIQUE INDEX "SsoDirectoryGroup_directoryOid_groupOid_key" ON "SsoDirectoryGroup"("directoryOid", "groupOid");

-- CreateIndex
CREATE UNIQUE INDEX "SsoDirectoryRole_id_key" ON "SsoDirectoryRole"("id");

-- CreateIndex
CREATE INDEX "SsoDirectoryRole_roleOid_idx" ON "SsoDirectoryRole"("roleOid");

-- CreateIndex
CREATE UNIQUE INDEX "SsoDirectoryRole_directoryOid_roleOid_key" ON "SsoDirectoryRole"("directoryOid", "roleOid");

-- CreateIndex
CREATE UNIQUE INDEX "SsoScimOperation_id_key" ON "SsoScimOperation"("id");

-- CreateIndex
CREATE INDEX "SsoScimOperation_createdAt_idx" ON "SsoScimOperation"("createdAt");

-- CreateIndex
CREATE INDEX "SsoScimOperation_directoryOid_createdAt_idx" ON "SsoScimOperation"("directoryOid", "createdAt");

-- CreateIndex
CREATE INDEX "SsoScimOperation_appOid_createdAt_idx" ON "SsoScimOperation"("appOid", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SsoConnectionGroup_id_key" ON "SsoConnectionGroup"("id");

-- CreateIndex
CREATE INDEX "SsoConnectionGroup_rootGroupOid_idx" ON "SsoConnectionGroup"("rootGroupOid");

-- CreateIndex
CREATE UNIQUE INDEX "SsoConnectionGroup_connectionOid_value_key" ON "SsoConnectionGroup"("connectionOid", "value");

-- CreateIndex
CREATE UNIQUE INDEX "SsoConnectionRole_id_key" ON "SsoConnectionRole"("id");

-- CreateIndex
CREATE INDEX "SsoConnectionRole_rootRoleOid_idx" ON "SsoConnectionRole"("rootRoleOid");

-- CreateIndex
CREATE UNIQUE INDEX "SsoConnectionRole_connectionOid_value_key" ON "SsoConnectionRole"("connectionOid", "value");

-- CreateIndex
CREATE UNIQUE INDEX "SsoGroup_id_key" ON "SsoGroup"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SsoGroup_tenantOid_value_key" ON "SsoGroup"("tenantOid", "value");

-- CreateIndex
CREATE UNIQUE INDEX "SsoRole_id_key" ON "SsoRole"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SsoRole_tenantOid_value_key" ON "SsoRole"("tenantOid", "value");

-- CreateIndex
CREATE UNIQUE INDEX "SsoUserProfile_id_key" ON "SsoUserProfile"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SsoUserGroup_id_key" ON "SsoUserGroup"("id");

-- CreateIndex
CREATE INDEX "SsoUserGroup_groupOid_idx" ON "SsoUserGroup"("groupOid");

-- CreateIndex
CREATE UNIQUE INDEX "SsoUserGroup_userOid_groupOid_key" ON "SsoUserGroup"("userOid", "groupOid");

-- CreateIndex
CREATE UNIQUE INDEX "SsoUserRole_id_key" ON "SsoUserRole"("id");

-- CreateIndex
CREATE INDEX "SsoUserRole_roleOid_idx" ON "SsoUserRole"("roleOid");

-- CreateIndex
CREATE UNIQUE INDEX "SsoUserRole_userOid_roleOid_key" ON "SsoUserRole"("userOid", "roleOid");

-- CreateIndex
CREATE UNIQUE INDEX "SsoUserProfileGroup_id_key" ON "SsoUserProfileGroup"("id");

-- CreateIndex
CREATE INDEX "SsoUserProfileGroup_groupOid_idx" ON "SsoUserProfileGroup"("groupOid");

-- CreateIndex
CREATE UNIQUE INDEX "SsoUserProfileGroup_userProfileOid_groupOid_key" ON "SsoUserProfileGroup"("userProfileOid", "groupOid");

-- CreateIndex
CREATE UNIQUE INDEX "SsoUserProfileRole_id_key" ON "SsoUserProfileRole"("id");

-- CreateIndex
CREATE INDEX "SsoUserProfileRole_roleOid_idx" ON "SsoUserProfileRole"("roleOid");

-- CreateIndex
CREATE UNIQUE INDEX "SsoUserProfileRole_userProfileOid_roleOid_key" ON "SsoUserProfileRole"("userProfileOid", "roleOid");

-- CreateIndex
CREATE UNIQUE INDEX "SsoDirectoryUserProfile_id_key" ON "SsoDirectoryUserProfile"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SsoDirectoryUserProfile_directoryOid_userProfileOid_key" ON "SsoDirectoryUserProfile"("directoryOid", "userProfileOid");

-- CreateIndex
CREATE UNIQUE INDEX "SsoDirectoryUserProfile_directoryOid_externalId_key" ON "SsoDirectoryUserProfile"("directoryOid", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "SsoConnectionSetup_id_key" ON "SsoConnectionSetup"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SsoConnectionSetup_clientSecret_key" ON "SsoConnectionSetup"("clientSecret");

-- CreateIndex
CREATE UNIQUE INDEX "SsoTenant_id_key" ON "SsoTenant"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SsoTenant_clientId_key" ON "SsoTenant"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "SsoTenant_externalId_key" ON "SsoTenant"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "SsoTenant_importedDelegationOid_key" ON "SsoTenant"("importedDelegationOid");

-- CreateIndex
CREATE INDEX "SsoTenant_appOid_enrollment_idx" ON "SsoTenant"("appOid", "enrollment");

-- CreateIndex
CREATE INDEX "SsoTenant_accountOid_status_idx" ON "SsoTenant"("accountOid", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SsoTest_id_key" ON "SsoTest"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SsoTest_authId_key" ON "SsoTest"("authId");

-- CreateIndex
CREATE UNIQUE INDEX "SsoTest_authOid_key" ON "SsoTest"("authOid");

-- CreateIndex
CREATE UNIQUE INDEX "SsoUser_id_key" ON "SsoUser"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SsoUser_ownerProfileOid_key" ON "SsoUser"("ownerProfileOid");

-- CreateIndex
CREATE INDEX "SsoUser_tenantOid_email_idx" ON "SsoUser"("tenantOid", "email");

-- CreateIndex
CREATE UNIQUE INDEX "SsoUserChange_id_key" ON "SsoUserChange"("id");

-- CreateIndex
CREATE INDEX "SsoUserChange_userOid_createdAt_idx" ON "SsoUserChange"("userOid", "createdAt");

-- CreateIndex
CREATE INDEX "SsoUserChange_tenantOid_createdAt_idx" ON "SsoUserChange"("tenantOid", "createdAt");

-- CreateIndex
CREATE INDEX "SsoUserChange_scimOperationOid_idx" ON "SsoUserChange"("scimOperationOid");

-- CreateIndex
CREATE INDEX "SsoUserChange_createdAt_idx" ON "SsoUserChange"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailDomain_id_key" ON "EmailDomain"("id");

-- CreateIndex
CREATE UNIQUE INDEX "EmailDomain_domain_key" ON "EmailDomain"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "UserEmail_id_key" ON "UserEmail"("id");

-- CreateIndex
CREATE UNIQUE INDEX "UserEmail_email_appOid_key" ON "UserEmail"("email", "appOid");

-- CreateIndex
CREATE UNIQUE INDEX "UserEmailVerification_id_key" ON "UserEmailVerification"("id");

-- CreateIndex
CREATE UNIQUE INDEX "UserEmailVerification_key_key" ON "UserEmailVerification"("key");

-- CreateIndex
CREATE UNIQUE INDEX "UserIdentityProvider_id_key" ON "UserIdentityProvider"("id");

-- CreateIndex
CREATE UNIQUE INDEX "UserIdentityProvider_oauthProviderOid_key" ON "UserIdentityProvider"("oauthProviderOid");

-- CreateIndex
CREATE UNIQUE INDEX "UserIdentityProvider_ssoTenantOid_key" ON "UserIdentityProvider"("ssoTenantOid");

-- CreateIndex
CREATE UNIQUE INDEX "UserIdentity_id_key" ON "UserIdentity"("id");

-- CreateIndex
CREATE UNIQUE INDEX "UserIdentity_providerOid_uid_key" ON "UserIdentity"("providerOid", "uid");

-- CreateIndex
CREATE UNIQUE INDEX "UserTermsType_id_key" ON "UserTermsType"("id");

-- CreateIndex
CREATE UNIQUE INDEX "UserTermsType_identifier_version_key" ON "UserTermsType"("identifier", "version");

-- CreateIndex
CREATE UNIQUE INDEX "UserTermsAgreement_id_key" ON "UserTermsAgreement"("id");

-- CreateIndex
CREATE UNIQUE INDEX "UserTermsAgreement_userOid_typeOid_key" ON "UserTermsAgreement"("userOid", "typeOid");

-- CreateIndex
CREATE UNIQUE INDEX "UserTwoFactor_id_key" ON "UserTwoFactor"("id");

-- CreateIndex
CREATE UNIQUE INDEX "UserTwoFactor_credentialId_key" ON "UserTwoFactor"("credentialId");

-- CreateIndex
CREATE INDEX "UserTwoFactor_userOid_method_idx" ON "UserTwoFactor"("userOid", "method");

-- CreateIndex
CREATE UNIQUE INDEX "UserRecoveryCode_id_key" ON "UserRecoveryCode"("id");

-- CreateIndex
CREATE UNIQUE INDEX "UserRecoveryCode_userOid_hash_key" ON "UserRecoveryCode"("userOid", "hash");

-- CreateIndex
CREATE UNIQUE INDEX "UserTwoFactorSetup_id_key" ON "UserTwoFactorSetup"("id");

-- CreateIndex
CREATE UNIQUE INDEX "UserTwoFactorSetup_secretHash_key" ON "UserTwoFactorSetup"("secretHash");

-- CreateIndex
CREATE INDEX "UserTwoFactorSetup_expiresAt_id_idx" ON "UserTwoFactorSetup"("expiresAt", "id");

-- CreateIndex
CREATE INDEX "UserTwoFactorSetup_userOid_createdAt_idx" ON "UserTwoFactorSetup"("userOid", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_id_key" ON "User"("id");

-- CreateIndex
CREATE INDEX "User_accountOid_id_idx" ON "User"("accountOid", "id");

-- CreateIndex
CREATE INDEX "User_appOid_email_idx" ON "User"("appOid", "email");

-- CreateIndex
CREATE UNIQUE INDEX "User_appOid_email_key" ON "User"("appOid", "email");

-- CreateIndex
CREATE UNIQUE INDEX "UserPassword_id_key" ON "UserPassword"("id");

-- CreateIndex
CREATE UNIQUE INDEX "UserPassword_userOid_key" ON "UserPassword"("userOid");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_appOid_fkey" FOREIGN KEY ("appOid") REFERENCES "App"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountDomain" ADD CONSTRAINT "AccountDomain_appOid_fkey" FOREIGN KEY ("appOid") REFERENCES "App"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountDomain" ADD CONSTRAINT "AccountDomain_accountOid_fkey" FOREIGN KEY ("accountOid") REFERENCES "Account"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountDomainSsoTenant" ADD CONSTRAINT "AccountDomainSsoTenant_domainOid_fkey" FOREIGN KEY ("domainOid") REFERENCES "AccountDomain"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountDomainSsoTenant" ADD CONSTRAINT "AccountDomainSsoTenant_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "SsoTenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountDomainSsoConnection" ADD CONSTRAINT "AccountDomainSsoConnection_domainOid_fkey" FOREIGN KEY ("domainOid") REFERENCES "AccountDomain"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountDomainSsoConnection" ADD CONSTRAINT "AccountDomainSsoConnection_connectionOid_fkey" FOREIGN KEY ("connectionOid") REFERENCES "SsoConnection"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminSession" ADD CONSTRAINT "AdminSession_adminOid_fkey" FOREIGN KEY ("adminOid") REFERENCES "Admin"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessGroup" ADD CONSTRAINT "AccessGroup_appOid_fkey" FOREIGN KEY ("appOid") REFERENCES "App"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessGroupRule" ADD CONSTRAINT "AccessGroupRule_accessGroupOid_fkey" FOREIGN KEY ("accessGroupOid") REFERENCES "AccessGroup"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessGroupAssignment" ADD CONSTRAINT "AccessGroupAssignment_accessGroupOid_fkey" FOREIGN KEY ("accessGroupOid") REFERENCES "AccessGroup"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessGroupAssignment" ADD CONSTRAINT "AccessGroupAssignment_appOid_fkey" FOREIGN KEY ("appOid") REFERENCES "App"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "App" ADD CONSTRAINT "App_defaultTenantOid_fkey" FOREIGN KEY ("defaultTenantOid") REFERENCES "Tenant"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppOAuthProvider" ADD CONSTRAINT "AppOAuthProvider_appOid_fkey" FOREIGN KEY ("appOid") REFERENCES "App"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_appOid_fkey" FOREIGN KEY ("appOid") REFERENCES "App"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_appOid_fkey" FOREIGN KEY ("appOid") REFERENCES "App"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userOid_fkey" FOREIGN KEY ("userOid") REFERENCES "User"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthIntent" ADD CONSTRAINT "AuthIntent_userOid_fkey" FOREIGN KEY ("userOid") REFERENCES "User"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthIntent" ADD CONSTRAINT "AuthIntent_userIdentityOid_fkey" FOREIGN KEY ("userIdentityOid") REFERENCES "UserIdentity"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthIntent" ADD CONSTRAINT "AuthIntent_deviceOid_fkey" FOREIGN KEY ("deviceOid") REFERENCES "AuthDevice"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthIntent" ADD CONSTRAINT "AuthIntent_appOid_fkey" FOREIGN KEY ("appOid") REFERENCES "App"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthIntent" ADD CONSTRAINT "AuthIntent_accountOid_fkey" FOREIGN KEY ("accountOid") REFERENCES "Account"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthIntentStep" ADD CONSTRAINT "AuthIntentStep_authIntentOid_fkey" FOREIGN KEY ("authIntentOid") REFERENCES "AuthIntent"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthIntentVerificationAttempt" ADD CONSTRAINT "AuthIntentVerificationAttempt_authIntentOid_fkey" FOREIGN KEY ("authIntentOid") REFERENCES "AuthIntent"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthIntentVerificationAttempt" ADD CONSTRAINT "AuthIntentVerificationAttempt_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "AuthIntentStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthIntentCode" ADD CONSTRAINT "AuthIntentCode_authIntentOid_fkey" FOREIGN KEY ("authIntentOid") REFERENCES "AuthIntent"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthIntentCode" ADD CONSTRAINT "AuthIntentCode_stepOid_fkey" FOREIGN KEY ("stepOid") REFERENCES "AuthIntentStep"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthAttempt" ADD CONSTRAINT "AuthAttempt_userOid_fkey" FOREIGN KEY ("userOid") REFERENCES "User"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthAttempt" ADD CONSTRAINT "AuthAttempt_deviceOid_fkey" FOREIGN KEY ("deviceOid") REFERENCES "AuthDevice"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthAttempt" ADD CONSTRAINT "AuthAttempt_appOid_fkey" FOREIGN KEY ("appOid") REFERENCES "App"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthAttempt" ADD CONSTRAINT "AuthAttempt_accountOid_fkey" FOREIGN KEY ("accountOid") REFERENCES "Account"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthAttempt" ADD CONSTRAINT "AuthAttempt_authIntentOid_fkey" FOREIGN KEY ("authIntentOid") REFERENCES "AuthIntent"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthDeviceHistory" ADD CONSTRAINT "AuthDeviceHistory_deviceOid_fkey" FOREIGN KEY ("deviceOid") REFERENCES "AuthDevice"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthDeviceUserSession" ADD CONSTRAINT "AuthDeviceUserSession_deviceOid_fkey" FOREIGN KEY ("deviceOid") REFERENCES "AuthDevice"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthDeviceUserSession" ADD CONSTRAINT "AuthDeviceUserSession_userOid_fkey" FOREIGN KEY ("userOid") REFERENCES "User"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthDeviceUserSession" ADD CONSTRAINT "AuthDeviceUserSession_appOid_fkey" FOREIGN KEY ("appOid") REFERENCES "App"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoAuth" ADD CONSTRAINT "SsoAuth_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "SsoTenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoAuth" ADD CONSTRAINT "SsoAuth_accountOid_fkey" FOREIGN KEY ("accountOid") REFERENCES "Account"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoAuth" ADD CONSTRAINT "SsoAuth_connectionOid_fkey" FOREIGN KEY ("connectionOid") REFERENCES "SsoConnection"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoAuth" ADD CONSTRAINT "SsoAuth_userProfileOid_fkey" FOREIGN KEY ("userProfileOid") REFERENCES "SsoUserProfile"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoAuth" ADD CONSTRAINT "SsoAuth_userOid_fkey" FOREIGN KEY ("userOid") REFERENCES "SsoUser"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoConnection" ADD CONSTRAINT "SsoConnection_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "SsoTenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoConnection" ADD CONSTRAINT "SsoConnection_importedDelegationOid_fkey" FOREIGN KEY ("importedDelegationOid") REFERENCES "SsoImportedDelegation"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoExportedDelegation" ADD CONSTRAINT "SsoExportedDelegation_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "SsoTenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoExportedDelegation" ADD CONSTRAINT "SsoExportedDelegation_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "AresInstance"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoImportedDelegation" ADD CONSTRAINT "SsoImportedDelegation_remoteInstanceOid_fkey" FOREIGN KEY ("remoteInstanceOid") REFERENCES "RemoteAresInstance"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoImportedDelegation" ADD CONSTRAINT "SsoImportedDelegation_appOid_fkey" FOREIGN KEY ("appOid") REFERENCES "App"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoImportedDelegation" ADD CONSTRAINT "SsoImportedDelegation_localExportedDelegationOid_fkey" FOREIGN KEY ("localExportedDelegationOid") REFERENCES "SsoExportedDelegation"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoDelegationAuthRequest" ADD CONSTRAINT "SsoDelegationAuthRequest_exportedDelegationOid_fkey" FOREIGN KEY ("exportedDelegationOid") REFERENCES "SsoExportedDelegation"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoDelegationAuthRequest" ADD CONSTRAINT "SsoDelegationAuthRequest_ssoAuthOid_fkey" FOREIGN KEY ("ssoAuthOid") REFERENCES "SsoAuth"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoDelegationAuthorizationCode" ADD CONSTRAINT "SsoDelegationAuthorizationCode_exportedDelegationOid_fkey" FOREIGN KEY ("exportedDelegationOid") REFERENCES "SsoExportedDelegation"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoDelegationAuthorizationCode" ADD CONSTRAINT "SsoDelegationAuthorizationCode_connectionOid_fkey" FOREIGN KEY ("connectionOid") REFERENCES "SsoConnection"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoDelegationAuthorizationCode" ADD CONSTRAINT "SsoDelegationAuthorizationCode_userProfileOid_fkey" FOREIGN KEY ("userProfileOid") REFERENCES "SsoUserProfile"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoDelegationToken" ADD CONSTRAINT "SsoDelegationToken_exportedDelegationOid_fkey" FOREIGN KEY ("exportedDelegationOid") REFERENCES "SsoExportedDelegation"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoDelegationToken" ADD CONSTRAINT "SsoDelegationToken_connectionOid_fkey" FOREIGN KEY ("connectionOid") REFERENCES "SsoConnection"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoDelegationToken" ADD CONSTRAINT "SsoDelegationToken_userProfileOid_fkey" FOREIGN KEY ("userProfileOid") REFERENCES "SsoUserProfile"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoDirectory" ADD CONSTRAINT "SsoDirectory_connectionOid_fkey" FOREIGN KEY ("connectionOid") REFERENCES "SsoConnection"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoDirectoryGroup" ADD CONSTRAINT "SsoDirectoryGroup_directoryOid_fkey" FOREIGN KEY ("directoryOid") REFERENCES "SsoDirectory"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoDirectoryGroup" ADD CONSTRAINT "SsoDirectoryGroup_groupOid_fkey" FOREIGN KEY ("groupOid") REFERENCES "SsoConnectionGroup"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoDirectoryRole" ADD CONSTRAINT "SsoDirectoryRole_directoryOid_fkey" FOREIGN KEY ("directoryOid") REFERENCES "SsoDirectory"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoDirectoryRole" ADD CONSTRAINT "SsoDirectoryRole_roleOid_fkey" FOREIGN KEY ("roleOid") REFERENCES "SsoConnectionRole"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoScimOperation" ADD CONSTRAINT "SsoScimOperation_directoryOid_fkey" FOREIGN KEY ("directoryOid") REFERENCES "SsoDirectory"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoScimOperation" ADD CONSTRAINT "SsoScimOperation_appOid_fkey" FOREIGN KEY ("appOid") REFERENCES "App"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoConnectionGroup" ADD CONSTRAINT "SsoConnectionGroup_connectionOid_fkey" FOREIGN KEY ("connectionOid") REFERENCES "SsoConnection"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoConnectionGroup" ADD CONSTRAINT "SsoConnectionGroup_rootGroupOid_fkey" FOREIGN KEY ("rootGroupOid") REFERENCES "SsoGroup"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoConnectionRole" ADD CONSTRAINT "SsoConnectionRole_connectionOid_fkey" FOREIGN KEY ("connectionOid") REFERENCES "SsoConnection"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoConnectionRole" ADD CONSTRAINT "SsoConnectionRole_rootRoleOid_fkey" FOREIGN KEY ("rootRoleOid") REFERENCES "SsoRole"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoGroup" ADD CONSTRAINT "SsoGroup_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "SsoTenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoRole" ADD CONSTRAINT "SsoRole_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "SsoTenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoUserProfile" ADD CONSTRAINT "SsoUserProfile_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "SsoTenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoUserProfile" ADD CONSTRAINT "SsoUserProfile_connectionOid_fkey" FOREIGN KEY ("connectionOid") REFERENCES "SsoConnection"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoUserProfile" ADD CONSTRAINT "SsoUserProfile_userOid_fkey" FOREIGN KEY ("userOid") REFERENCES "SsoUser"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoUserProfile" ADD CONSTRAINT "SsoUserProfile_ownerDirectoryOid_fkey" FOREIGN KEY ("ownerDirectoryOid") REFERENCES "SsoDirectory"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoUserGroup" ADD CONSTRAINT "SsoUserGroup_userOid_fkey" FOREIGN KEY ("userOid") REFERENCES "SsoUser"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoUserGroup" ADD CONSTRAINT "SsoUserGroup_groupOid_fkey" FOREIGN KEY ("groupOid") REFERENCES "SsoGroup"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoUserRole" ADD CONSTRAINT "SsoUserRole_userOid_fkey" FOREIGN KEY ("userOid") REFERENCES "SsoUser"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoUserRole" ADD CONSTRAINT "SsoUserRole_roleOid_fkey" FOREIGN KEY ("roleOid") REFERENCES "SsoRole"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoUserProfileGroup" ADD CONSTRAINT "SsoUserProfileGroup_userProfileOid_fkey" FOREIGN KEY ("userProfileOid") REFERENCES "SsoUserProfile"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoUserProfileGroup" ADD CONSTRAINT "SsoUserProfileGroup_groupOid_fkey" FOREIGN KEY ("groupOid") REFERENCES "SsoConnectionGroup"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoUserProfileRole" ADD CONSTRAINT "SsoUserProfileRole_userProfileOid_fkey" FOREIGN KEY ("userProfileOid") REFERENCES "SsoUserProfile"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoUserProfileRole" ADD CONSTRAINT "SsoUserProfileRole_roleOid_fkey" FOREIGN KEY ("roleOid") REFERENCES "SsoConnectionRole"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoDirectoryUserProfile" ADD CONSTRAINT "SsoDirectoryUserProfile_directoryOid_fkey" FOREIGN KEY ("directoryOid") REFERENCES "SsoDirectory"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoDirectoryUserProfile" ADD CONSTRAINT "SsoDirectoryUserProfile_userProfileOid_fkey" FOREIGN KEY ("userProfileOid") REFERENCES "SsoUserProfile"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoConnectionSetup" ADD CONSTRAINT "SsoConnectionSetup_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "SsoTenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoConnectionSetup" ADD CONSTRAINT "SsoConnectionSetup_connectionOid_fkey" FOREIGN KEY ("connectionOid") REFERENCES "SsoConnection"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoTenant" ADD CONSTRAINT "SsoTenant_appOid_fkey" FOREIGN KEY ("appOid") REFERENCES "App"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoTenant" ADD CONSTRAINT "SsoTenant_accountOid_fkey" FOREIGN KEY ("accountOid") REFERENCES "Account"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoTenant" ADD CONSTRAINT "SsoTenant_importedDelegationOid_fkey" FOREIGN KEY ("importedDelegationOid") REFERENCES "SsoImportedDelegation"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoTest" ADD CONSTRAINT "SsoTest_authOid_fkey" FOREIGN KEY ("authOid") REFERENCES "SsoAuth"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoTest" ADD CONSTRAINT "SsoTest_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "SsoTenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoTest" ADD CONSTRAINT "SsoTest_connectionOid_fkey" FOREIGN KEY ("connectionOid") REFERENCES "SsoConnection"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoUser" ADD CONSTRAINT "SsoUser_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "SsoTenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoUser" ADD CONSTRAINT "SsoUser_ownerProfileOid_fkey" FOREIGN KEY ("ownerProfileOid") REFERENCES "SsoUserProfile"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoUserChange" ADD CONSTRAINT "SsoUserChange_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "SsoTenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoUserChange" ADD CONSTRAINT "SsoUserChange_userOid_fkey" FOREIGN KEY ("userOid") REFERENCES "SsoUser"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoUserChange" ADD CONSTRAINT "SsoUserChange_scimOperationOid_fkey" FOREIGN KEY ("scimOperationOid") REFERENCES "SsoScimOperation"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailDomain" ADD CONSTRAINT "EmailDomain_appOid_fkey" FOREIGN KEY ("appOid") REFERENCES "App"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserEmail" ADD CONSTRAINT "UserEmail_domainOid_fkey" FOREIGN KEY ("domainOid") REFERENCES "EmailDomain"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserEmail" ADD CONSTRAINT "UserEmail_userOid_fkey" FOREIGN KEY ("userOid") REFERENCES "User"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserEmail" ADD CONSTRAINT "UserEmail_appOid_fkey" FOREIGN KEY ("appOid") REFERENCES "App"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserEmailVerification" ADD CONSTRAINT "UserEmailVerification_userOid_fkey" FOREIGN KEY ("userOid") REFERENCES "User"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserEmailVerification" ADD CONSTRAINT "UserEmailVerification_userEmailOid_fkey" FOREIGN KEY ("userEmailOid") REFERENCES "UserEmail"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserIdentityProvider" ADD CONSTRAINT "UserIdentityProvider_oauthProviderOid_fkey" FOREIGN KEY ("oauthProviderOid") REFERENCES "AppOAuthProvider"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserIdentityProvider" ADD CONSTRAINT "UserIdentityProvider_ssoTenantOid_fkey" FOREIGN KEY ("ssoTenantOid") REFERENCES "SsoTenant"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserIdentity" ADD CONSTRAINT "UserIdentity_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "UserIdentityProvider"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserIdentity" ADD CONSTRAINT "UserIdentity_userOid_fkey" FOREIGN KEY ("userOid") REFERENCES "User"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserIdentity" ADD CONSTRAINT "UserIdentity_ssoUserProfileOid_fkey" FOREIGN KEY ("ssoUserProfileOid") REFERENCES "SsoUserProfile"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTermsAgreement" ADD CONSTRAINT "UserTermsAgreement_userOid_fkey" FOREIGN KEY ("userOid") REFERENCES "User"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTermsAgreement" ADD CONSTRAINT "UserTermsAgreement_typeOid_fkey" FOREIGN KEY ("typeOid") REFERENCES "UserTermsType"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTwoFactor" ADD CONSTRAINT "UserTwoFactor_userOid_fkey" FOREIGN KEY ("userOid") REFERENCES "User"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRecoveryCode" ADD CONSTRAINT "UserRecoveryCode_userOid_fkey" FOREIGN KEY ("userOid") REFERENCES "User"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTwoFactorSetup" ADD CONSTRAINT "UserTwoFactorSetup_userOid_fkey" FOREIGN KEY ("userOid") REFERENCES "User"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTwoFactorSetup" ADD CONSTRAINT "UserTwoFactorSetup_sessionOid_fkey" FOREIGN KEY ("sessionOid") REFERENCES "AuthDeviceUserSession"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_appOid_fkey" FOREIGN KEY ("appOid") REFERENCES "App"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_accountOid_fkey" FOREIGN KEY ("accountOid") REFERENCES "Account"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPassword" ADD CONSTRAINT "UserPassword_userOid_fkey" FOREIGN KEY ("userOid") REFERENCES "User"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

