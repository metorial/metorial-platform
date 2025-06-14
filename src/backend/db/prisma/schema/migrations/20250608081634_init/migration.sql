-- CreateEnum
CREATE TYPE "OutgoingEmailDestinationStatus" AS ENUM ('pending', 'sent', 'retry', 'failed');

-- CreateEnum
CREATE TYPE "OutgoingEmailSendStatus" AS ENUM ('success', 'failed');

-- CreateEnum
CREATE TYPE "EmailIdentityType" AS ENUM ('email');

-- CreateEnum
CREATE TYPE "FilePurposeOwnerType" AS ENUM ('user', 'organization', 'instance');

-- CreateEnum
CREATE TYPE "FileStatus" AS ENUM ('active', 'deleted');

-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('active', 'completed', 'canceled', 'used');

-- CreateEnum
CREATE TYPE "ApiKeyType" AS ENUM ('user_auth_token', 'organization_management_token', 'instance_access_token_secret', 'instance_access_token_publishable');

-- CreateEnum
CREATE TYPE "ApiKeyStatus" AS ENUM ('active', 'deleted', 'expired');

-- CreateEnum
CREATE TYPE "MachineAccessType" AS ENUM ('user_auth_token', 'organization_management', 'instance_secret', 'instance_publishable');

-- CreateEnum
CREATE TYPE "MachineAccessStatus" AS ENUM ('active', 'deleted');

-- CreateEnum
CREATE TYPE "OrganizationActorType" AS ENUM ('member', 'machine_access', 'system');

-- CreateEnum
CREATE TYPE "InstanceType" AS ENUM ('development', 'production');

-- CreateEnum
CREATE TYPE "InstanceStatus" AS ENUM ('active', 'deleted');

-- CreateEnum
CREATE TYPE "OrganizationMemberRole" AS ENUM ('admin', 'member');

-- CreateEnum
CREATE TYPE "OrganizationMemberStatus" AS ENUM ('active', 'deleted');

-- CreateEnum
CREATE TYPE "OrganizationInviteType" AS ENUM ('email', 'link');

-- CreateEnum
CREATE TYPE "OrganizationInviteStatus" AS ENUM ('pending', 'accepted', 'rejected', 'deleted');

-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('default', 'user');

-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('active', 'deleted');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('active', 'deleted');

-- CreateEnum
CREATE TYPE "SecretStatus" AS ENUM ('active', 'deleted');

-- CreateEnum
CREATE TYPE "SecretEventType" AS ENUM ('secret_created', 'secret_read', 'secret_deleted');

-- CreateEnum
CREATE TYPE "ServerListingStatus" AS ENUM ('active', 'archived', 'banned');

-- CreateEnum
CREATE TYPE "ProfileType" AS ENUM ('system', 'user', 'organization');

-- CreateEnum
CREATE TYPE "ServerType" AS ENUM ('imported');

-- CreateEnum
CREATE TYPE "ServerVariantSourceType" AS ENUM ('docker', 'remote');

-- CreateEnum
CREATE TYPE "ServerDeploymentStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "ServerImplementationStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "SessionEventType" AS ENUM ('server_run_error', 'server_logs');

-- CreateEnum
CREATE TYPE "SessionMessageType" AS ENUM ('request', 'response', 'notification', 'error', 'server_error', 'unknown', 'debug');

-- CreateEnum
CREATE TYPE "SessionMessageSenderType" AS ENUM ('server', 'client');

-- CreateEnum
CREATE TYPE "ServerRunStatus" AS ENUM ('active', 'failed', 'completed');

-- CreateEnum
CREATE TYPE "ServerRunType" AS ENUM ('hosted', 'external');

-- CreateEnum
CREATE TYPE "SessionMcpConnectionType" AS ENUM ('sse', 'streamable_http', 'websocket');

-- CreateEnum
CREATE TYPE "ServerSessionStatus" AS ENUM ('pending', 'running', 'stopped');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('active', 'deleted');

-- CreateEnum
CREATE TYPE "SessionConnectionType" AS ENUM ('mcp', 'unified');

-- CreateEnum
CREATE TYPE "SessionConnectionStatus" AS ENUM ('connected', 'disconnected');

-- CreateEnum
CREATE TYPE "ServerRunnerType" AS ENUM ('hosted');

-- CreateEnum
CREATE TYPE "ServerRunnerStatus" AS ENUM ('online', 'offline');

-- CreateEnum
CREATE TYPE "ServerRunnerAttribute" AS ENUM ('supports_docker_images');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'deleted');

-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('user');

