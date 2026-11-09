-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "CliSignupBlockRuleType" AS ENUM ('ip', 'cidr', 'country', 'asn');

-- CreateEnum
CREATE TYPE "CliSignupAttemptOutcome" AS ENUM ('created', 'rate_limited', 'blocked', 'disabled', 'failed');

-- CreateEnum
CREATE TYPE "ConsumerSurfaceStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "ConsumerSurfaceType" AS ENUM ('portal', 'organization_members', 'cli');

-- CreateEnum
CREATE TYPE "AccountDomainStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "AccountDomainVerificationStatus" AS ENUM ('unverified', 'verified_basic', 'verified_full');

-- CreateEnum
CREATE TYPE "InstanceType" AS ENUM ('development', 'production');

-- CreateEnum
CREATE TYPE "InstanceStatus" AS ENUM ('active', 'deleted');

-- CreateEnum
CREATE TYPE "OAuthJwkStatus" AS ENUM ('active', 'next', 'retired');

-- CreateEnum
CREATE TYPE "OAuthApplicationStatus" AS ENUM ('active', 'archived');

-- CreateEnum
CREATE TYPE "OAuthApplicationType" AS ENUM ('user_facing', 'cli_auth', 'server_side');

-- CreateEnum
CREATE TYPE "OAuthAuthorizationAccessLevel" AS ENUM ('organization', 'global');

-- CreateEnum
CREATE TYPE "OAuthApplicationSubjectType" AS ENUM ('organization_member', 'consumer', 'consumer_or_organization_member');

-- CreateEnum
CREATE TYPE "OAuthSubjectType" AS ENUM ('organization_member', 'consumer');

-- CreateEnum
CREATE TYPE "OAuthAuthorizationRequestChallengeMethod" AS ENUM ('none', 's256');

-- CreateEnum
CREATE TYPE "OAuthAuthorizationRequestStatus" AS ENUM ('pending', 'accepted', 'denied');

-- CreateEnum
CREATE TYPE "OAuthAuthorizationRequestType" AS ENUM ('interactive', 'device_code');

-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('default', 'user');

-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('active', 'deleted');

-- CreateEnum
CREATE TYPE "PortalStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "PublicMcpServerStatus" AS ENUM ('active', 'disabled', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "SkillPluginStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'deleted');

-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('user');

-- CreateEnum
CREATE TYPE "WorkspaceType" AS ENUM ('organization', 'portal', 'enterprise');

-- CreateEnum
CREATE TYPE "WorkspaceStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "WorkspaceProfileStatus" AS ENUM ('active', 'deleted');

-- CreateEnum
CREATE TYPE "WorkspaceInviteStatus" AS ENUM ('pending', 'accepted', 'rejected', 'deleted');

-- CreateEnum
CREATE TYPE "WorkspaceGroupType" AS ENUM ('organization_team', 'consumer_group');

-- CreateEnum
CREATE TYPE "WorkspaceGroupStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "WorkspacePolicyType" AS ENUM ('organization_policy', 'enterprise_role');

-- CreateEnum
CREATE TYPE "WorkspacePolicyStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "WorkspaceAssignmentType" AS ENUM ('everyone', 'admin', 'custom');