-- CreateTable
CREATE TABLE "OutgoingEmail" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "numberOfDestinations" INTEGER NOT NULL,
    "numberOfDestinationsCompleted" INTEGER NOT NULL,
    "identityId" BIGINT NOT NULL,
    "values" JSONB NOT NULL,
    "subject" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutgoingEmail_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "OutgoingEmailDestination" (
    "id" BIGSERIAL NOT NULL,
    "status" "OutgoingEmailDestinationStatus" NOT NULL,
    "emailId" BIGINT NOT NULL,
    "destination" TEXT NOT NULL,

    CONSTRAINT "OutgoingEmailDestination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutgoingEmailContent" (
    "emailId" BIGINT NOT NULL,
    "html" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "subject" TEXT NOT NULL,

    CONSTRAINT "OutgoingEmailContent_pkey" PRIMARY KEY ("emailId")
);

-- CreateTable
CREATE TABLE "OutgoingEmailSend" (
    "id" BIGSERIAL NOT NULL,
    "status" "OutgoingEmailSendStatus" NOT NULL,
    "destinationId" BIGINT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutgoingEmailSend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailIdentity" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "type" "EmailIdentityType" NOT NULL,
    "slug" TEXT NOT NULL,
    "fromName" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "subjectMarker" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailIdentity_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "FilePurpose" (
    "oid" SERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "ownerType" "FilePurposeOwnerType" NOT NULL,
    "canHaveLinks" BOOLEAN NOT NULL DEFAULT false,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FilePurpose_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "File" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "FileStatus" NOT NULL DEFAULT 'active',
    "storeId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileType" TEXT NOT NULL,
    "purposeOid" INTEGER NOT NULL,
    "userOid" BIGINT,
    "organizationOid" BIGINT,
    "instanceOid" BIGINT,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "File_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "FileLink" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "fileOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "FileLink_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Upload" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "FileStatus" NOT NULL DEFAULT 'active',
    "storeId" TEXT NOT NULL,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "fileType" TEXT,
    "userOid" BIGINT,
    "organizationOid" BIGINT,
    "instanceOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Upload_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ApiKeySecret" (
    "id" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "secretSha512" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "rolledAt" TIMESTAMP(3),
    "apiKeyOid" BIGINT NOT NULL,

    CONSTRAINT "ApiKeySecret_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "type" "ApiKeyType" NOT NULL,
    "status" "ApiKeyStatus" NOT NULL,
    "secretRedacted" TEXT NOT NULL,
    "secretLength" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "canRevealUntil" TIMESTAMP(3),
    "canRevealForever" BOOLEAN NOT NULL,
    "machineAccessOid" BIGINT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "MachineAccess" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "type" "MachineAccessType" NOT NULL,
    "status" "MachineAccessStatus" NOT NULL,
    "name" TEXT NOT NULL,
    "actorOid" BIGINT,
    "instanceOid" BIGINT,
    "organizationOid" BIGINT,
    "userOid" BIGINT,
    "deletedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MachineAccess_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "OrganizationActor" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "type" "OrganizationActorType" NOT NULL,
    "isSystem" BOOLEAN,
    "email" TEXT,
    "name" TEXT NOT NULL,
    "image" JSONB NOT NULL,
    "organizationOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationActor_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "OrganizationUserConfig" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "organizationOid" BIGINT NOT NULL,
    "memberOid" BIGINT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationUserConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Instance" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "type" "InstanceType" NOT NULL,
    "status" "InstanceStatus" NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "projectOid" BIGINT NOT NULL,
    "organizationOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Instance_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "OrganizationMember" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "role" "OrganizationMemberRole" NOT NULL,
    "status" "OrganizationMemberStatus" NOT NULL,
    "lastActiveAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userOid" BIGINT NOT NULL,
    "deletedUserId" TEXT,
    "organizationOid" BIGINT NOT NULL,
    "actorOid" BIGINT NOT NULL,

    CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "OrganizationInvite" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "OrganizationInviteStatus" NOT NULL,
    "type" "OrganizationInviteType" NOT NULL,
    "role" "OrganizationMemberRole" NOT NULL,
    "key" TEXT NOT NULL,
    "email" TEXT,
    "message" TEXT,
    "invitedByOid" BIGINT NOT NULL,
    "organizationOid" BIGINT NOT NULL,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),

    CONSTRAINT "OrganizationInvite_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "OrganizationInviteJoin" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "inviteOid" BIGINT NOT NULL,
    "memberOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationInviteJoin_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Organization" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "type" "OrganizationType" NOT NULL,
    "status" "OrganizationStatus" NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "image" JSONB NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Project" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "ProjectStatus" NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organizationOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SecretType" (
    "oid" SERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecretType_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SecretStore" (
    "oid" SERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecretStore_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Secret" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SecretStatus" NOT NULL,
    "description" TEXT,
    "metadata" JSONB NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "encryptedData" TEXT,
    "typeOid" INTEGER NOT NULL,
    "storeOid" INTEGER NOT NULL,
    "organizationOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "Secret_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SecretEvent" (
    "id" TEXT NOT NULL,
    "type" "SecretEventType" NOT NULL,
    "secretOid" BIGINT NOT NULL,
    "organizationActorOid" BIGINT,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecretEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportedRepository" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "providerUrl" TEXT NOT NULL,
    "websiteUrl" TEXT,
    "provider" TEXT NOT NULL,
    "providerId" TEXT,
    "providerFullIdentifier" TEXT,
    "providerIdentifier" TEXT,
    "providerOwnerId" TEXT,
    "providerOwnerIdentifier" TEXT,
    "providerOwnerUrl" TEXT,
    "isFork" BOOLEAN NOT NULL,
    "isArchived" BOOLEAN NOT NULL,
    "starCount" INTEGER NOT NULL,
    "forkCount" INTEGER NOT NULL,
    "watcherCount" INTEGER NOT NULL,
    "openIssuesCount" INTEGER NOT NULL,
    "subscriptionCount" INTEGER NOT NULL,
    "size" INTEGER NOT NULL,
    "defaultBranch" TEXT NOT NULL,
    "licenseName" TEXT,
    "licenseUrl" TEXT,
    "licenseSpdxId" TEXT,
    "topics" JSONB NOT NULL,
    "language" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pushedAt" TIMESTAMP(3),

    CONSTRAINT "ImportedRepository_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ImportedServer" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "vendorOid" BIGINT NOT NULL,
    "repositoryOid" BIGINT,
    "serverOid" BIGINT NOT NULL,
    "identifier" TEXT NOT NULL,
    "fullSlug" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "subdirectory" TEXT,
    "isOfficial" BOOLEAN NOT NULL,
    "isCommunity" BOOLEAN NOT NULL,
    "isHostable" BOOLEAN NOT NULL,
    "readme" TEXT,
    "attributes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportedServer_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ImportedServerVendor" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "image" JSONB NOT NULL,
    "attributes" JSONB NOT NULL,
    "profileOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportedServerVendor_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ServerListingCollection" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServerListingCollection_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ServerListingCategory" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServerListingCategory_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ServerListing" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "ServerListingStatus" NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "readme" TEXT,
    "rank" INTEGER NOT NULL DEFAULT 0,
    "skills" TEXT[],
    "deploymentsCount" INTEGER NOT NULL DEFAULT 0,
    "repoStarsCount" INTEGER NOT NULL DEFAULT 0,
    "serverSessionsCount" INTEGER NOT NULL DEFAULT 0,
    "serverMessagesCount" INTEGER NOT NULL DEFAULT 0,
    "profileOid" BIGINT,
    "serverOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rankUpdatedAt" TIMESTAMP(3),

    CONSTRAINT "ServerListing_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Profile" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "slug" TEXT NOT NULL,
    "image" JSONB NOT NULL,
    "attributes" JSONB NOT NULL,
    "organizationOid" BIGINT,
    "userOid" BIGINT,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ServerConfigSchema" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "schema" JSONB NOT NULL,
    "serverVariantOid" BIGINT NOT NULL,
    "serverOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServerConfigSchema_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ServerVariantProvider" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "image" JSONB NOT NULL,
    "attributes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServerVariantProvider_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Server" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "type" "ServerType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "ownerOrganizationOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Server_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ServerVariant" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "providerOid" BIGINT NOT NULL,
    "serverOid" BIGINT NOT NULL,
    "currentVersionOid" BIGINT,
    "sourceType" "ServerVariantSourceType" NOT NULL,
    "dockerImage" TEXT,
    "remoteUrl" TEXT,
    "tools" JSONB NOT NULL DEFAULT 'null',
    "prompts" JSONB NOT NULL DEFAULT 'null',
    "resourceTemplates" JSONB NOT NULL DEFAULT 'null',
    "serverInfo" JSONB NOT NULL DEFAULT 'null',
    "serverCapabilities" JSONB NOT NULL DEFAULT 'null',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServerVariant_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ServerVersion" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "serverOid" BIGINT NOT NULL,
    "serverVariantOid" BIGINT NOT NULL,
    "schemaOid" BIGINT NOT NULL,
    "getLaunchParams" TEXT NOT NULL,
    "sourceType" "ServerVariantSourceType" NOT NULL,
    "dockerImage" TEXT,
    "dockerTag" TEXT,
    "remoteUrl" TEXT,
    "tools" JSONB NOT NULL DEFAULT 'null',
    "prompts" JSONB NOT NULL DEFAULT 'null',
    "resourceTemplates" JSONB NOT NULL DEFAULT 'null',
    "serverInfo" JSONB NOT NULL DEFAULT 'null',
    "serverCapabilities" JSONB NOT NULL DEFAULT 'null',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServerVersion_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ServerDeploymentConfig" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "isEphemeral" BOOLEAN NOT NULL DEFAULT false,
    "schemaOid" BIGINT NOT NULL,
    "configSecretOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServerDeploymentConfig_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ServerDeployment" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "ServerDeploymentStatus" NOT NULL,
    "isEphemeral" BOOLEAN NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "serverImplementationOid" BIGINT NOT NULL,
    "serverVariantOid" BIGINT NOT NULL,
    "serverOid" BIGINT NOT NULL,
    "configOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ServerDeployment_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ServerImplementation" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "ServerImplementationStatus" NOT NULL,
    "isEphemeral" BOOLEAN NOT NULL,
    "isDefault" BOOLEAN,
    "name" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "getLaunchParams" TEXT,
    "serverVariantOid" BIGINT NOT NULL,
    "serverOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ServerImplementation_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "InstanceServer" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "serverOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstanceServer_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ServerRunErrorGroup" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "serverOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "defaultServerRunErrorOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServerRunErrorGroup_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ServerRunError" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "serverDeploymentOid" BIGINT NOT NULL,
    "serverRunErrorGroupOid" BIGINT NOT NULL,
    "serverRunOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServerRunError_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SessionEvent" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "type" "SessionEventType" NOT NULL,
    "payload" JSONB,
    "logLines" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sessionOid" BIGINT NOT NULL,
    "serverRunOid" BIGINT,
    "serverRunErrorOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionEvent_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SessionMessage" (
    "id" TEXT NOT NULL,
    "type" "SessionMessageType" NOT NULL,
    "senderType" "SessionMessageSenderType" NOT NULL,
    "senderId" TEXT NOT NULL,
    "method" TEXT,
    "originalId" JSONB,
    "unifiedId" TEXT,
    "payload" JSONB NOT NULL,
    "isHandled" BOOLEAN NOT NULL DEFAULT false,
    "sessionOid" BIGINT NOT NULL,
    "serverSessionOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServerRun" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "ServerRunStatus" NOT NULL,
    "type" "ServerRunType" NOT NULL,
    "serverVersionOid" BIGINT NOT NULL,
    "serverDeploymentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "serverSessionOid" BIGINT NOT NULL,
    "serverRunnerOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "stoppedAt" TIMESTAMP(3),
    "lastPingAt" TIMESTAMP(3),

    CONSTRAINT "ServerRun_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ServerSession" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "ServerSessionStatus" NOT NULL,
    "mcpVersion" TEXT,
    "mcpInitialized" BOOLEAN,
    "mcpConnectionType" "SessionMcpConnectionType",
    "serverDeploymentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "sessionOid" BIGINT NOT NULL,
    "clientInfo" JSONB,
    "clientCapabilities" JSONB,
    "serverInfo" JSONB,
    "serverCapabilities" JSONB,
    "totalProductiveClientMessageCount" INTEGER NOT NULL DEFAULT 0,
    "totalProductiveServerMessageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastClientActionAt" TIMESTAMP(3),
    "lastServerActionAt" TIMESTAMP(3),

    CONSTRAINT "ServerSession_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Session" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "clientSecretId" TEXT NOT NULL,
    "clientSecretValue" TEXT NOT NULL,
    "clientSecretExpiresAt" TIMESTAMP(3),
    "status" "SessionStatus" NOT NULL,
    "connectionStatus" "SessionConnectionStatus" NOT NULL,
    "connectionType" "SessionConnectionType" NOT NULL,
    "totalProductiveClientMessageCount" INTEGER NOT NULL DEFAULT 0,
    "totalProductiveServerMessageCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "lastClientActionAt" TIMESTAMP(3),
    "lastClientPingAt" TIMESTAMP(3),
    "instanceOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ServerRunner" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "type" "ServerRunnerType" NOT NULL,
    "status" "ServerRunnerStatus" NOT NULL,
    "identifier" TEXT NOT NULL,
    "connectionKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "attributes" "ServerRunnerAttribute"[],
    "tags" TEXT[],
    "maxConcurrentJobs" INTEGER NOT NULL DEFAULT 1,
    "runnerVersion" TEXT NOT NULL DEFAULT 'v1.0.0',
    "activeJobs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3),

    CONSTRAINT "ServerRunner_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "User" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL,
    "type" "UserType" NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "image" JSONB NOT NULL,
    "passwordHash" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "UserSession" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "clientSecret" TEXT NOT NULL,
    "userOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "_ServerListingToServerListingCategory" (
    "A" BIGINT NOT NULL,
    "B" BIGINT NOT NULL,

    CONSTRAINT "_ServerListingToServerListingCategory_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ServerListingToServerListingCollection" (
    "A" BIGINT NOT NULL,
    "B" BIGINT NOT NULL,

    CONSTRAINT "_ServerListingToServerListingCollection_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ServerDeploymentToSession" (
    "A" BIGINT NOT NULL,
    "B" BIGINT NOT NULL,

    CONSTRAINT "_ServerDeploymentToSession_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailIdentity_id_key" ON "EmailIdentity"("id");

-- CreateIndex
CREATE UNIQUE INDEX "EmailIdentity_slug_key" ON "EmailIdentity"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "FilePurpose_id_key" ON "FilePurpose"("id");

-- CreateIndex
CREATE UNIQUE INDEX "FilePurpose_slug_key" ON "FilePurpose"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "File_id_key" ON "File"("id");

-- CreateIndex
CREATE UNIQUE INDEX "File_storeId_key" ON "File"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "FileLink_id_key" ON "FileLink"("id");

-- CreateIndex
CREATE UNIQUE INDEX "FileLink_key_key" ON "FileLink"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Upload_id_key" ON "Upload"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Upload_storeId_key" ON "Upload"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKeySecret_secret_key" ON "ApiKeySecret"("secret");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKeySecret_secretSha512_key" ON "ApiKeySecret"("secretSha512");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_id_key" ON "ApiKey"("id");

-- CreateIndex
CREATE INDEX "ApiKey_expiresAt_idx" ON "ApiKey"("expiresAt");

-- CreateIndex
CREATE INDEX "ApiKey_status_idx" ON "ApiKey"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MachineAccess_id_key" ON "MachineAccess"("id");

-- CreateIndex
CREATE UNIQUE INDEX "MachineAccess_actorOid_key" ON "MachineAccess"("actorOid");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationActor_id_key" ON "OrganizationActor"("id");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationActor_isSystem_organizationOid_key" ON "OrganizationActor"("isSystem", "organizationOid");

-- CreateIndex
CREATE INDEX "OrganizationUserConfig_key_type_idx" ON "OrganizationUserConfig"("key", "type");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationUserConfig_memberOid_organizationOid_key_type_key" ON "OrganizationUserConfig"("memberOid", "organizationOid", "key", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Instance_id_key" ON "Instance"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Instance_slug_key" ON "Instance"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMember_id_key" ON "OrganizationMember"("id");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMember_actorOid_key" ON "OrganizationMember"("actorOid");

-- CreateIndex
CREATE INDEX "OrganizationMember_lastActiveAt_idx" ON "OrganizationMember"("lastActiveAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMember_userOid_organizationOid_key" ON "OrganizationMember"("userOid", "organizationOid");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationInvite_id_key" ON "OrganizationInvite"("id");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationInvite_key_key" ON "OrganizationInvite"("key");

-- CreateIndex
CREATE INDEX "OrganizationInvite_email_idx" ON "OrganizationInvite"("email");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationInviteJoin_id_key" ON "OrganizationInviteJoin"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_id_key" ON "Organization"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Project_id_key" ON "Project"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "SecretType_id_key" ON "SecretType"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SecretType_slug_key" ON "SecretType"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "SecretStore_id_key" ON "SecretStore"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SecretStore_slug_key" ON "SecretStore"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Secret_id_key" ON "Secret"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ImportedRepository_id_key" ON "ImportedRepository"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ImportedRepository_identifier_key" ON "ImportedRepository"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "ImportedServer_id_key" ON "ImportedServer"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ImportedServer_serverOid_key" ON "ImportedServer"("serverOid");

-- CreateIndex
CREATE UNIQUE INDEX "ImportedServer_identifier_key" ON "ImportedServer"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "ImportedServer_fullSlug_key" ON "ImportedServer"("fullSlug");

-- CreateIndex
CREATE UNIQUE INDEX "ImportedServer_vendorOid_slug_key" ON "ImportedServer"("vendorOid", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "ImportedServerVendor_id_key" ON "ImportedServerVendor"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ImportedServerVendor_identifier_key" ON "ImportedServerVendor"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "ServerListingCollection_id_key" ON "ServerListingCollection"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ServerListingCollection_slug_key" ON "ServerListingCollection"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ServerListingCategory_id_key" ON "ServerListingCategory"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ServerListingCategory_slug_key" ON "ServerListingCategory"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ServerListing_id_key" ON "ServerListing"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ServerListing_slug_key" ON "ServerListing"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ServerListing_serverOid_key" ON "ServerListing"("serverOid");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_id_key" ON "Profile"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_slug_key" ON "Profile"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_organizationOid_key" ON "Profile"("organizationOid");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_userOid_key" ON "Profile"("userOid");

-- CreateIndex
CREATE UNIQUE INDEX "ServerConfigSchema_id_key" ON "ServerConfigSchema"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ServerConfigSchema_fingerprint_serverOid_key" ON "ServerConfigSchema"("fingerprint", "serverOid");

-- CreateIndex
CREATE UNIQUE INDEX "ServerVariantProvider_id_key" ON "ServerVariantProvider"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ServerVariantProvider_identifier_key" ON "ServerVariantProvider"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "Server_id_key" ON "Server"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ServerVariant_id_key" ON "ServerVariant"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ServerVariant_identifier_key" ON "ServerVariant"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "ServerVersion_id_key" ON "ServerVersion"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ServerVersion_identifier_serverVariantOid_key" ON "ServerVersion"("identifier", "serverVariantOid");

-- CreateIndex
CREATE UNIQUE INDEX "ServerDeploymentConfig_id_key" ON "ServerDeploymentConfig"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ServerDeployment_id_key" ON "ServerDeployment"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ServerImplementation_id_key" ON "ServerImplementation"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ServerImplementation_serverVariantOid_instanceOid_isDefault_key" ON "ServerImplementation"("serverVariantOid", "instanceOid", "isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "InstanceServer_id_key" ON "InstanceServer"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ServerRunErrorGroup_id_key" ON "ServerRunErrorGroup"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ServerRunErrorGroup_fingerprint_serverOid_instanceOid_key" ON "ServerRunErrorGroup"("fingerprint", "serverOid", "instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "ServerRunError_id_key" ON "ServerRunError"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SessionEvent_id_key" ON "SessionEvent"("id");

-- CreateIndex
CREATE INDEX "SessionMessage_unifiedId_idx" ON "SessionMessage"("unifiedId");

-- CreateIndex
CREATE UNIQUE INDEX "ServerRun_id_key" ON "ServerRun"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ServerSession_id_key" ON "ServerSession"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Session_id_key" ON "Session"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Session_clientSecretValue_key" ON "Session"("clientSecretValue");

-- CreateIndex
CREATE INDEX "Session_connectionStatus_idx" ON "Session"("connectionStatus");

-- CreateIndex
CREATE INDEX "Session_lastClientPingAt_idx" ON "Session"("lastClientPingAt");

-- CreateIndex
CREATE UNIQUE INDEX "ServerRunner_id_key" ON "ServerRunner"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ServerRunner_identifier_key" ON "ServerRunner"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "ServerRunner_connectionKey_key" ON "ServerRunner"("connectionKey");

-- CreateIndex
CREATE INDEX "ServerRunner_lastSeenAt_idx" ON "ServerRunner"("lastSeenAt");

-- CreateIndex
CREATE INDEX "ServerRunner_status_idx" ON "ServerRunner"("status");

-- CreateIndex
CREATE INDEX "ServerRunner_type_idx" ON "ServerRunner"("type");

-- CreateIndex
CREATE UNIQUE INDEX "User_id_key" ON "User"("id");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserSession_id_key" ON "UserSession"("id");

-- CreateIndex
CREATE UNIQUE INDEX "UserSession_clientSecret_key" ON "UserSession"("clientSecret");

-- CreateIndex
CREATE INDEX "_ServerListingToServerListingCategory_B_index" ON "_ServerListingToServerListingCategory"("B");

-- CreateIndex
CREATE INDEX "_ServerListingToServerListingCollection_B_index" ON "_ServerListingToServerListingCollection"("B");

-- CreateIndex
CREATE INDEX "_ServerDeploymentToSession_B_index" ON "_ServerDeploymentToSession"("B");

-- AddForeignKey
ALTER TABLE "OutgoingEmail" ADD CONSTRAINT "OutgoingEmail_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "EmailIdentity"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutgoingEmailDestination" ADD CONSTRAINT "OutgoingEmailDestination_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "OutgoingEmail"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutgoingEmailContent" ADD CONSTRAINT "OutgoingEmailContent_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "OutgoingEmail"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutgoingEmailSend" ADD CONSTRAINT "OutgoingEmailSend_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "OutgoingEmailDestination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_purposeOid_fkey" FOREIGN KEY ("purposeOid") REFERENCES "FilePurpose"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_userOid_fkey" FOREIGN KEY ("userOid") REFERENCES "User"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileLink" ADD CONSTRAINT "FileLink_fileOid_fkey" FOREIGN KEY ("fileOid") REFERENCES "File"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_userOid_fkey" FOREIGN KEY ("userOid") REFERENCES "User"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKeySecret" ADD CONSTRAINT "ApiKeySecret_apiKeyOid_fkey" FOREIGN KEY ("apiKeyOid") REFERENCES "ApiKey"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_machineAccessOid_fkey" FOREIGN KEY ("machineAccessOid") REFERENCES "MachineAccess"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineAccess" ADD CONSTRAINT "MachineAccess_actorOid_fkey" FOREIGN KEY ("actorOid") REFERENCES "OrganizationActor"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineAccess" ADD CONSTRAINT "MachineAccess_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineAccess" ADD CONSTRAINT "MachineAccess_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineAccess" ADD CONSTRAINT "MachineAccess_userOid_fkey" FOREIGN KEY ("userOid") REFERENCES "User"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationActor" ADD CONSTRAINT "OrganizationActor_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationUserConfig" ADD CONSTRAINT "OrganizationUserConfig_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationUserConfig" ADD CONSTRAINT "OrganizationUserConfig_memberOid_fkey" FOREIGN KEY ("memberOid") REFERENCES "OrganizationMember"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Instance" ADD CONSTRAINT "Instance_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Instance" ADD CONSTRAINT "Instance_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_userOid_fkey" FOREIGN KEY ("userOid") REFERENCES "User"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_actorOid_fkey" FOREIGN KEY ("actorOid") REFERENCES "OrganizationActor"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationInvite" ADD CONSTRAINT "OrganizationInvite_invitedByOid_fkey" FOREIGN KEY ("invitedByOid") REFERENCES "OrganizationActor"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationInvite" ADD CONSTRAINT "OrganizationInvite_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationInviteJoin" ADD CONSTRAINT "OrganizationInviteJoin_inviteOid_fkey" FOREIGN KEY ("inviteOid") REFERENCES "OrganizationInvite"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationInviteJoin" ADD CONSTRAINT "OrganizationInviteJoin_memberOid_fkey" FOREIGN KEY ("memberOid") REFERENCES "OrganizationMember"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Secret" ADD CONSTRAINT "Secret_typeOid_fkey" FOREIGN KEY ("typeOid") REFERENCES "SecretType"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Secret" ADD CONSTRAINT "Secret_storeOid_fkey" FOREIGN KEY ("storeOid") REFERENCES "SecretStore"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Secret" ADD CONSTRAINT "Secret_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Secret" ADD CONSTRAINT "Secret_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecretEvent" ADD CONSTRAINT "SecretEvent_secretOid_fkey" FOREIGN KEY ("secretOid") REFERENCES "Secret"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecretEvent" ADD CONSTRAINT "SecretEvent_organizationActorOid_fkey" FOREIGN KEY ("organizationActorOid") REFERENCES "OrganizationActor"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportedServer" ADD CONSTRAINT "ImportedServer_vendorOid_fkey" FOREIGN KEY ("vendorOid") REFERENCES "ImportedServerVendor"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportedServer" ADD CONSTRAINT "ImportedServer_repositoryOid_fkey" FOREIGN KEY ("repositoryOid") REFERENCES "ImportedRepository"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportedServer" ADD CONSTRAINT "ImportedServer_serverOid_fkey" FOREIGN KEY ("serverOid") REFERENCES "Server"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportedServerVendor" ADD CONSTRAINT "ImportedServerVendor_profileOid_fkey" FOREIGN KEY ("profileOid") REFERENCES "Profile"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerListing" ADD CONSTRAINT "ServerListing_profileOid_fkey" FOREIGN KEY ("profileOid") REFERENCES "Profile"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerListing" ADD CONSTRAINT "ServerListing_serverOid_fkey" FOREIGN KEY ("serverOid") REFERENCES "Server"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userOid_fkey" FOREIGN KEY ("userOid") REFERENCES "User"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerConfigSchema" ADD CONSTRAINT "ServerConfigSchema_serverVariantOid_fkey" FOREIGN KEY ("serverVariantOid") REFERENCES "ServerVariant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerConfigSchema" ADD CONSTRAINT "ServerConfigSchema_serverOid_fkey" FOREIGN KEY ("serverOid") REFERENCES "Server"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Server" ADD CONSTRAINT "Server_ownerOrganizationOid_fkey" FOREIGN KEY ("ownerOrganizationOid") REFERENCES "Organization"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerVariant" ADD CONSTRAINT "ServerVariant_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "ServerVariantProvider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerVariant" ADD CONSTRAINT "ServerVariant_serverOid_fkey" FOREIGN KEY ("serverOid") REFERENCES "Server"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerVariant" ADD CONSTRAINT "ServerVariant_currentVersionOid_fkey" FOREIGN KEY ("currentVersionOid") REFERENCES "ServerVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerVersion" ADD CONSTRAINT "ServerVersion_serverOid_fkey" FOREIGN KEY ("serverOid") REFERENCES "Server"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerVersion" ADD CONSTRAINT "ServerVersion_serverVariantOid_fkey" FOREIGN KEY ("serverVariantOid") REFERENCES "ServerVariant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerVersion" ADD CONSTRAINT "ServerVersion_schemaOid_fkey" FOREIGN KEY ("schemaOid") REFERENCES "ServerConfigSchema"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerDeploymentConfig" ADD CONSTRAINT "ServerDeploymentConfig_schemaOid_fkey" FOREIGN KEY ("schemaOid") REFERENCES "ServerConfigSchema"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerDeploymentConfig" ADD CONSTRAINT "ServerDeploymentConfig_configSecretOid_fkey" FOREIGN KEY ("configSecretOid") REFERENCES "Secret"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerDeploymentConfig" ADD CONSTRAINT "ServerDeploymentConfig_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerDeployment" ADD CONSTRAINT "ServerDeployment_serverImplementationOid_fkey" FOREIGN KEY ("serverImplementationOid") REFERENCES "ServerImplementation"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerDeployment" ADD CONSTRAINT "ServerDeployment_serverVariantOid_fkey" FOREIGN KEY ("serverVariantOid") REFERENCES "ServerVariant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerDeployment" ADD CONSTRAINT "ServerDeployment_serverOid_fkey" FOREIGN KEY ("serverOid") REFERENCES "Server"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerDeployment" ADD CONSTRAINT "ServerDeployment_configOid_fkey" FOREIGN KEY ("configOid") REFERENCES "ServerDeploymentConfig"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerDeployment" ADD CONSTRAINT "ServerDeployment_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerImplementation" ADD CONSTRAINT "ServerImplementation_serverVariantOid_fkey" FOREIGN KEY ("serverVariantOid") REFERENCES "ServerVariant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerImplementation" ADD CONSTRAINT "ServerImplementation_serverOid_fkey" FOREIGN KEY ("serverOid") REFERENCES "Server"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerImplementation" ADD CONSTRAINT "ServerImplementation_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstanceServer" ADD CONSTRAINT "InstanceServer_serverOid_fkey" FOREIGN KEY ("serverOid") REFERENCES "Server"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstanceServer" ADD CONSTRAINT "InstanceServer_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerRunErrorGroup" ADD CONSTRAINT "ServerRunErrorGroup_serverOid_fkey" FOREIGN KEY ("serverOid") REFERENCES "Server"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerRunErrorGroup" ADD CONSTRAINT "ServerRunErrorGroup_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerRunErrorGroup" ADD CONSTRAINT "ServerRunErrorGroup_defaultServerRunErrorOid_fkey" FOREIGN KEY ("defaultServerRunErrorOid") REFERENCES "ServerRunError"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerRunError" ADD CONSTRAINT "ServerRunError_serverDeploymentOid_fkey" FOREIGN KEY ("serverDeploymentOid") REFERENCES "ServerDeployment"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerRunError" ADD CONSTRAINT "ServerRunError_serverRunErrorGroupOid_fkey" FOREIGN KEY ("serverRunErrorGroupOid") REFERENCES "ServerRunErrorGroup"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerRunError" ADD CONSTRAINT "ServerRunError_serverRunOid_fkey" FOREIGN KEY ("serverRunOid") REFERENCES "ServerRun"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerRunError" ADD CONSTRAINT "ServerRunError_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionEvent" ADD CONSTRAINT "SessionEvent_sessionOid_fkey" FOREIGN KEY ("sessionOid") REFERENCES "Session"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionEvent" ADD CONSTRAINT "SessionEvent_serverRunOid_fkey" FOREIGN KEY ("serverRunOid") REFERENCES "ServerRun"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionEvent" ADD CONSTRAINT "SessionEvent_serverRunErrorOid_fkey" FOREIGN KEY ("serverRunErrorOid") REFERENCES "ServerRunError"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionMessage" ADD CONSTRAINT "SessionMessage_sessionOid_fkey" FOREIGN KEY ("sessionOid") REFERENCES "Session"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionMessage" ADD CONSTRAINT "SessionMessage_serverSessionOid_fkey" FOREIGN KEY ("serverSessionOid") REFERENCES "ServerSession"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerRun" ADD CONSTRAINT "ServerRun_serverVersionOid_fkey" FOREIGN KEY ("serverVersionOid") REFERENCES "ServerVersion"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerRun" ADD CONSTRAINT "ServerRun_serverDeploymentOid_fkey" FOREIGN KEY ("serverDeploymentOid") REFERENCES "ServerDeployment"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerRun" ADD CONSTRAINT "ServerRun_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerRun" ADD CONSTRAINT "ServerRun_serverSessionOid_fkey" FOREIGN KEY ("serverSessionOid") REFERENCES "ServerSession"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerRun" ADD CONSTRAINT "ServerRun_serverRunnerOid_fkey" FOREIGN KEY ("serverRunnerOid") REFERENCES "ServerRunner"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerSession" ADD CONSTRAINT "ServerSession_serverDeploymentOid_fkey" FOREIGN KEY ("serverDeploymentOid") REFERENCES "ServerDeployment"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerSession" ADD CONSTRAINT "ServerSession_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerSession" ADD CONSTRAINT "ServerSession_sessionOid_fkey" FOREIGN KEY ("sessionOid") REFERENCES "Session"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userOid_fkey" FOREIGN KEY ("userOid") REFERENCES "User"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ServerListingToServerListingCategory" ADD CONSTRAINT "_ServerListingToServerListingCategory_A_fkey" FOREIGN KEY ("A") REFERENCES "ServerListing"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ServerListingToServerListingCategory" ADD CONSTRAINT "_ServerListingToServerListingCategory_B_fkey" FOREIGN KEY ("B") REFERENCES "ServerListingCategory"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ServerListingToServerListingCollection" ADD CONSTRAINT "_ServerListingToServerListingCollection_A_fkey" FOREIGN KEY ("A") REFERENCES "ServerListing"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ServerListingToServerListingCollection" ADD CONSTRAINT "_ServerListingToServerListingCollection_B_fkey" FOREIGN KEY ("B") REFERENCES "ServerListingCollection"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ServerDeploymentToSession" ADD CONSTRAINT "_ServerDeploymentToSession_A_fkey" FOREIGN KEY ("A") REFERENCES "ServerDeployment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ServerDeploymentToSession" ADD CONSTRAINT "_ServerDeploymentToSession_B_fkey" FOREIGN KEY ("B") REFERENCES "Session"("oid") ON DELETE CASCADE ON UPDATE CASCADE;