-- CreateTable
CREATE TABLE "Cell" (
    "oid" SERIAL NOT NULL,
    "identifier" TEXT NOT NULL,
    "lastSyncRangeStart" TIMESTAMP(3),
    "lastSyncRangeEnd" TIMESTAMP(3),
    "endpointUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cell_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "CellToken" (
    "oid" SERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "cellOid" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CellToken_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Hyperplane" (
    "oid" SERIAL NOT NULL,
    "identifier" TEXT NOT NULL,
    "cellOid" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Hyperplane_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "HyperplaneToken" (
    "oid" SERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "hyperplaneOid" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HyperplaneToken_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Horizon" (
    "oid" SERIAL NOT NULL,
    "identifier" TEXT NOT NULL,
    "endpointUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Horizon_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "HorizonToken" (
    "oid" SERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "horizonOid" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HorizonToken_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "CliSignupBlockRule" (
    "oid" SERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "type" "CliSignupBlockRuleType" NOT NULL,
    "value" TEXT NOT NULL,
    "note" TEXT,
    "createdByAdminId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CliSignupBlockRule_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "CliSignupSetting" (
    "key" TEXT NOT NULL,
    "signupDisabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CliSignupSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "CliSignupIpWindow" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "windowEndsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CliSignupIpWindow_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "CliSignupAttempt" (
    "oid" SERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "outcome" "CliSignupAttemptOutcome" NOT NULL,
    "ip" TEXT NOT NULL,
    "country" TEXT,
    "asn" TEXT,
    "organizationId" TEXT,
    "blockRuleOid" INTEGER,
    "cellOid" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CliSignupAttempt_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ConsumerSurface" (
    "id" TEXT NOT NULL,
    "status" "ConsumerSurfaceStatus" NOT NULL,
    "type" "ConsumerSurfaceType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ownerOid" INTEGER NOT NULL,
    "organizationId" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsumerSurface_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountDomain" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "status" "AccountDomainStatus" NOT NULL,
    "verificationStatus" "AccountDomainVerificationStatus" NOT NULL,
    "accountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountDomain_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Instance" (
    "id" TEXT NOT NULL,
    "type" "InstanceType" NOT NULL,
    "status" "InstanceStatus" NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerOid" INTEGER NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Instance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthJwk" (
    "id" TEXT NOT NULL,
    "kid" TEXT NOT NULL,
    "status" "OAuthJwkStatus" NOT NULL,
    "alg" TEXT NOT NULL,
    "use" TEXT NOT NULL,
    "kty" TEXT NOT NULL,
    "crv" TEXT,
    "publicJwk" JSONB NOT NULL,
    "privateJwk" JSONB NOT NULL,
    "activatesAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "retiredAt" TIMESTAMP(3),
    "generatedByOid" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthJwk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlobalLease" (
    "name" TEXT NOT NULL,
    "token" TEXT,
    "expiresAt" TIMESTAMP(3),
    "holderOid" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GlobalLease_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "OAuthApplication" (
    "id" TEXT NOT NULL,
    "status" "OAuthApplicationStatus" NOT NULL,
    "type" "OAuthApplicationType" NOT NULL,
    "accessLevel" "OAuthAuthorizationAccessLevel" NOT NULL,
    "subjectType" "OAuthApplicationSubjectType" NOT NULL DEFAULT 'organization_member',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "websiteUrl" TEXT,
    "privacyPolicyUrl" TEXT,
    "termsOfServiceUrl" TEXT,
    "redirectUris" TEXT[],
    "scopes" TEXT[],
    "allowClientSecretlessTokenExchange" BOOLEAN NOT NULL DEFAULT false,
    "clientId" TEXT NOT NULL,
    "image" JSONB NOT NULL,
    "ownerOid" INTEGER NOT NULL,
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "OAuthApplicationClientSecret" (
    "id" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "oauthApplicationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3)
);

-- CreateTable
CREATE TABLE "OAuthAuthorizationRequest" (
    "id" TEXT NOT NULL,
    "type" "OAuthAuthorizationRequestType" NOT NULL,
    "status" "OAuthAuthorizationRequestStatus" NOT NULL,
    "subjectType" "OAuthSubjectType" NOT NULL DEFAULT 'organization_member',
    "urlToken" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "scopes" TEXT[],
    "oidcScopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "deviceCode" TEXT,
    "userCode" TEXT,
    "deniedAt" TIMESTAMP(3),
    "lastPollAt" TIMESTAMP(3),
    "clientIp" TEXT,
    "state" TEXT,
    "redirectUri" TEXT,
    "nonce" TEXT,
    "codeChallengeMethod" "OAuthAuthorizationRequestChallengeMethod" NOT NULL,
    "codeChallenge" TEXT,
    "userId" TEXT,
    "oauthApplicationId" TEXT NOT NULL,
    "claimedByOid" INTEGER,
    "createdByOid" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3)
);

-- CreateTable
CREATE TABLE "OAuthToken" (
    "id" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "oauthApplicationId" TEXT NOT NULL,
    "ownerOid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "type" "OrganizationType" NOT NULL,
    "status" "OrganizationStatus" NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "image" JSONB NOT NULL,
    "ownerOid" INTEGER NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Portal" (
    "id" TEXT NOT NULL,
    "status" "PortalStatus" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "slug" TEXT NOT NULL,
    "ownerOid" INTEGER NOT NULL,
    "organizationId" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Portal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlobalProfile" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GlobalProfile_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "GlobalProfileEmail" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "globalProfileOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GlobalProfileEmail_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "PublicMcpServer" (
    "id" TEXT NOT NULL,
    "status" "PublicMcpServerStatus" NOT NULL,
    "slug" TEXT NOT NULL,
    "ownerOid" INTEGER NOT NULL,
    "organizationId" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicMcpServer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillPlugin" (
    "id" TEXT NOT NULL,
    "status" "SkillPluginStatus" NOT NULL,
    "name" TEXT,
    "slug" TEXT,
    "ownerOid" INTEGER NOT NULL,
    "organizationId" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillPlugin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL,
    "type" "UserType" NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "image" JSONB NOT NULL,
    "lastEditByOid" INTEGER NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "type" "WorkspaceType" NOT NULL,
    "status" "WorkspaceStatus" NOT NULL,
    "name" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "portalId" TEXT,
    "organizationId" TEXT,
    "enterpriseId" TEXT,
    "ownerOid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceProfile" (
    "id" TEXT NOT NULL,
    "status" "WorkspaceProfileStatus" NOT NULL DEFAULT 'active',
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "userId" TEXT,
    "organizationMemberId" TEXT,
    "consumerId" TEXT,
    "consumerProfileId" TEXT,
    "instanceConsumerId" TEXT,
    "enterpriseMemberId" TEXT,
    "workspaceId" TEXT NOT NULL,
    "globalProfileId" TEXT NOT NULL,
    "ownerOid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceInvite" (
    "id" TEXT NOT NULL,
    "status" "WorkspaceInviteStatus" NOT NULL DEFAULT 'pending',
    "email" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "globalProfileId" TEXT NOT NULL,
    "consumerInviteId" TEXT,
    "organizationInviteId" TEXT,
    "enterpriseInviteId" TEXT,
    "ownerOid" INTEGER NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceGroup" (
    "id" TEXT NOT NULL,
    "type" "WorkspaceGroupType" NOT NULL,
    "status" "WorkspaceGroupStatus" NOT NULL DEFAULT 'active',
    "assignmentType" "WorkspaceAssignmentType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "accountId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "ownerOid" INTEGER NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspacePolicy" (
    "id" TEXT NOT NULL,
    "type" "WorkspacePolicyType" NOT NULL,
    "status" "WorkspacePolicyStatus" NOT NULL DEFAULT 'active',
    "assignmentType" "WorkspaceAssignmentType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "accountId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "ownerOid" INTEGER NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspacePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceGroupAssignment" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "workspaceGroupId" TEXT NOT NULL,
    "workspaceProfileId" TEXT NOT NULL,
    "ownerOid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceGroupAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspacePolicyAssignment" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "workspacePolicyId" TEXT NOT NULL,
    "workspaceGroupId" TEXT,
    "workspaceProfileId" TEXT,
    "ownerOid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspacePolicyAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Cell_identifier_key" ON "Cell"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "CellToken_id_key" ON "CellToken"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Hyperplane_identifier_key" ON "Hyperplane"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "HyperplaneToken_id_key" ON "HyperplaneToken"("id");

-- CreateIndex
CREATE INDEX "HyperplaneToken_hyperplaneOid_expiresAt_idx" ON "HyperplaneToken"("hyperplaneOid", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Horizon_identifier_key" ON "Horizon"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "HorizonToken_id_key" ON "HorizonToken"("id");

-- CreateIndex
CREATE INDEX "HorizonToken_horizonOid_expiresAt_idx" ON "HorizonToken"("horizonOid", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "CliSignupBlockRule_id_key" ON "CliSignupBlockRule"("id");

-- CreateIndex
CREATE UNIQUE INDEX "CliSignupBlockRule_type_value_key" ON "CliSignupBlockRule"("type", "value");

-- CreateIndex
CREATE UNIQUE INDEX "CliSignupAttempt_id_key" ON "CliSignupAttempt"("id");

-- CreateIndex
CREATE INDEX "CliSignupAttempt_ip_createdAt_idx" ON "CliSignupAttempt"("ip", "createdAt");

-- CreateIndex
CREATE INDEX "CliSignupAttempt_outcome_createdAt_idx" ON "CliSignupAttempt"("outcome", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AccountDomain_id_key" ON "AccountDomain"("id");

-- CreateIndex
CREATE UNIQUE INDEX "AccountDomain_domain_key" ON "AccountDomain"("domain");

-- CreateIndex
CREATE INDEX "AccountDomain_accountId_status_id_idx" ON "AccountDomain"("accountId", "status", "id");

-- CreateIndex
CREATE INDEX "AccountDomain_status_domain_idx" ON "AccountDomain"("status", "domain");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthJwk_kid_key" ON "OAuthJwk"("kid");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthApplication_id_key" ON "OAuthApplication"("id");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthApplication_clientId_key" ON "OAuthApplication"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthApplicationClientSecret_id_key" ON "OAuthApplicationClientSecret"("id");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthApplicationClientSecret_secret_key" ON "OAuthApplicationClientSecret"("secret");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthAuthorizationRequest_id_key" ON "OAuthAuthorizationRequest"("id");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthAuthorizationRequest_urlToken_key" ON "OAuthAuthorizationRequest"("urlToken");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthAuthorizationRequest_code_key" ON "OAuthAuthorizationRequest"("code");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthAuthorizationRequest_deviceCode_key" ON "OAuthAuthorizationRequest"("deviceCode");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthAuthorizationRequest_userCode_key" ON "OAuthAuthorizationRequest"("userCode");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthToken_id_key" ON "OAuthToken"("id");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthToken_accessToken_key" ON "OAuthToken"("accessToken");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthToken_refreshToken_key" ON "OAuthToken"("refreshToken");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Portal_slug_key" ON "Portal"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "GlobalProfile_id_key" ON "GlobalProfile"("id");

-- CreateIndex
CREATE UNIQUE INDEX "GlobalProfileEmail_id_key" ON "GlobalProfileEmail"("id");

-- CreateIndex
CREATE UNIQUE INDEX "GlobalProfileEmail_email_key" ON "GlobalProfileEmail"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PublicMcpServer_slug_key" ON "PublicMcpServer"("slug");

-- CreateIndex
CREATE INDEX "PublicMcpServer_ownerOid_idx" ON "PublicMcpServer"("ownerOid");

-- CreateIndex
CREATE INDEX "PublicMcpServer_organizationId_idx" ON "PublicMcpServer"("organizationId");

-- CreateIndex
CREATE INDEX "PublicMcpServer_updatedAt_idx" ON "PublicMcpServer"("updatedAt");

-- CreateIndex
CREATE INDEX "SkillPlugin_slug_idx" ON "SkillPlugin"("slug");

-- CreateIndex
CREATE INDEX "SkillPlugin_instanceId_status_idx" ON "SkillPlugin"("instanceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceInvite_consumerInviteId_key" ON "WorkspaceInvite"("consumerInviteId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceInvite_organizationInviteId_key" ON "WorkspaceInvite"("organizationInviteId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceInvite_enterpriseInviteId_key" ON "WorkspaceInvite"("enterpriseInviteId");

-- CreateIndex
CREATE INDEX "WorkspaceInvite_accountId_idx" ON "WorkspaceInvite"("accountId");

-- CreateIndex
CREATE INDEX "WorkspaceInvite_workspaceId_idx" ON "WorkspaceInvite"("workspaceId");

-- CreateIndex
CREATE INDEX "WorkspaceInvite_globalProfileId_idx" ON "WorkspaceInvite"("globalProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceInvite_workspaceId_globalProfileId_key" ON "WorkspaceInvite"("workspaceId", "globalProfileId");

-- CreateIndex
CREATE INDEX "WorkspaceGroup_accountId_idx" ON "WorkspaceGroup"("accountId");

-- CreateIndex
CREATE INDEX "WorkspaceGroup_workspaceId_idx" ON "WorkspaceGroup"("workspaceId");

-- CreateIndex
CREATE INDEX "WorkspacePolicy_accountId_idx" ON "WorkspacePolicy"("accountId");

-- CreateIndex
CREATE INDEX "WorkspacePolicy_workspaceId_idx" ON "WorkspacePolicy"("workspaceId");

-- CreateIndex
CREATE INDEX "WorkspaceGroupAssignment_accountId_idx" ON "WorkspaceGroupAssignment"("accountId");

-- CreateIndex
CREATE INDEX "WorkspaceGroupAssignment_workspaceId_idx" ON "WorkspaceGroupAssignment"("workspaceId");

-- CreateIndex
CREATE INDEX "WorkspaceGroupAssignment_workspaceGroupId_idx" ON "WorkspaceGroupAssignment"("workspaceGroupId");

-- CreateIndex
CREATE INDEX "WorkspaceGroupAssignment_workspaceProfileId_idx" ON "WorkspaceGroupAssignment"("workspaceProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceGroupAssignment_workspaceGroupId_workspaceProfileI_key" ON "WorkspaceGroupAssignment"("workspaceGroupId", "workspaceProfileId");

-- CreateIndex
CREATE INDEX "WorkspacePolicyAssignment_accountId_idx" ON "WorkspacePolicyAssignment"("accountId");

-- CreateIndex
CREATE INDEX "WorkspacePolicyAssignment_workspaceId_idx" ON "WorkspacePolicyAssignment"("workspaceId");

-- CreateIndex
CREATE INDEX "WorkspacePolicyAssignment_workspacePolicyId_idx" ON "WorkspacePolicyAssignment"("workspacePolicyId");

-- CreateIndex
CREATE INDEX "WorkspacePolicyAssignment_workspaceGroupId_idx" ON "WorkspacePolicyAssignment"("workspaceGroupId");

-- CreateIndex
CREATE INDEX "WorkspacePolicyAssignment_workspaceProfileId_idx" ON "WorkspacePolicyAssignment"("workspaceProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspacePolicyAssignment_workspacePolicyId_workspaceGroupI_key" ON "WorkspacePolicyAssignment"("workspacePolicyId", "workspaceGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspacePolicyAssignment_workspacePolicyId_workspaceProfil_key" ON "WorkspacePolicyAssignment"("workspacePolicyId", "workspaceProfileId");

-- AddForeignKey
ALTER TABLE "CellToken" ADD CONSTRAINT "CellToken_cellOid_fkey" FOREIGN KEY ("cellOid") REFERENCES "Cell"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hyperplane" ADD CONSTRAINT "Hyperplane_cellOid_fkey" FOREIGN KEY ("cellOid") REFERENCES "Cell"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HyperplaneToken" ADD CONSTRAINT "HyperplaneToken_hyperplaneOid_fkey" FOREIGN KEY ("hyperplaneOid") REFERENCES "Hyperplane"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HorizonToken" ADD CONSTRAINT "HorizonToken_horizonOid_fkey" FOREIGN KEY ("horizonOid") REFERENCES "Horizon"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CliSignupAttempt" ADD CONSTRAINT "CliSignupAttempt_blockRuleOid_fkey" FOREIGN KEY ("blockRuleOid") REFERENCES "CliSignupBlockRule"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CliSignupAttempt" ADD CONSTRAINT "CliSignupAttempt_cellOid_fkey" FOREIGN KEY ("cellOid") REFERENCES "Cell"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerSurface" ADD CONSTRAINT "ConsumerSurface_ownerOid_fkey" FOREIGN KEY ("ownerOid") REFERENCES "Cell"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerSurface" ADD CONSTRAINT "ConsumerSurface_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Instance" ADD CONSTRAINT "Instance_ownerOid_fkey" FOREIGN KEY ("ownerOid") REFERENCES "Cell"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthJwk" ADD CONSTRAINT "OAuthJwk_generatedByOid_fkey" FOREIGN KEY ("generatedByOid") REFERENCES "Cell"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GlobalLease" ADD CONSTRAINT "GlobalLease_holderOid_fkey" FOREIGN KEY ("holderOid") REFERENCES "Cell"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthApplication" ADD CONSTRAINT "OAuthApplication_ownerOid_fkey" FOREIGN KEY ("ownerOid") REFERENCES "Cell"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthApplication" ADD CONSTRAINT "OAuthApplication_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthApplicationClientSecret" ADD CONSTRAINT "OAuthApplicationClientSecret_oauthApplicationId_fkey" FOREIGN KEY ("oauthApplicationId") REFERENCES "OAuthApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthAuthorizationRequest" ADD CONSTRAINT "OAuthAuthorizationRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthAuthorizationRequest" ADD CONSTRAINT "OAuthAuthorizationRequest_oauthApplicationId_fkey" FOREIGN KEY ("oauthApplicationId") REFERENCES "OAuthApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthAuthorizationRequest" ADD CONSTRAINT "OAuthAuthorizationRequest_claimedByOid_fkey" FOREIGN KEY ("claimedByOid") REFERENCES "Cell"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthAuthorizationRequest" ADD CONSTRAINT "OAuthAuthorizationRequest_createdByOid_fkey" FOREIGN KEY ("createdByOid") REFERENCES "Cell"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthToken" ADD CONSTRAINT "OAuthToken_oauthApplicationId_fkey" FOREIGN KEY ("oauthApplicationId") REFERENCES "OAuthApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthToken" ADD CONSTRAINT "OAuthToken_ownerOid_fkey" FOREIGN KEY ("ownerOid") REFERENCES "Cell"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_ownerOid_fkey" FOREIGN KEY ("ownerOid") REFERENCES "Cell"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Portal" ADD CONSTRAINT "Portal_ownerOid_fkey" FOREIGN KEY ("ownerOid") REFERENCES "Cell"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Portal" ADD CONSTRAINT "Portal_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GlobalProfileEmail" ADD CONSTRAINT "GlobalProfileEmail_globalProfileOid_fkey" FOREIGN KEY ("globalProfileOid") REFERENCES "GlobalProfile"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicMcpServer" ADD CONSTRAINT "PublicMcpServer_ownerOid_fkey" FOREIGN KEY ("ownerOid") REFERENCES "Cell"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillPlugin" ADD CONSTRAINT "SkillPlugin_ownerOid_fkey" FOREIGN KEY ("ownerOid") REFERENCES "Cell"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillPlugin" ADD CONSTRAINT "SkillPlugin_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_lastEditByOid_fkey" FOREIGN KEY ("lastEditByOid") REFERENCES "Cell"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_ownerOid_fkey" FOREIGN KEY ("ownerOid") REFERENCES "Cell"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceProfile" ADD CONSTRAINT "WorkspaceProfile_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceProfile" ADD CONSTRAINT "WorkspaceProfile_globalProfileId_fkey" FOREIGN KEY ("globalProfileId") REFERENCES "GlobalProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceProfile" ADD CONSTRAINT "WorkspaceProfile_ownerOid_fkey" FOREIGN KEY ("ownerOid") REFERENCES "Cell"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceInvite" ADD CONSTRAINT "WorkspaceInvite_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceInvite" ADD CONSTRAINT "WorkspaceInvite_globalProfileId_fkey" FOREIGN KEY ("globalProfileId") REFERENCES "GlobalProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceInvite" ADD CONSTRAINT "WorkspaceInvite_ownerOid_fkey" FOREIGN KEY ("ownerOid") REFERENCES "Cell"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceGroup" ADD CONSTRAINT "WorkspaceGroup_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceGroup" ADD CONSTRAINT "WorkspaceGroup_ownerOid_fkey" FOREIGN KEY ("ownerOid") REFERENCES "Cell"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspacePolicy" ADD CONSTRAINT "WorkspacePolicy_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspacePolicy" ADD CONSTRAINT "WorkspacePolicy_ownerOid_fkey" FOREIGN KEY ("ownerOid") REFERENCES "Cell"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceGroupAssignment" ADD CONSTRAINT "WorkspaceGroupAssignment_workspaceGroupId_fkey" FOREIGN KEY ("workspaceGroupId") REFERENCES "WorkspaceGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceGroupAssignment" ADD CONSTRAINT "WorkspaceGroupAssignment_workspaceProfileId_fkey" FOREIGN KEY ("workspaceProfileId") REFERENCES "WorkspaceProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceGroupAssignment" ADD CONSTRAINT "WorkspaceGroupAssignment_ownerOid_fkey" FOREIGN KEY ("ownerOid") REFERENCES "Cell"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspacePolicyAssignment" ADD CONSTRAINT "WorkspacePolicyAssignment_workspacePolicyId_fkey" FOREIGN KEY ("workspacePolicyId") REFERENCES "WorkspacePolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspacePolicyAssignment" ADD CONSTRAINT "WorkspacePolicyAssignment_workspaceGroupId_fkey" FOREIGN KEY ("workspaceGroupId") REFERENCES "WorkspaceGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspacePolicyAssignment" ADD CONSTRAINT "WorkspacePolicyAssignment_workspaceProfileId_fkey" FOREIGN KEY ("workspaceProfileId") REFERENCES "WorkspaceProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspacePolicyAssignment" ADD CONSTRAINT "WorkspacePolicyAssignment_ownerOid_fkey" FOREIGN KEY ("ownerOid") REFERENCES "Cell"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

