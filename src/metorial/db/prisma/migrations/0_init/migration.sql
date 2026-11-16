-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "FineGrainedKeyStatus" AS ENUM ('active', 'deleted', 'expired');

-- CreateEnum
CREATE TYPE "AccountDomainStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "AccountDomainVerificationStatus" AS ENUM ('unverified', 'verified_basic', 'verified_full');

-- CreateEnum
CREATE TYPE "AccountDomainVerificationType" AS ENUM ('dns', 'email');

-- CreateEnum
CREATE TYPE "AccountDomainVerificationInnerStatus" AS ENUM ('unverified', 'verified');

-- CreateEnum
CREATE TYPE "NamespaceCompartmentType" AS ENUM ('managed');

-- CreateEnum
CREATE TYPE "NamespacePurpose" AS ENUM ('metorial_platform', 'metorial_portal', 'metorial_portal_single', 'metorial_public_mcp');

-- CreateEnum
CREATE TYPE "NamespacePropertyType" AS ENUM ('portal', 'organization');

-- CreateEnum
CREATE TYPE "WorkspaceType" AS ENUM ('organization', 'portal', 'enterprise');

-- CreateEnum
CREATE TYPE "WorkspaceStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "WorkspaceProfileStatus" AS ENUM ('active', 'deleted');

-- CreateEnum
CREATE TYPE "WorkspaceInviteStatus" AS ENUM ('pending', 'accepted', 'rejected', 'deleted');

-- CreateEnum
CREATE TYPE "WorkspaceGroupType" AS ENUM ('consumer_group', 'organization_team');

-- CreateEnum
CREATE TYPE "WorkspaceGroupStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "WorkspaceGroupAssignmentType" AS ENUM ('everyone', 'admin', 'custom');

-- CreateEnum
CREATE TYPE "WorkspacePolicyType" AS ENUM ('organization_policy', 'enterprise_role');

-- CreateEnum
CREATE TYPE "WorkspacePolicyStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "WorkspacePolicyAssignmentType" AS ENUM ('everyone', 'admin', 'custom');

-- CreateEnum
CREATE TYPE "AuditLogStreamStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "AuditLogStreamProvider" AS ENUM ('datadog', 'splunk');

-- CreateEnum
CREATE TYPE "AuditLogStreamAccessStatus" AS ENUM ('ok', 'error');

-- CreateEnum
CREATE TYPE "AuditLogStreamEventType" AS ENUM ('created', 'started', 'error', 'error_paused', 'recovered', 'disabled', 'enabled');

-- CreateEnum
CREATE TYPE "AuditLogStreamRunStatus" AS ENUM ('running', 'success', 'error');

-- CreateEnum
CREATE TYPE "MetorialConfigSessionRunner" AS ENUM ('legacy', 'engine');

-- CreateEnum
CREATE TYPE "MetorialConfigId" AS ENUM ('metorial');

-- CreateEnum
CREATE TYPE "ConsumerAccessTargetType" AS ENUM ('provider_template', 'magic_mcp_server', 'skill', 'skill_template', 'skill_group', 'skill_marketplace', 'skill_plugin');

-- CreateEnum
CREATE TYPE "ConsumerAccessLevel" AS ENUM ('read', 'manage');

-- CreateEnum
CREATE TYPE "ConsumerAccessRequestTargetType" AS ENUM ('provider_template', 'magic_mcp_server');

-- CreateEnum
CREATE TYPE "ConsumerAccessRequestStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "ConsumerProviderSetupSessionType" AS ENUM ('provider_setup_session', 'integration_setup_session');

-- CreateEnum
CREATE TYPE "ConsumerProfileInviteStatus" AS ENUM ('unset', 'invited', 'accepted');

-- CreateEnum
CREATE TYPE "ConsumerProfileStatus" AS ENUM ('active', 'deleted');

-- CreateEnum
CREATE TYPE "ConsumerInviteStatus" AS ENUM ('pending', 'accepted');

-- CreateEnum
CREATE TYPE "ConsumerProfileGroupAssignedVia" AS ENUM ('manual', 'sso');

-- CreateEnum
CREATE TYPE "ConsumerAuthClientTokenEndpointAuthMethod" AS ENUM ('client_secret_basic', 'client_secret_post', 'none');

-- CreateEnum
CREATE TYPE "ConsumerAuthAttemptStatus" AS ENUM ('pending', 'authorized', 'active', 'denied', 'revoked');

-- CreateEnum
CREATE TYPE "ConsumerAuthAttemptCodeChallengeMethod" AS ENUM ('none', 's256');

-- CreateEnum
CREATE TYPE "ConsumerGroupStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "ConsumerGroupType" AS ENUM ('default', 'user_access');

-- CreateEnum
CREATE TYPE "PortalStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "ProviderTemplateStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "ConsumerSkillPermission" AS ENUM ('read', 'write');

-- CreateEnum
CREATE TYPE "ConsumerSkillSource" AS ENUM ('access', 'owner');

-- CreateEnum
CREATE TYPE "ConsumerSurfaceStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "ConsumerSurfaceType" AS ENUM ('portal', 'organization_members', 'cli');

-- CreateEnum
CREATE TYPE "OutgoingEmailDestinationStatus" AS ENUM ('pending', 'sent', 'retry', 'failed');

-- CreateEnum
CREATE TYPE "OutgoingEmailSendStatus" AS ENUM ('success', 'failed');

-- CreateEnum
CREATE TYPE "EmailIdentityType" AS ENUM ('email');

-- CreateEnum
CREATE TYPE "DocumentParticipantRole" AS ENUM ('editor', 'viewer');

-- CreateEnum
CREATE TYPE "FilePurposeOwnerType" AS ENUM ('user', 'organization', 'instance');

-- CreateEnum
CREATE TYPE "FileStatus" AS ENUM ('active', 'deleted');

-- CreateEnum
CREATE TYPE "StoreStatus" AS ENUM ('active', 'archived');

-- CreateEnum
CREATE TYPE "StoreAccess" AS ENUM ('private', 'public_read', 'public_write');

-- CreateEnum
CREATE TYPE "StoreCloneType" AS ENUM ('sync_until_change', 'duplicate');

-- CreateEnum
CREATE TYPE "StoreTemplateItemEncoding" AS ENUM ('utf-8', 'base64');

-- CreateEnum
CREATE TYPE "StoreTemplateType" AS ENUM ('linked_store', 'standalone');

-- CreateEnum
CREATE TYPE "StoreItemKind" AS ENUM ('file', 'document', 'directory');

-- CreateEnum
CREATE TYPE "StorePathMode" AS ENUM ('legacy', 'unicode');

-- CreateEnum
CREATE TYPE "StoreParticipantPermissions" AS ENUM ('content_read', 'content_write');

-- CreateEnum
CREATE TYPE "StoreParticipantRole" AS ENUM ('creator', 'editor', 'viewer', 'user', 'forker');

-- CreateEnum
CREATE TYPE "FileUploadStatus" AS ENUM ('pending', 'completed', 'canceled', 'expired');

-- CreateEnum
CREATE TYPE "IdentityActorType" AS ENUM ('organization_member', 'person', 'agent', 'consumer');

-- CreateEnum
CREATE TYPE "IdentityActorStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "AgentType" AS ENUM ('mcp_client', 'custom', 'tool_call');

-- CreateEnum
CREATE TYPE "AgentClientType" AS ENUM ('mcp_client_oauth', 'system_client');

-- CreateEnum
CREATE TYPE "AgentInstanceType" AS ENUM ('mcp_client', 'tool_call');

-- CreateEnum
CREATE TYPE "IntegrationResourceSource" AS ENUM ('explorer');

-- CreateEnum
CREATE TYPE "ApiKeyType" AS ENUM ('organization_management_token', 'instance_access_token_secret', 'instance_access_token_publishable');

-- CreateEnum
CREATE TYPE "ApiKeyStatus" AS ENUM ('active', 'deleted', 'expired');

-- CreateEnum
CREATE TYPE "ApiKeyKind" AS ENUM ('user_created', 'system_internal');

-- CreateEnum
CREATE TYPE "MachineAccessType" AS ENUM ('organization_management', 'instance_secret', 'instance_publishable', 'instance_consumer');

-- CreateEnum
CREATE TYPE "MachineAccessStatus" AS ENUM ('active', 'deleted');

-- CreateEnum
CREATE TYPE "MachineAccessKind" AS ENUM ('api_key', 'user');

-- CreateEnum
CREATE TYPE "OAuthApplicationStatus" AS ENUM ('active', 'archived');

-- CreateEnum
CREATE TYPE "OAuthApplicationType" AS ENUM ('user_facing', 'cli_auth', 'server_side', 'internal');

-- CreateEnum
CREATE TYPE "OAuthAuthorizationAccessLevel" AS ENUM ('organization', 'global');

-- CreateEnum
CREATE TYPE "OAuthApplicationSubjectType" AS ENUM ('organization_member', 'consumer', 'consumer_or_organization_member');

-- CreateEnum
CREATE TYPE "InternalOAuthTokenSubjectType" AS ENUM ('member', 'machine');

-- CreateEnum
CREATE TYPE "InternalOAuthTokenScopeType" AS ENUM ('organization', 'instance');

-- CreateEnum
CREATE TYPE "OAuthInstallationStatus" AS ENUM ('active', 'revoked');

-- CreateEnum
CREATE TYPE "OAuthAuthorizationStatus" AS ENUM ('active', 'revoked');

-- CreateEnum
CREATE TYPE "OAuthAuthorizationType" AS ENUM ('user', 'server_side');

-- CreateEnum
CREATE TYPE "OAuthSubjectType" AS ENUM ('organization_member', 'consumer');

-- CreateEnum
CREATE TYPE "OAuthAuthorizationFlowChallengeMethod" AS ENUM ('none', 's256');

-- CreateEnum
CREATE TYPE "OAuthAuthorizationFlowStatus" AS ENUM ('pending', 'accepted', 'consumed');

-- CreateEnum
CREATE TYPE "OAuthAuthorizationFlowType" AS ENUM ('interactive', 'device_code');

-- CreateEnum
CREATE TYPE "ServiceAccountStatus" AS ENUM ('active', 'archived');

-- CreateEnum
CREATE TYPE "MagicMcpEndpointStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "MagicMcpEndpointSkillSelectionType" AS ENUM ('all', 'selected');

-- CreateEnum
CREATE TYPE "MagicMcpGroupStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "MagicMcpServerStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "MagicMcpServerSource" AS ENUM ('explorer', 'manual', 'consumer_provider_template');

-- CreateEnum
CREATE TYPE "MagicMcpServerOwnerType" AS ENUM ('server_owned', 'provider_template', 'integration');

-- CreateEnum
CREATE TYPE "MagicMcpTokenStatus" AS ENUM ('active', 'deleted');

-- CreateEnum
CREATE TYPE "FirewallStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "NetworkPolicyStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "AccessPolicyType" AS ENUM ('everyone', 'admin', 'custom');

-- CreateEnum
CREATE TYPE "AccessPolicyAssignmentTarget" AS ENUM ('team', 'organization_member', 'service_account');

-- CreateEnum
CREATE TYPE "OrganizationActorType" AS ENUM ('member', 'machine_access', 'system', 'oauth_application', 'agent', 'consumer_profile');

-- CreateEnum
CREATE TYPE "OrganizationConfigOwnership" AS ENUM ('user', 'organization', 'user_organization');

-- CreateEnum
CREATE TYPE "EnvironmentType" AS ENUM ('development', 'production');

-- CreateEnum
CREATE TYPE "EnvironmentStatus" AS ENUM ('active', 'deleted');

-- CreateEnum
CREATE TYPE "SandboxStatus" AS ENUM ('active', 'deleted');

-- CreateEnum
CREATE TYPE "InstanceType" AS ENUM ('development', 'production');

-- CreateEnum
CREATE TYPE "InstanceStatus" AS ENUM ('active', 'deleted');

-- CreateEnum
CREATE TYPE "OrganizationLayoutOwnership" AS ENUM ('user', 'organization', 'user_organization');

-- CreateEnum
CREATE TYPE "OrganizationMemberRole" AS ENUM ('admin', 'member');

-- CreateEnum
CREATE TYPE "OrganizationMemberStatus" AS ENUM ('active', 'deleted');

-- CreateEnum
CREATE TYPE "OrganizationInviteType" AS ENUM ('email', 'link');

-- CreateEnum
CREATE TYPE "OrganizationInviteStatus" AS ENUM ('pending', 'accepted', 'rejected', 'deleted');

-- CreateEnum
CREATE TYPE "OrganizationInviteAction" AS ENUM ('invite', 'onboarding');

-- CreateEnum
CREATE TYPE "OrganizationNotificationSeverity" AS ENUM ('alert', 'notification');

-- CreateEnum
CREATE TYPE "OrganizationNotificationStatus" AS ENUM ('active', 'read', 'archived');

-- CreateEnum
CREATE TYPE "OrganizationNotificationDestinationStatus" AS ENUM ('active', 'read', 'archived');

-- CreateEnum
CREATE TYPE "OrganizationNotificationEmailStatus" AS ENUM ('disabled', 'pending', 'batched', 'sent');

-- CreateEnum
CREATE TYPE "OrganizationNotificationEmailDigestStatus" AS ENUM ('pending', 'sent', 'skipped');

-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('default', 'user');

-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('active', 'deleted');

-- CreateEnum
CREATE TYPE "OrganizationAuthVersion" AS ENUM ('v1', 'v2');

-- CreateEnum
CREATE TYPE "ProfileType" AS ENUM ('system', 'user', 'organization', 'external');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('active', 'deleted');

-- CreateEnum
CREATE TYPE "ProjectDataRetentionLevel" AS ENUM ('full', 'intent_only', 'none');

-- CreateEnum
CREATE TYPE "OutpostInstanceStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "OutpostTokenKeyPairStatus" AS ENUM ('active', 'replaced', 'expired', 'revoked');

-- CreateEnum
CREATE TYPE "OutpostStatus" AS ENUM ('active', 'disabled', 'deleted');

-- CreateEnum
CREATE TYPE "OutpostConnectionStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "OutpostCredentialStatus" AS ENUM ('active', 'disabled', 'deleted', 'expired');

-- CreateEnum
CREATE TYPE "OutpostService" AS ENUM ('mcp_connection_proxy', 'outpost_registration_proxy');

-- CreateEnum
CREATE TYPE "ProductAssistantOwner" AS ENUM ('metorial', 'tenant');

-- CreateEnum
CREATE TYPE "ProductAssistantRequestStatus" AS ENUM ('pending', 'waiting_for_user', 'completed', 'cancelled', 'failed');

-- CreateEnum
CREATE TYPE "ProductAssistantMessageType" AS ENUM ('root', 'user', 'assistant');

-- CreateEnum
CREATE TYPE "ProductAssistantMessageStatus" AS ENUM ('pending', 'waiting_for_user', 'completed');

-- CreateEnum
CREATE TYPE "ProductAssistantRunStatus" AS ENUM ('pending', 'running', 'waiting_for_user', 'completed', 'cancelled', 'failed');

-- CreateEnum
CREATE TYPE "AccessLimiterTarget" AS ENUM ('server_deployment');

-- CreateEnum
CREATE TYPE "SandboxDiskType" AS ENUM ('standard', 'root_fs');

-- CreateEnum
CREATE TYPE "SandboxEgressPolicyStatus" AS ENUM ('pending', 'active', 'invalid');

-- CreateEnum
CREATE TYPE "SandboxEgressPolicyRegionStatus" AS ENUM ('pending', 'synced', 'failed', 'deleting');

-- CreateEnum
CREATE TYPE "SandboxMachineImageBuildStatus" AS ENUM ('preparing', 'queued', 'building', 'processing', 'replicating', 'succeeded', 'failed', 'cancelled', 'timed_out');

-- CreateEnum
CREATE TYPE "SandboxMachineImageBuildRegionKind" AS ENUM ('builder', 'replica');

-- CreateEnum
CREATE TYPE "SandboxMachineImageBuildRegionStatus" AS ENUM ('pending', 'preparing', 'queued', 'building', 'copying', 'awaiting_source', 'processing', 'succeeded', 'failed', 'cancelled', 'timed_out');

-- CreateEnum
CREATE TYPE "SandboxMachineImageStatus" AS ENUM ('pending', 'active', 'deleted');

-- CreateEnum
CREATE TYPE "SandboxResourceStatus" AS ENUM ('active', 'deleted');

-- CreateEnum
CREATE TYPE "SecretStatus" AS ENUM ('active', 'deleted');

-- CreateEnum
CREATE TYPE "SecretEventType" AS ENUM ('secret_created', 'secret_read', 'secret_deleted');

-- CreateEnum
CREATE TYPE "CargoSyncRunStatus" AS ENUM ('pending', 'processing', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "SkillAgentStatus" AS ENUM ('active', 'archived');

-- CreateEnum
CREATE TYPE "SkillExportTarget" AS ENUM ('skill', 'plugin', 'marketplace');

-- CreateEnum
CREATE TYPE "SkillExportStatus" AS ENUM ('pending', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "SkillGroupStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "SkillGroupItemStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "SkillImportSourceType" AS ENUM ('public_repository', 'origin_repository', 'uploaded_file');

-- CreateEnum
CREATE TYPE "SkillImportFileFormat" AS ENUM ('zip', 'markdown');

-- CreateEnum
CREATE TYPE "SkillImportStatus" AS ENUM ('pending', 'processing', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "SkillImportItemStatus" AS ENUM ('pending', 'processing', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "SkillMarketplaceStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "SkillMarketplaceRepositoryAccessMode" AS ENUM ('pull_request', 'default_branch');

-- CreateEnum
CREATE TYPE "SkillMergeRequestStatus" AS ENUM ('open', 'closed', 'merging', 'merged');

-- CreateEnum
CREATE TYPE "SkillMergeRequestDirection" AS ENUM ('fork_to_upstream', 'upstream_to_fork');

-- CreateEnum
CREATE TYPE "SkillMergeRequestErrorCode" AS ENUM ('target_changed', 'unresolved_after_refresh', 'apply_failed', 'verification_failed', 'enqueue_failed', 'stale_merge_recovered');

-- CreateEnum
CREATE TYPE "SkillMergeRequestEventType" AS ENUM ('created', 'commented', 'all_conflicts_resolved', 'merge_started', 'merge_completed', 'merge_failed', 'closed', 'rolled_back');

-- CreateEnum
CREATE TYPE "SkillMergeRequestItemStatus" AS ENUM ('unresolved', 'resolved', 'skipped', 'applied');

-- CreateEnum
CREATE TYPE "SkillMergeRequestChangeType" AS ENUM ('added', 'modified', 'removed', 'unchanged', 'conflicted');

-- CreateEnum
CREATE TYPE "SkillMergeRequestResolutionType" AS ENUM ('accept_source', 'keep_target', 'remove', 'edit_document', 'replace_file', 'skip');

-- CreateEnum
CREATE TYPE "SkillMergeRequestBaseStrategy" AS ENUM ('exact', 'inferred_created_at', 'inferred_current');

-- CreateEnum
CREATE TYPE "SkillForkSyncStatus" AS ENUM ('pending', 'processing', 'action_required', 'completed', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "SkillPluginStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "SkillMarketplacePluginStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "SkillPluginSkillStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "SkillStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "SkillOwnerType" AS ENUM ('instance', 'consumer');

-- CreateEnum
CREATE TYPE "SkillDestinationStorageMode" AS ENUM ('code_bucket', 'manifest');

-- CreateEnum
CREATE TYPE "SkillDestinationFileSourceKind" AS ENUM ('file', 'blob');

-- CreateEnum
CREATE TYPE "SkillDestinationSyncStatus" AS ENUM ('pending', 'completed', 'failed', 'processing', 'waiting_for_review', 'canceled');

-- CreateEnum
CREATE TYPE "SkillDestinationSyncRepositoryPropagationStatus" AS ENUM ('pending', 'processing', 'waiting_for_review', 'completed', 'failed', 'canceled');

-- CreateEnum
CREATE TYPE "SkillDestinationSyncTrigger" AS ENUM ('automatic', 'manual', 'repair', 'drift_check', 'recovery', 'migration');

-- CreateEnum
CREATE TYPE "SkillParticipantRole" AS ENUM ('creator', 'editor', 'viewer', 'user', 'forker');

-- CreateEnum
CREATE TYPE "SkillTemplateStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "SkillTemplateOwner" AS ENUM ('system', 'tenant');

-- CreateEnum
CREATE TYPE "ResourceGroupType" AS ENUM ('development', 'production');

-- CreateEnum
CREATE TYPE "ResourceActorType" AS ENUM ('external', 'system');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'deleted');

-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('user', 'system');

-- CreateEnum
CREATE TYPE "WebDiscoveryStatus" AS ENUM ('pending', 'running', 'succeeded', 'failed');

-- CreateEnum
CREATE TYPE "EventDeliveryRetryStrategy" AS ENUM ('exponential', 'linear', 'fixed');

-- CreateEnum
CREATE TYPE "EventDeliveryIntentStatus" AS ENUM ('pending', 'retrying', 'delivered', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "EventDeliveryAttemptStatus" AS ENUM ('succeeded', 'failed');

-- CreateEnum
CREATE TYPE "EventDestinationType" AS ENUM ('webhook');

-- CreateEnum
CREATE TYPE "EventDestinationStatus" AS ENUM ('active', 'archived');

-- CreateEnum
CREATE TYPE "EventDestinationListenerType" AS ENUM ('event', 'callback', 'chat');

-- CreateEnum
CREATE TYPE "SystemEventSource" AS ENUM ('resource', 'callback', 'chat', 'ping');

-- CreateEnum
CREATE TYPE "WebhookMethod" AS ENUM ('POST');

-- CreateTable
CREATE TABLE "AccessTag" (
    "oid" BIGSERIAL NOT NULL,
    "instanceOid" BIGINT NOT NULL,

    CONSTRAINT "AccessTag_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "AccessTagPolicy" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "roles" TEXT[],
    "systemIdentifier" TEXT,
    "organizationOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessTagPolicy_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "AccessTagEntity" (
    "oid" BIGSERIAL NOT NULL,
    "subspaceSessionId" TEXT,
    "accessTagOid" BIGINT NOT NULL,
    "accessTagPolicyOid" BIGINT NOT NULL,
    "magicMcpTokenOid" BIGINT,
    "magicMcpServerOid" BIGINT,
    "magicMcpEndpointOid" BIGINT,
    "providerTemplateOid" BIGINT,
    "skillOid" BIGINT,
    "skillTemplateOid" BIGINT,
    "skillGroupOid" BIGINT,
    "skillMarketplaceOid" BIGINT,
    "skillPluginOid" BIGINT,
    "storeOid" BIGINT,

    CONSTRAINT "AccessTagEntity_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "FineGrainedKey" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "FineGrainedKeyStatus" NOT NULL,
    "secret" TEXT NOT NULL,
    "secretRedacted" TEXT NOT NULL,
    "secretLength" INTEGER NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "accessTagOid" BIGINT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FineGrainedKey_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SessionClientSecretReference" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "fineGrainedKeyOid" BIGINT NOT NULL,

    CONSTRAINT "SessionClientSecretReference_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Account" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "ownerOrganizationOid" BIGINT,
    "rootOwnerAccountOid" BIGINT,
    "ownerAccountOid" BIGINT,
    "cellOid" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "AccountDomain" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "status" "AccountDomainStatus" NOT NULL,
    "verificationStatus" "AccountDomainVerificationStatus" NOT NULL,
    "accountOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountDomain_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "AccountDomainVerification" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "type" "AccountDomainVerificationType" NOT NULL,
    "status" "AccountDomainVerificationInnerStatus" NOT NULL,
    "verificationCode" TEXT NOT NULL,
    "accountDomainOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastCheckedAt" TIMESTAMP(3),

    CONSTRAINT "AccountDomainVerification_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "AccountDomainVerificationStatusChange" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "accountDomainVerificationOid" BIGINT NOT NULL,
    "accountDomainOid" BIGINT NOT NULL,
    "oldStatus" "AccountDomainVerificationInnerStatus" NOT NULL,
    "newStatus" "AccountDomainVerificationInnerStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountDomainVerificationStatusChange_pkey" PRIMARY KEY ("oid")
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
CREATE TABLE "NamespaceCompartment" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "type" "NamespaceCompartmentType" NOT NULL DEFAULT 'managed',
    "priority" INTEGER NOT NULL,
    "systemIdentifier" TEXT,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NamespaceCompartment_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Namespace" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "purposes" "NamespacePurpose"[],
    "compartmentOid" BIGINT NOT NULL,
    "accountOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Namespace_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "NamespaceProperty" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "type" "NamespacePropertyType" NOT NULL,
    "namespaceOid" BIGINT NOT NULL,
    "workspaceOid" BIGINT,
    "accountOid" BIGINT NOT NULL,
    "organizationOid" BIGINT,
    "portalOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NamespaceProperty_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Workspace" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "type" "WorkspaceType" NOT NULL,
    "status" "WorkspaceStatus" NOT NULL DEFAULT 'active',
    "name" TEXT NOT NULL,
    "accountOid" BIGINT NOT NULL,
    "organizationOid" BIGINT,
    "portalOid" BIGINT,
    "enterpriseId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "WorkspaceProfile" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "WorkspaceProfileStatus" NOT NULL DEFAULT 'active',
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "accountOid" BIGINT NOT NULL,
    "workspaceOid" BIGINT NOT NULL,
    "globalProfileOid" BIGINT NOT NULL,
    "userOid" BIGINT,
    "organizationMemberOid" BIGINT,
    "enterpriseMemberId" TEXT,
    "consumerOid" BIGINT,
    "instanceConsumerOid" BIGINT,
    "consumerProfileOid" BIGINT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceProfile_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "WorkspaceInvite" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "WorkspaceInviteStatus" NOT NULL DEFAULT 'pending',
    "email" TEXT NOT NULL,
    "accountOid" BIGINT NOT NULL,
    "workspaceOid" BIGINT NOT NULL,
    "globalProfileOid" BIGINT NOT NULL,
    "consumerInviteOid" BIGINT,
    "organizationInviteOid" BIGINT,
    "enterpriseInviteId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceInvite_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "WorkspaceGroup" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "type" "WorkspaceGroupType" NOT NULL,
    "status" "WorkspaceGroupStatus" NOT NULL,
    "assignmentType" "WorkspaceGroupAssignmentType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "workspaceOid" BIGINT NOT NULL,
    "accountOid" BIGINT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceGroup_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "WorkspacePolicy" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "type" "WorkspacePolicyType" NOT NULL,
    "status" "WorkspacePolicyStatus" NOT NULL,
    "assignmentType" "WorkspacePolicyAssignmentType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "workspaceOid" BIGINT NOT NULL,
    "accountOid" BIGINT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspacePolicy_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "WorkspacePolicyAssignment" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "workspacePolicyOid" BIGINT NOT NULL,
    "workspaceGroupOid" BIGINT,
    "workspaceProfileOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspacePolicyAssignment_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "WorkspaceGroupAssignment" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "workspaceGroupOid" BIGINT NOT NULL,
    "workspaceProfileOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceGroupAssignment_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "ua" TEXT,
    "ip" TEXT,
    "organizationOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "organizationActorOid" BIGINT,
    "actorType" TEXT,
    "actorId" TEXT,
    "actorMetadata" JSONB,
    "eventOid" BIGINT,
    "payload" JSONB,
    "previousAttributes" JSONB,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "AuditLogDirtyTracker" (
    "organizationOid" BIGINT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLogDirtyTracker_pkey" PRIMARY KEY ("organizationOid")
);

-- CreateTable
CREATE TABLE "Event" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "ua" TEXT,
    "ip" TEXT,
    "organizationOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "organizationActorOid" BIGINT,
    "actorType" TEXT,
    "actorId" TEXT,
    "actorMetadata" JSONB,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "AuditLogStream" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "provider" "AuditLogStreamProvider" NOT NULL,
    "status" "AuditLogStreamStatus" NOT NULL,
    "accessStatus" "AuditLogStreamAccessStatus" NOT NULL,
    "isPausedDueToError" BOOLEAN NOT NULL DEFAULT false,
    "errorMessage" TEXT,
    "consecutiveErrorCount" INTEGER NOT NULL DEFAULT 0,
    "isStarted" BOOLEAN NOT NULL DEFAULT false,
    "organizationOid" BIGINT NOT NULL,
    "providerDataRedacted" JSONB NOT NULL,
    "encryptedProviderData" TEXT NOT NULL,
    "lastEventId" TEXT,
    "lastAuditLogOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLogStream_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "AuditLogStreamEvent" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "type" "AuditLogStreamEventType" NOT NULL,
    "message" TEXT,
    "errorDetails" JSONB,
    "auditLogStreamOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLogStreamEvent_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "AuditLogStreamRun" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "AuditLogStreamRunStatus" NOT NULL,
    "batchIdentifier" TEXT NOT NULL,
    "batchNumber" INTEGER NOT NULL,
    "successfulBatchCount" INTEGER NOT NULL,
    "recordsSynced" INTEGER NOT NULL,
    "errorMessage" TEXT,
    "auditLogStreamOid" BIGINT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLogStreamRun_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Cell" (
    "oid" SERIAL NOT NULL,
    "identifier" TEXT NOT NULL,
    "isCurrentDeployment" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cell_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "CellConsumerSurface" (
    "id" TEXT NOT NULL,
    "status" "ConsumerSurfaceStatus" NOT NULL,
    "type" "ConsumerSurfaceType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isOwnedByDeployment" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CellConsumerSurface_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CellInstance" (
    "id" TEXT NOT NULL,
    "type" "InstanceType" NOT NULL,
    "status" "InstanceStatus" NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isOwnedByDeployment" BOOLEAN NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CellInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CellOrganization" (
    "id" TEXT NOT NULL,
    "type" "OrganizationType" NOT NULL,
    "status" "OrganizationStatus" NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isOwnedByDeployment" BOOLEAN NOT NULL,
    "image" JSONB NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CellOrganization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CellPortal" (
    "id" TEXT NOT NULL,
    "status" "PortalStatus" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "slug" TEXT NOT NULL,
    "isOwnedByDeployment" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CellPortal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CellSkillPlugin" (
    "id" TEXT NOT NULL,
    "status" "SkillPluginStatus" NOT NULL,
    "name" TEXT,
    "slug" TEXT,
    "isOwnedByDeployment" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CellSkillPlugin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetorialConfig" (
    "id" "MetorialConfigId" NOT NULL DEFAULT 'metorial',
    "sessionRunner" "MetorialConfigSessionRunner" NOT NULL DEFAULT 'engine',
    "instanceIdentifier" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetorialConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsumerAccess" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "type" "ConsumerAccessTargetType" NOT NULL,
    "accessLevel" "ConsumerAccessLevel",
    "surfaceOid" BIGINT NOT NULL,
    "consumerGroupOid" BIGINT NOT NULL,
    "providerTemplateOid" BIGINT,
    "magicMcpServerOid" BIGINT,
    "skillOid" BIGINT,
    "skillTemplateOid" BIGINT,
    "skillGroupOid" BIGINT,
    "skillMarketplaceOid" BIGINT,
    "skillPluginOid" BIGINT,
    "listingOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsumerAccess_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ConsumerAccessListing" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "readme" TEXT,
    "surfaceOid" BIGINT NOT NULL,
    "providerTemplateOid" BIGINT,
    "magicMcpServerOid" BIGINT,
    "skillOid" BIGINT,
    "skillTemplateOid" BIGINT,
    "skillGroupOid" BIGINT,
    "skillMarketplaceOid" BIGINT,
    "skillPluginOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsumerAccessListing_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ConsumerAccessRequest" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "type" "ConsumerAccessRequestTargetType" NOT NULL,
    "status" "ConsumerAccessRequestStatus" NOT NULL,
    "message" TEXT,
    "resolutionMessage" TEXT,
    "metadata" JSONB NOT NULL,
    "pendingKey" TEXT,
    "surfaceOid" BIGINT NOT NULL,
    "consumerProfileOid" BIGINT NOT NULL,
    "providerTemplateOid" BIGINT,
    "magicMcpServerOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "ConsumerAccessRequest_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ConsumerActor" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "defaultIdentityId" TEXT,
    "organizationOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "consumerOid" BIGINT NOT NULL,
    "instanceConsumerOid" BIGINT NOT NULL,
    "consumerProfileOid" BIGINT NOT NULL,
    "identityActorOid" BIGINT,
    "defaultForInstanceConsumerOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsumerActor_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ConsumerSession" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "tokenNonce" TEXT NOT NULL,
    "aresSessionId" TEXT,
    "consumerProfileOid" BIGINT NOT NULL,
    "oauthAuthorizationOid" BIGINT,
    "authSessionId" TEXT,
    "ua" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "loggedOutAt" TIMESTAMP(3),

    CONSTRAINT "ConsumerSession_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ConsumerAuthExchange" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "code" TEXT,
    "email" TEXT,
    "name" TEXT,
    "aresUserId" TEXT,
    "aresSessionId" TEXT,
    "surfaceOid" BIGINT NOT NULL,
    "consumerSessionOid" BIGINT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ConsumerAuthExchange_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ConsumerProviderSetupSessionBinding" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "providerSetupSessionId" TEXT NOT NULL,
    "type" "ConsumerProviderSetupSessionType" NOT NULL DEFAULT 'provider_setup_session',
    "consumerProfileOid" BIGINT NOT NULL,
    "providerTemplateOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsumerProviderSetupSessionBinding_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Consumer" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "organizationOid" BIGINT NOT NULL,
    "organizationMemberOid" BIGINT,
    "organizationActorOid" BIGINT,
    "globalProfileOid" BIGINT,
    "userOid" BIGINT,
    "isOrganizationMember" BOOLEAN NOT NULL DEFAULT false,
    "isPortalConsumer" BOOLEAN NOT NULL DEFAULT false,
    "isManuallyCreated" BOOLEAN NOT NULL DEFAULT false,
    "isPending" BOOLEAN NOT NULL DEFAULT false,
    "isServiceAccount" BOOLEAN NOT NULL DEFAULT false,
    "cargoActorId" TEXT,
    "synthesisActorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Consumer_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "InstanceConsumer" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "consumerOid" BIGINT NOT NULL,
    "organizationMemberOid" BIGINT,
    "organizationActorOid" BIGINT,
    "isPending" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstanceConsumer_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ConsumerProfile" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "ConsumerProfileStatus" NOT NULL DEFAULT 'active',
    "aresUserId" TEXT,
    "ssoGroupIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ssoRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "inviteStatus" "ConsumerProfileInviteStatus" NOT NULL DEFAULT 'unset',
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "organizationOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "surfaceOid" BIGINT NOT NULL,
    "consumerOid" BIGINT NOT NULL,
    "accessTagOid" BIGINT NOT NULL,
    "organizationMemberOid" BIGINT,
    "organizationActorOid" BIGINT NOT NULL,
    "personalConsumerGroupOid" BIGINT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsumerProfile_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ConsumerInvite" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "ConsumerInviteStatus" NOT NULL DEFAULT 'pending',
    "message" TEXT,
    "organizationOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "surfaceOid" BIGINT NOT NULL,
    "consumerOid" BIGINT NOT NULL,
    "consumerProfileOid" BIGINT NOT NULL,
    "invitedByOid" BIGINT NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "legacyGraceStartedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsumerInvite_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ConsumerProfileGroup" (
    "oid" BIGSERIAL NOT NULL,
    "profileOid" BIGINT NOT NULL,
    "groupOid" BIGINT NOT NULL,
    "assignedVia" "ConsumerProfileGroupAssignedVia" NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsumerProfileGroup_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ConsumerOrganizationActor" (
    "oid" BIGSERIAL NOT NULL,
    "consumerOid" BIGINT NOT NULL,
    "organizationActorOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsumerOrganizationActor_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ConsumerClient" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientUri" TEXT,
    "logoUri" TEXT,
    "tosUri" TEXT,
    "policyUri" TEXT,
    "redirectUris" TEXT[],
    "instanceOid" BIGINT,
    "organizationOid" BIGINT,
    "logoReconciledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumerSurfaceOid" BIGINT NOT NULL,

    CONSTRAINT "ConsumerClient_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ConsumerAuthClient" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientUri" TEXT,
    "logoUri" TEXT,
    "tosUri" TEXT,
    "policyUri" TEXT,
    "clientId" TEXT NOT NULL,
    "clientSecret" TEXT,
    "registrationIp" TEXT,
    "tokenEndpointAuthMethod" "ConsumerAuthClientTokenEndpointAuthMethod" NOT NULL DEFAULT 'client_secret_basic',
    "requirePkce" BOOLEAN NOT NULL DEFAULT false,
    "redirectUris" TEXT[],
    "magicMcpServerOid" BIGINT,
    "magicMcpEndpointOid" BIGINT,
    "skillPluginOid" BIGINT,
    "instanceOid" BIGINT,
    "organizationOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumerSurfaceOid" BIGINT,
    "consumerClientOid" BIGINT,

    CONSTRAINT "ConsumerAuthClient_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ConsumerAuthClientSurface" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "consumerSurfaceOid" BIGINT NOT NULL,
    "consumerAuthClientOid" BIGINT NOT NULL,
    "consumerClientOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsumerAuthClientSurface_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ConsumerAuthAttempt" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "ConsumerAuthAttemptStatus" NOT NULL DEFAULT 'pending',
    "consumerAuthClientOid" BIGINT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "state" TEXT,
    "authorizationCode" TEXT,
    "authorizationCodeExpiresAt" TIMESTAMP(3),
    "authorizationCodeUsedAt" TIMESTAMP(3),
    "refreshToken" TEXT,
    "codeChallengeMethod" "ConsumerAuthAttemptCodeChallengeMethod" NOT NULL DEFAULT 'none',
    "codeChallenge" TEXT,
    "consumerProfileOid" BIGINT,
    "magicMcpEndpointOid" BIGINT,
    "consumerIntegrationEndpointOid" BIGINT,
    "magicMcpTokenOid" BIGINT,
    "skillPluginOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authorizedAt" TIMESTAMP(3),
    "deniedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsumerAuthAttempt_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ConsumerAuthTestAuthorization" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "consumerAuthClientOid" BIGINT NOT NULL,
    "consumerSurfaceOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "organizationOid" BIGINT NOT NULL,
    "consumerProfileOid" BIGINT NOT NULL,
    "magicMcpEndpointOid" BIGINT NOT NULL,
    "skillPluginOid" BIGINT,
    "consumerAuthAttemptOid" BIGINT,
    "redirectUri" TEXT NOT NULL,
    "state" TEXT,
    "codeChallengeMethod" "ConsumerAuthAttemptCodeChallengeMethod" NOT NULL DEFAULT 'none',
    "codeChallenge" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),

    CONSTRAINT "ConsumerAuthTestAuthorization_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ConsumerGroup" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "ConsumerGroupStatus" NOT NULL,
    "type" "ConsumerGroupType" NOT NULL DEFAULT 'default',
    "isManaged" BOOLEAN NOT NULL DEFAULT false,
    "isDefaultEveryoneGroup" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "ssoGroupIds" TEXT[],
    "name" TEXT NOT NULL,
    "description" TEXT,
    "surfaceOid" BIGINT NOT NULL,
    "accessTagOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ConsumerGroup_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ConsumerToken" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "consumerOid" BIGINT NOT NULL,
    "consumerProfileOid" BIGINT NOT NULL,
    "magicMcpTokenOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsumerToken_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ConsumerIntegration" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "isManaged" BOOLEAN NOT NULL DEFAULT false,
    "instanceOid" BIGINT NOT NULL,
    "consumerOid" BIGINT NOT NULL,
    "consumerProfileOid" BIGINT NOT NULL,
    "magicMcpServerOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsumerIntegration_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ConsumerIntegrationEndpoint" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "isManaged" BOOLEAN NOT NULL DEFAULT false,
    "instanceOid" BIGINT NOT NULL,
    "consumerOid" BIGINT NOT NULL,
    "consumerProfileOid" BIGINT NOT NULL,
    "magicMcpEndpointOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsumerIntegrationEndpoint_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ConsumerIntegrationSession" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "consumerOid" BIGINT NOT NULL,
    "consumerProfileOid" BIGINT NOT NULL,
    "consumerIntegrationOid" BIGINT NOT NULL,
    "magicMcpSessionOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsumerIntegrationSession_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Portal" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "PortalStatus" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "slug" TEXT NOT NULL,
    "allowedRedirectUrlFilters" JSONB,
    "isDefaultPortal" BOOLEAN NOT NULL DEFAULT false,
    "organizationOid" BIGINT NOT NULL,
    "surfaceOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "portalSpecificNamespaceOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Portal_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderTemplate" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "ProviderTemplateStatus" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB NOT NULL,
    "providerDeploymentId" TEXT,
    "hasSubspaceBacking" BOOLEAN NOT NULL DEFAULT false,
    "subspaceIntegrationId" TEXT,
    "organizationOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ProviderTemplate_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ConsumerSkill" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "source" "ConsumerSkillSource" NOT NULL,
    "permissions" "ConsumerSkillPermission"[],
    "organizationOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "surfaceOid" BIGINT NOT NULL,
    "consumerProfileOid" BIGINT NOT NULL,
    "consumerOid" BIGINT NOT NULL,
    "skillOid" BIGINT NOT NULL,
    "cargoStoreParticipantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsumerSkill_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ConsumerSurface" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "ConsumerSurfaceStatus" NOT NULL,
    "type" "ConsumerSurfaceType" NOT NULL DEFAULT 'portal',
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "internalSurfaceUniqueIdentifier" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sessionExpiryTimeInSeconds" INTEGER NOT NULL,
    "emailWhitelist" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "allowConsumerSkillAuthoring" BOOLEAN NOT NULL DEFAULT true,
    "allowConsumerSkillPublishing" BOOLEAN NOT NULL DEFAULT true,
    "skillConfigurationId" TEXT,
    "organizationOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "consumerAuthTenantOid" BIGINT,
    "publishableApiKeyOid" BIGINT NOT NULL,
    "managedEveryoneGroupOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ConsumerSurface_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ConsumerSurfaceProviderGroup" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "index" INTEGER NOT NULL,
    "consumerSurfaceOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsumerSurfaceProviderGroup_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ConsumerSurfaceProviderGroupListing" (
    "oid" BIGSERIAL NOT NULL,
    "consumerSurfaceProviderGroupOid" BIGINT NOT NULL,
    "consumerAccessListingOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsumerSurfaceProviderGroupListing_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ConsumerAuthTenant" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "organizationOid" BIGINT NOT NULL,
    "aresAppId" TEXT,
    "aresAppSlug" TEXT,
    "aresClientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsumerAuthTenant_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "UsageMetric" (
    "key" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT,
    "instanceId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "providerId" TEXT,
    "deploymentId" TEXT,
    "consumerId" TEXT,
    "consumerProfileId" TEXT,
    "agentId" TEXT,
    "magicMcpServerId" TEXT,
    "integrationId" TEXT,
    "toolKey" TEXT,
    "errorType" TEXT,
    "count" BIGINT NOT NULL,
    "errorCount" BIGINT NOT NULL,
    "durationMsSum" BIGINT NOT NULL,
    "durationCount" BIGINT NOT NULL,
    "durationMsMax" BIGINT NOT NULL,

    CONSTRAINT "UsageMetric_pkey" PRIMARY KEY ("key")
);

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
CREATE TABLE "DocumentContent" (
    "oid" BIGSERIAL NOT NULL,
    "cargoOid" BIGINT,
    "content" TEXT NOT NULL,

    CONSTRAINT "DocumentContent_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Document" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "isContentOwner" BOOLEAN NOT NULL,
    "isReadOnly" BOOLEAN NOT NULL DEFAULT false,
    "isTemplateBacking" BOOLEAN NOT NULL DEFAULT false,
    "maxVersionNumber" INTEGER NOT NULL,
    "resourceTenantOid" BIGINT,
    "resourceGroupOid" BIGINT,
    "projectOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "contentOid" BIGINT NOT NULL,
    "fileOid" BIGINT NOT NULL,
    "currentVersionOid" BIGINT,
    "draftVersionExpiresAt" TIMESTAMP(3),
    "parentDocumentOid" BIGINT,
    "createdByResourceActorOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "DocumentParticipant" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "role" "DocumentParticipantRole" NOT NULL,
    "documentOid" BIGINT NOT NULL,
    "resourceActorOid" BIGINT NOT NULL,
    "storeParticipantOid" BIGINT,
    "editCount" INTEGER NOT NULL DEFAULT 0,
    "lastEditedAt" TIMESTAMP(3),
    "lastViewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentParticipant_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "DocumentVersion" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "listEditedAt" TIMESTAMP(3),
    "resourceTenantOid" BIGINT,
    "resourceGroupOid" BIGINT,
    "projectOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "documentOid" BIGINT NOT NULL,
    "contentOid" BIGINT NOT NULL,
    "previousVersionOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "DocumentVersionEditors" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "documentVersionOid" BIGINT NOT NULL,
    "resourceActorOid" BIGINT NOT NULL,
    "ip" TEXT,
    "ua" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentVersionEditors_pkey" PRIMARY KEY ("oid")
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
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "delegatorOid" BIGINT,
    "delegatorRef" JSONB,
    "delegatedContentUrl" TEXT,
    "delegatedContentUrlExpiresAt" TIMESTAMP(3),
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileType" TEXT NOT NULL,
    "isReadOnly" BOOLEAN NOT NULL DEFAULT false,
    "isTemplateBacking" BOOLEAN NOT NULL DEFAULT false,
    "contentSha256" TEXT,
    "contentSha256StoreId" TEXT,
    "contentGitBlobSha" TEXT,
    "contentCrc32" BIGINT,
    "purposeOid" INTEGER NOT NULL,
    "userOid" BIGINT,
    "organizationOid" BIGINT,
    "instanceOid" BIGINT,
    "resourceTenantOid" BIGINT,
    "resourceGroupOid" BIGINT,
    "createdByResourceActorOid" BIGINT,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "File_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "FileContentDelegator" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileContentDelegator_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "FilePendingContent" (
    "oid" BIGSERIAL NOT NULL,
    "fileOid" BIGINT NOT NULL,
    "content" BYTEA NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "flushAfter" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FilePendingContent_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "FileLink" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "fileOid" BIGINT NOT NULL,
    "resourceTenantOid" BIGINT,
    "resourceGroupOid" BIGINT,
    "projectOid" BIGINT,
    "instanceOid" BIGINT,
    "createdByResourceActorOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "FileLink_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "FileReference" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "fileLinkOid" BIGINT NOT NULL,
    "resourceTenantOid" BIGINT,
    "resourceGroupOid" BIGINT,
    "projectOid" BIGINT,
    "instanceOid" BIGINT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileReference_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Store" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "access" "StoreAccess" NOT NULL DEFAULT 'private',
    "cloneType" "StoreCloneType",
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "byteSize" BIGINT,
    "dirtyAt" TIMESTAMP(3),
    "isReadOnly" BOOLEAN NOT NULL DEFAULT false,
    "isTemplateBacking" BOOLEAN NOT NULL DEFAULT false,
    "lastEditedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pathMode" "StorePathMode" NOT NULL DEFAULT 'legacy',
    "createdByResourceActorOid" BIGINT,
    "resourceTenantOid" BIGINT,
    "resourceGroupOid" BIGINT,
    "projectOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "parentStoreOid" BIGINT,
    "parentStoreTemplateOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "StoreTemplate" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "StoreTemplateType" NOT NULL,
    "hash" TEXT,
    "resourceTenantOid" BIGINT,
    "resourceGroupOid" BIGINT,
    "projectOid" BIGINT,
    "instanceOid" BIGINT,
    "sourceStoreOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreTemplate_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "StoreTemplateItem" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "kind" "StoreItemKind" NOT NULL,
    "path" TEXT NOT NULL,
    "content" TEXT,
    "encoding" "StoreTemplateItemEncoding",
    "mimeType" TEXT,
    "title" TEXT,
    "hash" TEXT,
    "contentHash" TEXT,
    "fileStoreId" TEXT,
    "contentByteSize" INTEGER,
    "storeTemplateOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreTemplateItem_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "StoreTemplateBacking" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "storeTemplateOid" BIGINT NOT NULL,
    "resourceTenantOid" BIGINT,
    "resourceGroupOid" BIGINT,
    "projectOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "storeOid" BIGINT NOT NULL,
    "lastSyncedHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreTemplateBacking_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "StoreItem" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "kind" "StoreItemKind" NOT NULL,
    "path" TEXT NOT NULL,
    "storeOid" BIGINT NOT NULL,
    "fileOid" BIGINT,
    "referenceOid" BIGINT,
    "documentOid" BIGINT,
    "directoryOid" BIGINT,
    "parentDirectoryOid" BIGINT,
    "lastModifiedByResourceActorOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreItem_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "StoreVersion" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "sourceDirtyAt" TIMESTAMP(3) NOT NULL,
    "storeOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreVersion_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "StoreVersionItem" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "kind" "StoreItemKind" NOT NULL,
    "path" TEXT NOT NULL,
    "storeVersionOid" BIGINT NOT NULL,
    "fileOid" BIGINT,
    "documentOid" BIGINT,
    "documentTitle" TEXT,
    "documentVersionOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreVersionItem_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "StoreParticipantPrincipal" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "roles" "StoreParticipantRole"[] DEFAULT ARRAY[]::"StoreParticipantRole"[],
    "storeOid" BIGINT NOT NULL,
    "consumerOid" BIGINT,
    "primaryResourceActorOid" BIGINT NOT NULL,
    "lastActiveAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreParticipantPrincipal_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "StoreParticipant" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "roles" "StoreParticipantRole"[] DEFAULT ARRAY[]::"StoreParticipantRole"[],
    "permissions" "StoreParticipantPermissions"[],
    "storeOid" BIGINT NOT NULL,
    "storeParticipantOid" BIGINT,
    "resourceActorOid" BIGINT NOT NULL,
    "lastActiveAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreParticipant_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "StoreDirectory" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "isAutoCreated" BOOLEAN NOT NULL,
    "path" TEXT NOT NULL,
    "storeOid" BIGINT NOT NULL,
    "parentDirectoryOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreDirectory_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "FileUpload" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "FileUploadStatus" NOT NULL DEFAULT 'pending',
    "storeId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileType" TEXT NOT NULL,
    "title" TEXT,
    "purposeOid" INTEGER NOT NULL,
    "userOid" BIGINT,
    "organizationOid" BIGINT,
    "instanceOid" BIGINT,
    "createdByResourceActorOid" BIGINT,
    "attachStoreId" TEXT,
    "attachPath" TEXT,
    "attachReplace" BOOLEAN NOT NULL DEFAULT false,
    "fileOid" BIGINT,
    "uploadUrlExpiresAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileUpload_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "IdentityActor" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "IdentityActorType" NOT NULL,
    "status" "IdentityActorStatus" NOT NULL,
    "name" TEXT NOT NULL,
    "organizationOid" BIGINT NOT NULL,
    "projectOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdentityActor_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Agent" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "AgentType" NOT NULL,
    "status" "AgentStatus" NOT NULL,
    "name" TEXT NOT NULL,
    "actorOid" BIGINT NOT NULL,
    "organizationOid" BIGINT NOT NULL,
    "projectOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "AgentClient" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "AgentClientType" NOT NULL,
    "name" TEXT NOT NULL,
    "organizationOid" BIGINT NOT NULL,
    "projectOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "consumerClientOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastConnectedAt" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentClient_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "AgentClientRegistration" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "agentClientOid" BIGINT NOT NULL,
    "consumerAuthClientOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentClientRegistration_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "AgentInstance" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "AgentInstanceType" NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT,
    "description" TEXT,
    "hash" TEXT NOT NULL,
    "agentOid" BIGINT NOT NULL,
    "agentClientOid" BIGINT,
    "agentClientRegistrationOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastConnectedAt" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentInstance_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ApiKeySecret" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "secretSha512" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "rolledAt" TIMESTAMP(3),
    "apiKeyOid" BIGINT NOT NULL,

    CONSTRAINT "ApiKeySecret_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "type" "ApiKeyType" NOT NULL,
    "status" "ApiKeyStatus" NOT NULL,
    "kind" "ApiKeyKind" NOT NULL DEFAULT 'user_created',
    "secretRedacted" TEXT NOT NULL,
    "secretLength" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ipFilters" TEXT[],
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
CREATE TABLE "ApiKeyCreatedEmailSend" (
    "oid" BIGSERIAL NOT NULL,
    "apiKeyOid" BIGINT NOT NULL,
    "organizationOid" BIGINT NOT NULL,
    "memberOid" BIGINT NOT NULL,
    "userOid" BIGINT NOT NULL,
    "email" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKeyCreatedEmailSend_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ApiKeyExpiredEmailSend" (
    "oid" BIGSERIAL NOT NULL,
    "apiKeyOid" BIGINT NOT NULL,
    "organizationOid" BIGINT NOT NULL,
    "memberOid" BIGINT NOT NULL,
    "userOid" BIGINT NOT NULL,
    "email" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKeyExpiredEmailSend_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "CliDevice" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "organizationOid" BIGINT NOT NULL,
    "userOid" BIGINT NOT NULL,
    "oauthAuthorizationOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CliDevice_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "MachineAccess" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "type" "MachineAccessType" NOT NULL,
    "status" "MachineAccessStatus" NOT NULL,
    "kind" "MachineAccessKind" NOT NULL DEFAULT 'api_key',
    "hasCustomScopes" BOOLEAN NOT NULL DEFAULT false,
    "scopes" TEXT[],
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
CREATE TABLE "OAuthApplication" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "OAuthApplicationStatus" NOT NULL,
    "type" "OAuthApplicationType" NOT NULL,
    "accessLevel" "OAuthAuthorizationAccessLevel" NOT NULL,
    "subjectType" "OAuthApplicationSubjectType" NOT NULL DEFAULT 'organization_member',
    "systemIdentifier" TEXT,
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
    "isImportedFromOtherInstance" BOOLEAN NOT NULL DEFAULT false,
    "organizationOid" BIGINT,
    "serverSideMachineAccessOid" BIGINT,
    "scopedInstallationOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthApplication_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "InternalOAuthToken" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "cacheKeyHash" TEXT NOT NULL,
    "subjectType" "InternalOAuthTokenSubjectType" NOT NULL,
    "subjectIdentifier" TEXT NOT NULL,
    "scopeType" "InternalOAuthTokenScopeType" NOT NULL,
    "scopes" TEXT[],
    "scopeHash" TEXT NOT NULL,
    "oauthApplicationOid" BIGINT NOT NULL,
    "oauthInstallationOid" BIGINT NOT NULL,
    "oauthAuthorizationOid" BIGINT NOT NULL,
    "oauthTokenOid" BIGINT NOT NULL,
    "organizationOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "organizationMemberOid" BIGINT,
    "machineAccessOid" BIGINT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InternalOAuthToken_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "OAuthApplicationClientSecret" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "secretPreview" TEXT NOT NULL,
    "oauthApplicationOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "OAuthApplicationClientSecret_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "OAuthInstallation" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "OAuthInstallationStatus" NOT NULL,
    "scopes" TEXT[],
    "oidcScopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "oauthApplicationOid" BIGINT NOT NULL,
    "organizationOid" BIGINT NOT NULL,
    "appActorOid" BIGINT,
    "serverSideMachineAccessOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "OAuthInstallation_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "OAuthAuthorization" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "OAuthAuthorizationStatus" NOT NULL,
    "type" "OAuthAuthorizationType" NOT NULL,
    "subjectType" "OAuthSubjectType" NOT NULL DEFAULT 'organization_member',
    "scopes" TEXT[],
    "oidcScopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "oauthInstallationOid" BIGINT NOT NULL,
    "oauthApplicationOid" BIGINT NOT NULL,
    "organizationOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "userOid" BIGINT,
    "organizationMemberOid" BIGINT,
    "consumerProfileOid" BIGINT,
    "machineAccessOid" BIGINT NOT NULL,
    "requestingIp" TEXT,
    "acceptingIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "OAuthAuthorization_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "OAuthAuthorizationFlow" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "type" "OAuthAuthorizationFlowType" NOT NULL,
    "status" "OAuthAuthorizationFlowStatus" NOT NULL,
    "subjectType" "OAuthSubjectType" NOT NULL DEFAULT 'organization_member',
    "scopes" TEXT[],
    "oidcScopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "deniedAt" TIMESTAMP(3),
    "lastPollAt" TIMESTAMP(3),
    "clientIp" TEXT,
    "redirectUri" TEXT,
    "nonce" TEXT,
    "userOid" BIGINT NOT NULL,
    "organizationOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "consumerProfileOid" BIGINT,
    "codeChallengeMethod" "OAuthAuthorizationFlowChallengeMethod" NOT NULL,
    "codeChallenge" TEXT,
    "oauthApplicationOid" BIGINT NOT NULL,
    "oauthAuthorizationOid" BIGINT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),

    CONSTRAINT "OAuthAuthorizationFlow_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "OAuthToken" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "oauthAuthorizationOid" BIGINT NOT NULL,
    "oauthInstallationOid" BIGINT NOT NULL,
    "accessTokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "completelyExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastRefreshedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "OAuthToken_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ServiceAccount" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "ServiceAccountStatus" NOT NULL,
    "subjectType" "OAuthSubjectType" NOT NULL DEFAULT 'organization_member',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scopes" TEXT[],
    "organizationOid" BIGINT NOT NULL,
    "oauthApplicationOid" BIGINT NOT NULL,
    "portalOid" BIGINT,
    "consumerProfileOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceAccount_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ServiceAccountCredential" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "serviceAccountOid" BIGINT NOT NULL,
    "oauthAuthorizationOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ServiceAccountCredential_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "MagicMcpEndpoint" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "MagicMcpEndpointStatus" NOT NULL,
    "isConsumerReconciled" BOOLEAN NOT NULL DEFAULT false,
    "hasSubspaceBacking" BOOLEAN NOT NULL DEFAULT false,
    "isSubspaceBackingReconciling" BOOLEAN NOT NULL DEFAULT false,
    "instanceOid" BIGINT NOT NULL,
    "consumerProfileOid" BIGINT,
    "source" "IntegrationResourceSource",
    "isOwnerLocked" BOOLEAN NOT NULL DEFAULT false,
    "isOwnerOnlyVisible" BOOLEAN NOT NULL DEFAULT false,
    "isSystemOwned" BOOLEAN NOT NULL DEFAULT false,
    "ownerActorOid" BIGINT,
    "skillPluginOid" BIGINT,
    "enableSkillEditing" BOOLEAN NOT NULL DEFAULT false,
    "enableSkillResources" BOOLEAN NOT NULL DEFAULT false,
    "skillSelectionType" "MagicMcpEndpointSkillSelectionType" NOT NULL DEFAULT 'all',
    "subspaceSessionTemplateId" TEXT,
    "subspaceEphemeralManagedSessionId" TEXT,
    "configurationHash" TEXT,
    "name" TEXT,
    "description" TEXT,
    "slug" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MagicMcpEndpoint_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "MagicMcpEndpointServer" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL DEFAULT ('mgep_00' || replace((gen_random_uuid())::text, '-', '')),
    "magicMcpEndpointOid" BIGINT NOT NULL,
    "magicMcpServerOid" BIGINT NOT NULL,
    "toolFilters" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MagicMcpEndpointServer_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "MagicMcpEndpointSkillSelection" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "magicMcpEndpointOid" BIGINT NOT NULL,
    "skillOid" BIGINT,
    "skillGroupOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MagicMcpEndpointSkillSelection_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "MagicMcpGroup" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "MagicMcpGroupStatus" NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "slug" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MagicMcpGroup_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "MagicMcpGroupServer" (
    "oid" BIGSERIAL NOT NULL,
    "magicMcpGroupOid" BIGINT NOT NULL,
    "magicMcpServerOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MagicMcpGroupServer_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "MagicMcpGroupToken" (
    "oid" BIGSERIAL NOT NULL,
    "magicMcpGroupOid" BIGINT NOT NULL,
    "magicMcpTokenOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MagicMcpGroupToken_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "MagicMcpServer" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "MagicMcpServerStatus" NOT NULL,
    "source" "MagicMcpServerSource" NOT NULL DEFAULT 'manual',
    "ownerType" "MagicMcpServerOwnerType" NOT NULL DEFAULT 'server_owned',
    "isConsumerReconciled" BOOLEAN NOT NULL DEFAULT false,
    "hasSubspaceBacking" BOOLEAN NOT NULL DEFAULT false,
    "isSubspaceBackingReconciling" BOOLEAN NOT NULL DEFAULT false,
    "providerTemplateId" TEXT,
    "subspaceSessionTemplateId" TEXT,
    "subspaceIntegrationInstanceId" TEXT,
    "subspaceEphemeralManagedSessionId" TEXT,
    "instanceOid" BIGINT NOT NULL,
    "isOwnerLocked" BOOLEAN NOT NULL DEFAULT false,
    "isOwnerOnlyVisible" BOOLEAN NOT NULL DEFAULT false,
    "isSystemOwned" BOOLEAN NOT NULL DEFAULT false,
    "ownerActorOid" BIGINT,
    "name" TEXT,
    "description" TEXT,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MagicMcpServer_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "MagicMcpServerAlias" (
    "oid" BIGSERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "serverOid" BIGINT NOT NULL,

    CONSTRAINT "MagicMcpServerAlias_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "MagicMcpServerSubspaceSession" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isConsumerReconciled" BOOLEAN NOT NULL DEFAULT false,
    "magicMcpServerOid" BIGINT,
    "magicMcpEndpointOid" BIGINT,
    "instanceOid" BIGINT NOT NULL,
    "subspaceSessionId" TEXT NOT NULL,
    "subspaceSessionTemplateId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MagicMcpServerSubspaceSession_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "MagicMcpToken" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "MagicMcpTokenStatus" NOT NULL,
    "isGroupLocked" BOOLEAN NOT NULL DEFAULT false,
    "isConsumerReconciled" BOOLEAN NOT NULL DEFAULT false,
    "secret" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "metadata" JSONB NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "magicMcpServerOid" BIGINT,
    "magicMcpEndpointOid" BIGINT,
    "skillPluginOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "MagicMcpToken_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "MagicMcpTokenUse" (
    "oid" BIGSERIAL NOT NULL,
    "magicMcpTokenOid" BIGINT NOT NULL,
    "magicMcpServerOid" BIGINT,
    "magicMcpEndpointOid" BIGINT,
    "magicMcpTarget" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "ua" TEXT NOT NULL DEFAULT '',
    "hour" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MagicMcpTokenUse_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Firewall" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "FirewallStatus" NOT NULL DEFAULT 'active',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "slug" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "needsSubspaceSync" BOOLEAN NOT NULL DEFAULT true,
    "subspaceSyncedRevision" INTEGER NOT NULL DEFAULT 0,
    "organizationOid" BIGINT NOT NULL,
    "projectOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Firewall_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "FirewallNetworkPolicy" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "firewallOid" BIGINT NOT NULL,
    "networkPolicyOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FirewallNetworkPolicy_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "NetworkPolicy" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "NetworkPolicyStatus" NOT NULL DEFAULT 'active',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "currentVersionNumber" INTEGER NOT NULL DEFAULT 0,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "needsSubspaceSync" BOOLEAN NOT NULL DEFAULT true,
    "subspaceSyncedRevision" INTEGER NOT NULL DEFAULT 0,
    "currentVersionOid" BIGINT,
    "organizationOid" BIGINT NOT NULL,
    "projectOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "NetworkPolicy_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "NetworkPolicyVersion" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "rules" JSONB NOT NULL,
    "networkPolicyOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NetworkPolicyVersion_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "AccessRole" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scopes" TEXT[],
    "organizationOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessRole_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "AccessRoleVersion" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "scopes" TEXT[],
    "scopesAdded" TEXT[],
    "scopesRemoved" TEXT[],
    "message" TEXT,
    "accessRoleOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessRoleVersion_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "AccessPolicy" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "type" "AccessPolicyType" NOT NULL,
    "hasBeenCustomized" BOOLEAN NOT NULL DEFAULT false,
    "autoUpdateScopesHash" TEXT,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "document" JSONB NOT NULL,
    "organizationOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessPolicy_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "AccessPolicyRole" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "accessPolicyOid" BIGINT NOT NULL,
    "accessRoleOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessPolicyRole_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "AccessPolicyProject" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "accessPolicyOid" BIGINT NOT NULL,
    "projectOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessPolicyProject_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "AccessPolicyInstance" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "accessPolicyOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessPolicyInstance_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "AccessPolicyVersion" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "message" TEXT,
    "document" JSONB NOT NULL,
    "accessPolicyOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessPolicyVersion_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "AccessPolicyAssignment" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "accessPolicyOid" BIGINT NOT NULL,
    "memberOid" BIGINT,
    "teamOid" BIGINT,
    "serviceAccountOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessPolicyAssignment_pkey" PRIMARY KEY ("oid")
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
    "internalActorIdentifier" TEXT,
    "cargoActorId" TEXT,
    "subspaceActorId" TEXT,
    "synthesisActorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationActor_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProjectBrand" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT true,
    "isCustomized" BOOLEAN NOT NULL DEFAULT false,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "image" JSONB NOT NULL,
    "subspaceBrandId" TEXT,
    "projectOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectBrand_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProjectBrandUpdate" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "createdByOid" BIGINT NOT NULL,
    "brandOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectBrandUpdate_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "OrganizationConfigType" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownership" "OrganizationConfigOwnership" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationConfigType_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "OrganizationConfig" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "typeOid" BIGINT NOT NULL,
    "targetHash" TEXT NOT NULL,
    "userOid" BIGINT,
    "organizationOid" BIGINT,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationConfig_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Environment" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "type" "EnvironmentType" NOT NULL,
    "status" "EnvironmentStatus" NOT NULL,
    "name" TEXT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "creatorActorOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Environment_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Sandbox" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SandboxStatus" NOT NULL,
    "name" TEXT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "creatorActorOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sandbox_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Instance" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "type" "InstanceType" NOT NULL,
    "status" "InstanceStatus" NOT NULL,
    "slug" TEXT NOT NULL,
    "oldSlug" TEXT,
    "previousSlugs" TEXT[],
    "name" TEXT NOT NULL,
    "hasBeenReconciled" BOOLEAN NOT NULL DEFAULT false,
    "hasBeenReconciled2" BOOLEAN NOT NULL DEFAULT false,
    "projectOid" BIGINT NOT NULL,
    "organizationOid" BIGINT NOT NULL,
    "resourceTenantOid" BIGINT,
    "resourceGroupOid" BIGINT,
    "subspaceTenantIdentifier" TEXT,
    "subspaceEnvironmentIdentifier" TEXT,
    "subspaceTenantId" TEXT,
    "cargoTenantId" TEXT,
    "synthesisTenantId" TEXT,
    "subspaceEnvironmentId" TEXT,
    "cargoEnvironmentId" TEXT,
    "synthesisEnvironmentId" TEXT,
    "lastSubspaceSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Instance_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "OrganizationLayoutType" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownership" "OrganizationLayoutOwnership" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationLayoutType_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "OrganizationLayout" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "typeOid" BIGINT NOT NULL,
    "targetHash" TEXT NOT NULL,
    "userOid" BIGINT,
    "organizationOid" BIGINT,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationLayout_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "OrganizationMember" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "role" "OrganizationMemberRole" NOT NULL,
    "status" "OrganizationMemberStatus" NOT NULL,
    "isV2Member" BOOLEAN NOT NULL DEFAULT false,
    "usesMetorialPersonal" BOOLEAN NOT NULL DEFAULT false,
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
    "action" "OrganizationInviteAction" NOT NULL DEFAULT 'invite',
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
CREATE TABLE "OrganizationNotificationType" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sendEmail" BOOLEAN NOT NULL,
    "severity" "OrganizationNotificationSeverity" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationNotificationType_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "OrganizationNotification" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "OrganizationNotificationStatus" NOT NULL DEFAULT 'active',
    "kind" TEXT NOT NULL,
    "organizationOid" BIGINT NOT NULL,
    "typeOid" BIGINT NOT NULL,
    "onlyForMemberIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notForMemberIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "onlyForMemberRoles" "OrganizationMemberRole"[] DEFAULT ARRAY[]::"OrganizationMemberRole"[],
    "suppressEmail" BOOLEAN NOT NULL DEFAULT false,
    "message" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "actions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),

    CONSTRAINT "OrganizationNotification_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "OrganizationNotificationDestination" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "OrganizationNotificationDestinationStatus" NOT NULL DEFAULT 'active',
    "memberOid" BIGINT NOT NULL,
    "notificationOid" BIGINT NOT NULL,
    "emailStatus" "OrganizationNotificationEmailStatus" NOT NULL DEFAULT 'disabled',
    "emailSendAfter" TIMESTAMP(3),
    "emailId" TEXT,
    "emailSentAt" TIMESTAMP(3),
    "emailDigestOid" BIGINT,
    "readAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationNotificationDestination_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "OrganizationNotificationSetting" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "userOid" BIGINT NOT NULL,
    "organizationOid" BIGINT NOT NULL,
    "typeOid" BIGINT NOT NULL,
    "emailEnabled" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationNotificationSetting_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "OrganizationNotificationDigestSetting" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "userOid" BIGINT NOT NULL,
    "organizationOid" BIGINT NOT NULL,
    "timeMinutes" INTEGER NOT NULL DEFAULT 480,
    "timezone" TEXT NOT NULL DEFAULT 'America/Los_Angeles',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationNotificationDigestSetting_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "OrganizationNotificationEmailDigest" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "OrganizationNotificationEmailDigestStatus" NOT NULL DEFAULT 'pending',
    "organizationOid" BIGINT NOT NULL,
    "memberOid" BIGINT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "emailId" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationNotificationEmailDigest_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Organization" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "type" "OrganizationType" NOT NULL,
    "status" "OrganizationStatus" NOT NULL,
    "authVersion" "OrganizationAuthVersion" NOT NULL DEFAULT 'v1',
    "enforceTeamAccess" BOOLEAN NOT NULL DEFAULT false,
    "auditLogRetentionInDays" INTEGER,
    "magicMcpOrigin" TEXT,
    "canCreateGlobalOauthApps" BOOLEAN NOT NULL DEFAULT false,
    "slug" TEXT NOT NULL,
    "previousSlugs" TEXT[],
    "name" TEXT NOT NULL,
    "image" JSONB NOT NULL,
    "internalTenantIdentifier" TEXT,
    "subspaceTenantIds" TEXT[],
    "cargoTenantId" TEXT,
    "cargoEnvironmentId" TEXT,
    "resourceTenantOid" BIGINT,
    "resourceGroupOid" BIGINT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Profile" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "updateAllowed" BOOLEAN NOT NULL DEFAULT true,
    "isCustomized" BOOLEAN NOT NULL DEFAULT false,
    "type" "ProfileType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "slug" TEXT NOT NULL,
    "isMetorial" BOOLEAN NOT NULL DEFAULT false,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isOfficial" BOOLEAN NOT NULL DEFAULT false,
    "image" JSONB NOT NULL,
    "attributes" JSONB NOT NULL,
    "organizationOid" BIGINT,
    "userOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProfileUpdate" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "isAutoUpdate" BOOLEAN NOT NULL DEFAULT false,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "createdByOid" BIGINT NOT NULL,
    "profileOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileUpdate_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Project" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "ProjectStatus" NOT NULL,
    "slug" TEXT NOT NULL,
    "previousSlugs" TEXT[],
    "name" TEXT NOT NULL,
    "hidePublicRemoteProviders" BOOLEAN NOT NULL DEFAULT false,
    "onlyAllowTrustedProviders" BOOLEAN NOT NULL DEFAULT false,
    "magicMcpSessionDurationMinutes" INTEGER NOT NULL DEFAULT 1440,
    "logRetentionInDays" INTEGER NOT NULL DEFAULT 30,
    "enforceSessionExpiry" BOOLEAN NOT NULL DEFAULT false,
    "allowAuthConfigExport" BOOLEAN NOT NULL DEFAULT false,
    "allowAuthConfigImport" BOOLEAN NOT NULL DEFAULT false,
    "onlyAllowOAuthAuthMethods" BOOLEAN NOT NULL DEFAULT false,
    "dataRetentionLevel" "ProjectDataRetentionLevel" NOT NULL DEFAULT 'full',
    "storeToolCallAttachments" BOOLEAN NOT NULL DEFAULT true,
    "collectErrors" BOOLEAN NOT NULL DEFAULT true,
    "disableCallbacks" BOOLEAN NOT NULL DEFAULT false,
    "collectOperationDescriptionForToolCalls" BOOLEAN NOT NULL DEFAULT true,
    "messageProcessingTimeoutMs" INTEGER NOT NULL DEFAULT 30000,
    "sessionlessMcpEnabled" BOOLEAN,
    "useIntegrationNamesForSessionProviderNameTemplates" BOOLEAN NOT NULL DEFAULT false,
    "skillSyncGitLfsThresholdBytes" INTEGER,
    "organizationOid" BIGINT NOT NULL,
    "subspaceTenantIdentifier" TEXT,
    "subspaceTenantId" TEXT,
    "cargoTenantId" TEXT,
    "synthesisTenantId" TEXT,
    "nebulaTenantId" TEXT,
    "resourceTenantOid" BIGINT,
    "resourceGroupOid" BIGINT,
    "consumerAuthClientRegistrationsPerMinuteLimit" INTEGER NOT NULL DEFAULT 10,
    "consumerAuthClientRegistrationsPerHourLimit" INTEGER NOT NULL DEFAULT 25,
    "autoAddOrganizationMembersToPortals" BOOLEAN NOT NULL DEFAULT false,
    "allowConsumerSkillEditing" BOOLEAN NOT NULL DEFAULT true,
    "allowOrganizationMemberFullSkillAccess" BOOLEAN NOT NULL DEFAULT false,
    "reducedSubprocessors" BOOLEAN NOT NULL DEFAULT false,
    "allowApiAccessToConsumerOwnedResources" BOOLEAN NOT NULL DEFAULT true,
    "allowMemberAccessToConsumerOwnedResources" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Team" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "organizationOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "TeamProject" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "teamOid" BIGINT NOT NULL,
    "projectOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamProject_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "teamOid" BIGINT NOT NULL,
    "organizationActorOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "OutpostInstance" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "OutpostInstanceStatus" NOT NULL,
    "outpostOid" BIGINT NOT NULL,
    "credentialOid" BIGINT NOT NULL,
    "identifier" TEXT NOT NULL,
    "publicKey" BYTEA NOT NULL,
    "keyRotationCount" INTEGER NOT NULL DEFAULT 0,
    "lastKeyRotationAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "lastSeenIp" TEXT,
    "registrationCount" INTEGER NOT NULL DEFAULT 0,
    "lastRegisteredAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutpostInstance_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "OutpostInstanceService" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "service" "OutpostService" NOT NULL,
    "version" TEXT,
    "capabilities" JSONB NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutpostInstanceService_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "OutpostInstanceKeyRotation" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "publicKey" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutpostInstanceKeyRotation_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "OutpostInstanceEvent" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "logType" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutpostInstanceEvent_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "OutpostTokenKeyPair" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "OutpostTokenKeyPairStatus" NOT NULL,
    "accountOid" BIGINT NOT NULL,
    "organizationOid" BIGINT NOT NULL,
    "publicKey" BYTEA NOT NULL,
    "privateKeyEncrypted" BYTEA NOT NULL,
    "stopSigningAt" TIMESTAMP(3) NOT NULL,
    "stopVerifyingAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutpostTokenKeyPair_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Outpost" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "OutpostStatus" NOT NULL,
    "connectionStatus" "OutpostConnectionStatus" NOT NULL,
    "accountOid" BIGINT NOT NULL,
    "organizationOid" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "instanceCount" INTEGER NOT NULL DEFAULT 0,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Outpost_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "OutpostCredential" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "OutpostCredentialStatus" NOT NULL,
    "outpostOid" BIGINT NOT NULL,
    "identifier" TEXT NOT NULL,
    "publicKey" BYTEA NOT NULL,
    "envelopePreview" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "OutpostCredential_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "OutpostAccess" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "services" "OutpostService"[],
    "outpostOid" BIGINT NOT NULL,
    "projectOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "organizationOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutpostAccess_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProductAssistantImplementation" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductAssistantImplementation_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProductAssistant" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "ownerType" "ProductAssistantOwner" NOT NULL,
    "projectOid" BIGINT,
    "implementationOid" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "systemIdentifier" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductAssistant_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProductAssistantConfig" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "projectOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductAssistantConfig_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProductAssistantInstance" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "assistantOid" BIGINT NOT NULL,
    "projectOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductAssistantInstance_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProductAssistantConversation" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "title" TEXT,
    "input" JSONB,
    "assistantInstanceOid" BIGINT NOT NULL,
    "assistantOid" BIGINT NOT NULL,
    "projectOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "createdByResourceActorOid" BIGINT NOT NULL,
    "rootMessageOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductAssistantConversation_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProductAssistantConversationParticipant" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "conversationOid" BIGINT NOT NULL,
    "resourceActorOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductAssistantConversationParticipant_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProductAssistantRequest" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "ProductAssistantRequestStatus" NOT NULL,
    "conversationOid" BIGINT NOT NULL,
    "assistantInstanceOid" BIGINT NOT NULL,
    "assistantOid" BIGINT NOT NULL,
    "modelOid" BIGINT NOT NULL,
    "messageOid" BIGINT NOT NULL,
    "historySize" INTEGER,
    "resourceActorOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductAssistantRequest_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProductAssistantMessage" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "type" "ProductAssistantMessageType" NOT NULL,
    "status" "ProductAssistantMessageStatus" NOT NULL DEFAULT 'completed',
    "runOid" BIGINT,
    "requestOid" BIGINT,
    "assistantInstanceOid" BIGINT,
    "assistantOid" BIGINT,
    "parentMessageOid" BIGINT,
    "modelOid" BIGINT,
    "state" JSONB NOT NULL,
    "serialized" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductAssistantMessage_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProductAssistantConversationItem" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "conversationOid" BIGINT NOT NULL,
    "messageOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductAssistantConversationItem_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProductAssistantModel" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "contextWindow" INTEGER NOT NULL,
    "inputCostPerMillionTokens" DOUBLE PRECISION NOT NULL,
    "outputCostPerMillionTokens" DOUBLE PRECISION NOT NULL,
    "providerOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductAssistantModel_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProductAssistantModelProvider" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductAssistantModelProvider_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProductAssistantModelRun" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "ProductAssistantRunStatus" NOT NULL,
    "projectOid" BIGINT NOT NULL,
    "requestOid" BIGINT,
    "conversationOid" BIGINT,
    "assistantInstanceOid" BIGINT,
    "assistantOid" BIGINT,
    "modelOid" BIGINT NOT NULL,
    "cost" JSONB NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductAssistantModelRun_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProductAssistantSubspaceMcpConnection" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "solutionId" TEXT NOT NULL,
    "subspaceTenantId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "connectionToken" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3) NOT NULL,
    "projectOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductAssistantSubspaceMcpConnection_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProductAssistantSubspaceMcpToolCache" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "tools" JSONB NOT NULL,
    "cachedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductAssistantSubspaceMcpToolCache_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "AccessLimiter" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "target" "AccessLimiterTarget" NOT NULL,
    "hasIpAllowlist" BOOLEAN NOT NULL DEFAULT false,
    "ipWhitelist" TEXT[],
    "ipBlacklist" TEXT[],
    "createdByActorOid" BIGINT NOT NULL,
    "organizationOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessLimiter_pkey" PRIMARY KEY ("oid")
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
CREATE TABLE "SandboxDisk" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "type" "SandboxDiskType" NOT NULL DEFAULT 'standard',
    "status" "SandboxResourceStatus" NOT NULL DEFAULT 'active',
    "name" TEXT,
    "sizeBytes" BIGINT,
    "tenantOid" BIGINT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "organizationOid" BIGINT NOT NULL,
    "projectOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "machineOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SandboxDisk_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SandboxMachineFirewall" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "machineOid" BIGINT NOT NULL,
    "firewallOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SandboxMachineFirewall_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SandboxEgressPolicy" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SandboxEgressPolicyStatus" NOT NULL DEFAULT 'pending',
    "firewallSetHash" TEXT NOT NULL,
    "rules" JSONB,
    "rulesHash" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "warnings" JSONB,
    "lastError" TEXT,
    "needsCompile" BOOLEAN NOT NULL DEFAULT true,
    "organizationOid" BIGINT NOT NULL,
    "projectOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "compiledAt" TIMESTAMP(3),
    "unusedAt" TIMESTAMP(3),

    CONSTRAINT "SandboxEgressPolicy_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SandboxEgressPolicyFirewall" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "policyOid" BIGINT NOT NULL,
    "firewallOid" BIGINT NOT NULL,

    CONSTRAINT "SandboxEgressPolicyFirewall_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SandboxEgressPolicyRegion" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SandboxEgressPolicyRegionStatus" NOT NULL DEFAULT 'pending',
    "genesisId" TEXT,
    "syncedRevision" INTEGER NOT NULL DEFAULT 0,
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "failureMessage" TEXT,
    "policyOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SandboxEgressPolicyRegion_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SandboxMachineImageBuild" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SandboxMachineImageBuildStatus" NOT NULL DEFAULT 'preparing',
    "diskSizeBytes" BIGINT NOT NULL,
    "options" JSONB,
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "lastCheckedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contextUploadedAt" TIMESTAMP(3),
    "builtAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "instanceOid" BIGINT NOT NULL,
    "sourceFileOid" BIGINT,
    "imageOid" BIGINT NOT NULL,
    "versionOid" BIGINT NOT NULL,

    CONSTRAINT "SandboxMachineImageBuild_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SandboxMachineImageBuildRegion" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "kind" "SandboxMachineImageBuildRegionKind" NOT NULL,
    "status" "SandboxMachineImageBuildRegionStatus" NOT NULL DEFAULT 'pending',
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "genesisImageId" TEXT,
    "genesisBuildId" TEXT,
    "logStreamId" TEXT,
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "buildOid" BIGINT NOT NULL,
    "regionOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,

    CONSTRAINT "SandboxMachineImageBuildRegion_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SandboxMachineImage" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SandboxMachineImageStatus" NOT NULL DEFAULT 'pending',
    "identifier" TEXT,
    "name" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "organizationOid" BIGINT,
    "projectOid" BIGINT,
    "instanceOid" BIGINT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SandboxMachineImage_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SandboxMachineImageRegion" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SandboxResourceStatus" NOT NULL DEFAULT 'active',
    "genesisId" TEXT NOT NULL,
    "imageOid" BIGINT NOT NULL,
    "regionOid" BIGINT NOT NULL,
    "tenantOid" BIGINT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SandboxMachineImageRegion_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SandboxMachineImageVersion" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SandboxMachineImageStatus" NOT NULL DEFAULT 'pending',
    "releaseKey" TEXT,
    "versionNumber" INTEGER,
    "imageOid" BIGINT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SandboxMachineImageVersion_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SandboxMachineImageVersionRegion" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SandboxResourceStatus" NOT NULL DEFAULT 'active',
    "genesisId" TEXT NOT NULL,
    "digest" TEXT,
    "versionOid" BIGINT NOT NULL,
    "imageRegionOid" BIGINT NOT NULL,
    "regionOid" BIGINT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SandboxMachineImageVersionRegion_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SandboxMachine" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SandboxResourceStatus" NOT NULL DEFAULT 'active',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "tenantOid" BIGINT NOT NULL,
    "organizationOid" BIGINT NOT NULL,
    "projectOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "imageOid" BIGINT,
    "egressPolicyOid" BIGINT,
    "appliedEgressRegionOid" BIGINT,
    "needsEgressSync" BOOLEAN NOT NULL DEFAULT false,
    "egressSyncAttempt" INTEGER NOT NULL DEFAULT 0,
    "egressSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SandboxMachine_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SandboxRegion" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SandboxResourceStatus" NOT NULL DEFAULT 'active',
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cloud" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "areaName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SandboxRegion_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SandboxSpec" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SandboxResourceStatus" NOT NULL DEFAULT 'active',
    "identifier" TEXT NOT NULL,
    "memoryMiB" INTEGER NOT NULL,
    "vcpus" DOUBLE PRECISION NOT NULL,
    "diskBytes" BIGINT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SandboxSpec_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SandboxSpecRegion" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SandboxResourceStatus" NOT NULL DEFAULT 'active',
    "genesisId" TEXT NOT NULL,
    "specOid" BIGINT NOT NULL,
    "regionOid" BIGINT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SandboxSpecRegion_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SandboxTenant" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "regionOid" BIGINT NOT NULL,
    "organizationOid" BIGINT NOT NULL,
    "projectOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SandboxTenant_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SearchIndex" (
    "oid" SERIAL NOT NULL,
    "identifier" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchIndex_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SearchIndexRecord" (
    "oid" BIGSERIAL NOT NULL,
    "indexOid" INTEGER NOT NULL,
    "documentId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "fields" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchIndexRecord_pkey" PRIMARY KEY ("oid")
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
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "type" "SecretEventType" NOT NULL,
    "secretOid" BIGINT NOT NULL,
    "organizationActorOid" BIGINT,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecretEvent_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "CargoSyncMetorialOwnedRecord" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CargoSyncMetorialOwnedRecord_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "CargoSyncRecord" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "targetId" TEXT,
    "lastSeenRunId" TEXT NOT NULL,
    "conflict" JSONB,
    "conflictedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CargoSyncRecord_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "CargoSyncRun" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "CargoSyncRunStatus" NOT NULL DEFAULT 'pending',
    "phase" TEXT,
    "model" TEXT,
    "cursor" TEXT,
    "scannedCount" INTEGER NOT NULL DEFAULT 0,
    "upsertedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "conflictCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CargoSyncRun_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SkillAgent" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SkillAgentStatus" NOT NULL DEFAULT 'active',
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "skillOid" BIGINT NOT NULL,
    "storeItemOid" BIGINT,
    "documentOid" BIGINT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillAgent_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SkillConfiguration" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "isDefault" BOOLEAN,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "allowScripts" BOOLEAN NOT NULL DEFAULT true,
    "allowedFileExtensions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "allowNonStandardDirectories" BOOLEAN NOT NULL DEFAULT true,
    "resourceTenantOid" BIGINT,
    "resourceGroupOid" BIGINT,
    "projectOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillConfiguration_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SkillExportRef" (
    "oid" BIGSERIAL NOT NULL,
    "cargoOid" BIGINT,
    "hash" TEXT NOT NULL,
    "skillConfigurationOid" BIGINT,
    "skillOid" BIGINT,
    "managedSkillPluginOid" BIGINT,
    "skillPluginOid" BIGINT,
    "skillMarketplaceOid" BIGINT,
    "fileOid" BIGINT,
    "fileReferenceOid" BIGINT,
    "fileLinkOid" BIGINT,
    "fileDestinationTag" INTEGER,
    "fileManifestOid" BIGINT,
    "resourceTenantOid" BIGINT,
    "resourceGroupOid" BIGINT,
    "projectOid" BIGINT,
    "instanceOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillExportRef_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SkillExport" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "target" "SkillExportTarget" NOT NULL,
    "status" "SkillExportStatus" NOT NULL,
    "zipJobId" TEXT,
    "zipJobAttempts" INTEGER NOT NULL DEFAULT 0,
    "renamedEntries" JSONB,
    "exportRefOid" BIGINT NOT NULL,
    "fileOid" BIGINT,
    "fileReferenceOid" BIGINT,
    "fileLinkOid" BIGINT,
    "creatorResourceActorOid" BIGINT,
    "resourceTenantOid" BIGINT,
    "resourceGroupOid" BIGINT,
    "projectOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "SkillExport_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SkillGroup" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SkillGroupStatus" NOT NULL DEFAULT 'active',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "allowConsumerSkillAssignment" BOOLEAN NOT NULL DEFAULT true,
    "organizationOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillGroup_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SkillGroupItem" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SkillGroupItemStatus" NOT NULL DEFAULT 'active',
    "skillGroupOid" BIGINT NOT NULL,
    "skillOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillGroupItem_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SkillImport" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "sourceType" "SkillImportSourceType" NOT NULL,
    "status" "SkillImportStatus" NOT NULL DEFAULT 'pending',
    "repositoryUrl" TEXT,
    "repositoryId" TEXT,
    "repositoryName" TEXT,
    "ref" TEXT,
    "path" TEXT,
    "sourceFileName" TEXT,
    "sourceFileFormat" "SkillImportFileFormat",
    "codeBucketId" TEXT,
    "error" TEXT,
    "sourceFileOid" BIGINT,
    "sourceFileReferenceOid" BIGINT,
    "sourceFileLinkOid" BIGINT,
    "resourceTenantOid" BIGINT,
    "resourceGroupOid" BIGINT,
    "projectOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "creatorResourceActorOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillImport_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SkillImportItem" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SkillImportItemStatus" NOT NULL DEFAULT 'pending',
    "path" TEXT NOT NULL,
    "error" TEXT,
    "targetSkillId" TEXT NOT NULL,
    "skillImportOid" BIGINT NOT NULL,
    "skillOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "heartbeatAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cleanupCompletedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillImportItem_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SkillMarketplace" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SkillMarketplaceStatus" NOT NULL DEFAULT 'active',
    "repositoryAccessMode" "SkillMarketplaceRepositoryAccessMode" NOT NULL DEFAULT 'pull_request',
    "forceMergeOrPush" BOOLEAN NOT NULL DEFAULT false,
    "mergeBeforeChecksPass" BOOLEAN NOT NULL DEFAULT false,
    "image" JSONB,
    "providerOverrides" JSONB,
    "version" TEXT,
    "versionHash" TEXT,
    "forceSyncCounter" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT,
    "description" TEXT,
    "slug" TEXT,
    "skillConfigurationOid" BIGINT,
    "destinationOid" BIGINT,
    "resourceTenantOid" BIGINT,
    "resourceGroupOid" BIGINT,
    "organizationOid" BIGINT NOT NULL,
    "projectOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillMarketplace_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SkillMarketplaceRepository" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "skillMarketplaceOid" BIGINT NOT NULL,
    "skillRepositoryOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillMarketplaceRepository_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SkillMergeRequest" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SkillMergeRequestStatus" NOT NULL DEFAULT 'open',
    "direction" "SkillMergeRequestDirection" NOT NULL DEFAULT 'fork_to_upstream',
    "baseStrategy" "SkillMergeRequestBaseStrategy" NOT NULL DEFAULT 'exact',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "mergeError" TEXT,
    "mergeErrorCode" "SkillMergeRequestErrorCode",
    "activePairKey" TEXT,
    "resourceTenantOid" BIGINT,
    "resourceGroupOid" BIGINT,
    "projectOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "sourceSkillOid" BIGINT NOT NULL,
    "targetSkillOid" BIGINT NOT NULL,
    "baseSourceSkillVersionOid" BIGINT,
    "baseTargetSkillVersionOid" BIGINT NOT NULL,
    "requestedSourceSkillVersionOid" BIGINT NOT NULL,
    "requestedTargetSkillVersionOid" BIGINT NOT NULL,
    "preMergeTargetSkillVersionOid" BIGINT,
    "mergedTargetSkillVersionOid" BIGINT,
    "rollbackTargetSkillVersionOid" BIGINT,
    "createdByResourceActorOid" BIGINT,
    "mergeStartedByResourceActorOid" BIGINT,
    "mergedByResourceActorOid" BIGINT,
    "closedByResourceActorOid" BIGINT,
    "rolledBackByResourceActorOid" BIGINT,
    "mergeStartedAt" TIMESTAMP(3),
    "mergedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "rolledBackAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillMergeRequest_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SkillForkSync" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SkillForkSyncStatus" NOT NULL DEFAULT 'pending',
    "activePairKey" TEXT,
    "error" TEXT,
    "resourceTenantOid" BIGINT,
    "resourceGroupOid" BIGINT,
    "projectOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "forkSkillOid" BIGINT NOT NULL,
    "upstreamSkillOid" BIGINT NOT NULL,
    "createdByResourceActorOid" BIGINT,
    "generatedMergeRequestOid" BIGINT,
    "processingStartedAt" TIMESTAMP(3),
    "actionRequiredAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillForkSync_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SkillMergeRequestItem" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "kind" "StoreItemKind" NOT NULL,
    "changeType" "SkillMergeRequestChangeType" NOT NULL,
    "status" "SkillMergeRequestItemStatus" NOT NULL DEFAULT 'unresolved',
    "resolutionType" "SkillMergeRequestResolutionType",
    "conflictReason" TEXT,
    "resolution" JSONB,
    "skillMergeRequestOid" BIGINT NOT NULL,
    "baseFileOid" BIGINT,
    "sourceFileOid" BIGINT,
    "targetFileOid" BIGINT,
    "baseDocumentOid" BIGINT,
    "baseDocumentTitle" TEXT,
    "sourceDocumentOid" BIGINT,
    "sourceDocumentTitle" TEXT,
    "targetDocumentOid" BIGINT,
    "targetDocumentTitle" TEXT,
    "baseDocumentVersionOid" BIGINT,
    "sourceDocumentVersionOid" BIGINT,
    "targetDocumentVersionOid" BIGINT,
    "resolvedByResourceActorOid" BIGINT,
    "resolvedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillMergeRequestItem_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SkillMergeRequestComment" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "path" TEXT,
    "skillMergeRequestOid" BIGINT NOT NULL,
    "skillMergeRequestItemOid" BIGINT,
    "inReplyToCommentOid" BIGINT,
    "resourceActorOid" BIGINT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillMergeRequestComment_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SkillMergeRequestEvent" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "type" "SkillMergeRequestEventType" NOT NULL,
    "errorCode" "SkillMergeRequestErrorCode",
    "errorMessage" TEXT,
    "skillMergeRequestOid" BIGINT NOT NULL,
    "resourceActorOid" BIGINT,
    "commentOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillMergeRequestEvent_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SkillPlugin" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "isManaged" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT,
    "slug" TEXT,
    "image" JSONB,
    "providerOverrides" JSONB,
    "version" TEXT,
    "versionHash" TEXT,
    "description" TEXT,
    "longDescription" TEXT,
    "category" TEXT,
    "skillConfigurationOid" BIGINT,
    "destinationOid" BIGINT,
    "resourceTenantOid" BIGINT,
    "resourceGroupOid" BIGINT,
    "status" "SkillPluginStatus" NOT NULL DEFAULT 'active',
    "organizationOid" BIGINT NOT NULL,
    "projectOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillPlugin_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SkillPluginSync" (
    "oid" INTEGER NOT NULL DEFAULT 0,
    "cursor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillPluginSync_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SkillMarketplacePlugin" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SkillMarketplacePluginStatus" NOT NULL,
    "pluginSlug" TEXT NOT NULL,
    "skillConfigurationOid" BIGINT,
    "skillMarketplaceOid" BIGINT NOT NULL,
    "skillPluginOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillMarketplacePlugin_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SkillPluginRepository" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "skillPluginOid" BIGINT NOT NULL,
    "skillRepositoryOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillPluginRepository_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SkillPluginSkill" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SkillPluginSkillStatus" NOT NULL,
    "pluginSkillSlug" TEXT NOT NULL,
    "clientName" TEXT,
    "clientDescription" TEXT,
    "clientMetadata" JSONB,
    "license" TEXT,
    "compatibility" TEXT,
    "skillConfigurationOid" BIGINT,
    "skillOid" BIGINT NOT NULL,
    "skillPluginOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillPluginSkill_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ManagedSkillPlugin" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "configHash" TEXT NOT NULL,
    "skillOid" BIGINT NOT NULL,
    "skillPluginOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManagedSkillPlugin_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SkillRepository" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "repoId" TEXT NOT NULL,
    "syncCounter" INTEGER NOT NULL DEFAULT 0,
    "resourceTenantOid" BIGINT,
    "resourceGroupOid" BIGINT,
    "projectOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "deletionsAppliedAt" TIMESTAMP(3),
    "lastPropagatedManifestOid" BIGINT,
    "lastPropagatedAt" TIMESTAMP(3),
    "lastDriftCheckAt" TIMESTAMP(3),
    "dismissedManifestSha256" TEXT,
    "repairAttempts" INTEGER NOT NULL DEFAULT 0,
    "nextRepairAt" TIMESTAMP(3),
    "sourceRecoveryLimitWindows" INTEGER NOT NULL DEFAULT 0,
    "sourceRecoveryLimitReachedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillRepository_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Skill" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SkillStatus" NOT NULL DEFAULT 'active',
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "clientName" TEXT,
    "clientDescription" TEXT,
    "clientMetadata" JSONB,
    "license" TEXT,
    "compatibility" TEXT,
    "image" JSONB,
    "storeId" TEXT NOT NULL,
    "skillEntityId" TEXT NOT NULL,
    "ownerType" "SkillOwnerType" NOT NULL DEFAULT 'instance',
    "organizationOid" BIGINT NOT NULL,
    "projectOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "resourceTenantOid" BIGINT,
    "resourceGroupOid" BIGINT,
    "storeOid" BIGINT,
    "parentSkillOid" BIGINT,
    "forkedFromSkillVersionOid" BIGINT,
    "parentSkillTemplateOid" BIGINT,
    "createdByResourceActorOid" BIGINT,
    "createdByOrganizationActorOid" BIGINT,
    "createdByConsumerOid" BIGINT,
    "createdByConsumerProfileOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SkillVersion" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "skillOid" BIGINT NOT NULL,
    "storeVersionOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillVersion_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SkillDestination" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "codeBucketId" TEXT,
    "tag" INTEGER NOT NULL DEFAULT 0,
    "storageMode" "SkillDestinationStorageMode" NOT NULL DEFAULT 'code_bucket',
    "storageModeChangedAt" TIMESTAMP(3),
    "syncRecoveryVersion" INTEGER NOT NULL DEFAULT 0,
    "isDirty" BOOLEAN NOT NULL DEFAULT false,
    "lastTransientChangeAt" TIMESTAMP(3),
    "firstTransientChangeAt" TIMESTAMP(3),
    "shouldFlushAt" TIMESTAMP(3),
    "mustFlushAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "currentManifestOid" BIGINT,

    CONSTRAINT "SkillDestination_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SkillDestinationFile" (
    "oid" BIGSERIAL NOT NULL,
    "destinationOid" BIGINT NOT NULL,
    "path" TEXT NOT NULL,
    "pathBytes" BYTEA,
    "signature" TEXT NOT NULL,
    "itemKey" TEXT,
    "gitBlobSha" TEXT,
    "sha256" TEXT,
    "byteSize" BIGINT,
    "crc32" BIGINT,
    "sourceKind" "SkillDestinationFileSourceKind",
    "sourceKey" TEXT,
    "sourceFileOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillDestinationFile_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SkillDestinationManifest" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "formatVersion" INTEGER NOT NULL,
    "entryCount" INTEGER NOT NULL,
    "totalBytes" BIGINT NOT NULL,
    "destinationOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReferencedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillDestinationManifest_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SkillSyncBlob" (
    "oid" BIGSERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "gitBlobSha" TEXT NOT NULL,
    "crc32" BIGINT NOT NULL,
    "byteSize" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReferencedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillSyncBlob_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SkillDestinationDeletedFile" (
    "oid" BIGSERIAL NOT NULL,
    "destinationOid" BIGINT NOT NULL,
    "path" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillDestinationDeletedFile_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SkillDestinationItem" (
    "oid" BIGSERIAL NOT NULL,
    "cargoOid" BIGINT,
    "destinationOid" BIGINT NOT NULL,
    "skillMarketplaceOid" BIGINT,
    "skillPluginOid" BIGINT,
    "skillOid" BIGINT,
    "hash" TEXT NOT NULL,

    CONSTRAINT "SkillDestinationItem_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SkillDestinationSync" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SkillDestinationSyncStatus" NOT NULL,
    "trigger" "SkillDestinationSyncTrigger" NOT NULL DEFAULT 'automatic',
    "isAtRepoSyncStage" BOOLEAN NOT NULL DEFAULT false,
    "contentVersion" INTEGER NOT NULL DEFAULT 0,
    "storageMode" "SkillDestinationStorageMode" NOT NULL DEFAULT 'code_bucket',
    "allowMassDelete" BOOLEAN NOT NULL DEFAULT false,
    "destinationOid" BIGINT NOT NULL,
    "manifestOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "prName" TEXT,
    "prDescription" TEXT,
    "commitMessage" TEXT,
    "logs" JSONB[] DEFAULT ARRAY[]::JSONB[],

    CONSTRAINT "SkillDestinationSync_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SkillDestinationSyncRepositoryPropagation" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SkillDestinationSyncRepositoryPropagationStatus" NOT NULL,
    "originSyncId" TEXT,
    "repositoryAccessMode" "SkillMarketplaceRepositoryAccessMode" NOT NULL DEFAULT 'pull_request',
    "forceMergeOrPush" BOOLEAN NOT NULL DEFAULT false,
    "mergeBeforeChecksPass" BOOLEAN NOT NULL DEFAULT false,
    "branchName" TEXT NOT NULL,
    "prName" TEXT NOT NULL,
    "prDescription" TEXT,
    "commitMessage" TEXT,
    "errorMessage" TEXT,
    "errorCode" TEXT,
    "endReason" TEXT,
    "errorDetails" JSONB,
    "waitingUntil" TIMESTAMP(3),
    "waitingReason" TEXT,
    "deletionsUpTo" TIMESTAMP(3),
    "previousManifestSha256" TEXT,
    "resultStats" JSONB,
    "manifestOid" BIGINT,
    "skillDestinationSyncOid" BIGINT NOT NULL,
    "skillRepositoryOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "SkillDestinationSyncRepositoryPropagation_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SkillOriginChangeNotificationCursor" (
    "consumer" TEXT NOT NULL,
    "cursor" TEXT,
    "leaseId" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillOriginChangeNotificationCursor_pkey" PRIMARY KEY ("consumer")
);

-- CreateTable
CREATE TABLE "SkillParticipant" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "roles" "SkillParticipantRole"[],
    "skillOid" BIGINT NOT NULL,
    "resourceActorOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillParticipant_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SkillTemplate" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SkillTemplateStatus" NOT NULL DEFAULT 'active',
    "owner" "SkillTemplateOwner" NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "storeId" TEXT,
    "storeTemplateId" TEXT NOT NULL,
    "systemIdentifier" TEXT,
    "storeTemplateOid" BIGINT,
    "resourceTenantOid" BIGINT,
    "resourceGroupOid" BIGINT,
    "organizationOid" BIGINT,
    "projectOid" BIGINT,
    "instanceOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillTemplate_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ResourceTenant" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "image" JSONB,
    "organizationName" TEXT,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResourceTenant_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ResourceGroup" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "type" "ResourceGroupType" NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "resourceTenantOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResourceGroup_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ResourceActor" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "type" "ResourceActorType" NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "resourceTenantOid" BIGINT,
    "projectOid" BIGINT,
    "organizationActorOid" BIGINT,
    "consumerOid" BIGINT,
    "consumerProfileOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResourceActor_pkey" PRIMARY KEY ("oid")
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
    "timezone" TEXT,
    "image" JSONB NOT NULL,
    "passwordHash" TEXT,
    "internalTenantIdentifier" TEXT,
    "cargoTenantId" TEXT,
    "cargoEnvironmentId" TEXT,
    "synthesisTenantId" TEXT,
    "synthesisEnvironmentId" TEXT,
    "resourceTenantOid" BIGINT,
    "resourceGroupOid" BIGINT,
    "globalProfileOid" BIGINT,
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
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "WebDiscovery" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "WebDiscoveryStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "leaseExpiresAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "urlKey" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "registrableDomain" TEXT,
    "title" TEXT,
    "description" TEXT,
    "siteName" TEXT,
    "lang" TEXT,
    "themeColor" TEXT,
    "canonicalUrl" TEXT,
    "image" JSONB,
    "imageWidth" INTEGER,
    "imageHeight" INTEGER,
    "imageSource" TEXT,
    "imageScore" DOUBLE PRECISION,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bestPageOid" BIGINT,

    CONSTRAINT "WebDiscovery_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "WebPage" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "finalUrl" TEXT,
    "httpStatus" INTEGER,
    "contentType" TEXT,
    "bytesRead" INTEGER,
    "errorCode" TEXT,
    "title" TEXT,
    "description" TEXT,
    "siteName" TEXT,
    "lang" TEXT,
    "themeColor" TEXT,
    "canonicalUrl" TEXT,
    "candidates" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebPage_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "EventDeliveryIntent" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "EventDeliveryIntentStatus" NOT NULL DEFAULT 'pending',
    "type" "EventDestinationType" NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "retryStrategy" "EventDeliveryRetryStrategy" NOT NULL,
    "retryMaxAttempts" INTEGER NOT NULL,
    "retryBaseDelaySeconds" INTEGER NOT NULL,
    "retryMaxDelaySeconds" INTEGER NOT NULL,
    "systemEventOid" BIGINT NOT NULL,
    "eventDestinationOid" BIGINT NOT NULL,
    "eventDestinationListenerOid" BIGINT,
    "organizationOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "lastAttemptAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventDeliveryIntent_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "EventDeliveryAttempt" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "EventDeliveryAttemptStatus" NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "isRetryable" BOOLEAN NOT NULL DEFAULT false,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "responseStatusCode" INTEGER,
    "intentOid" BIGINT NOT NULL,
    "organizationOid" BIGINT NOT NULL,
    "detailsJson" JSONB,
    "detailsStorageKey" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventDeliveryAttempt_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "EventDestination" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "EventDestinationStatus" NOT NULL DEFAULT 'active',
    "type" "EventDestinationType" NOT NULL,
    "retryStrategy" "EventDeliveryRetryStrategy" NOT NULL DEFAULT 'exponential',
    "retryMaxAttempts" INTEGER NOT NULL DEFAULT 25,
    "retryBaseDelaySeconds" INTEGER NOT NULL DEFAULT 10,
    "retryMaxDelaySeconds" INTEGER NOT NULL DEFAULT 10800,
    "organizationOid" BIGINT NOT NULL,
    "webhookDestinationOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "EventDestination_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "EventDestinationListener" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "type" "EventDestinationListenerType" NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "eventTypes" TEXT[],
    "callbackId" TEXT,
    "triggers" TEXT[],
    "chatConnectionId" TEXT,
    "providerId" TEXT,
    "eventDestinationOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventDestinationListener_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SystemEvent" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "source" "SystemEventSource" NOT NULL,
    "eventType" TEXT NOT NULL,
    "organizationOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "payloadJson" JSONB,
    "payloadStorageKey" TEXT,
    "callbackEventId" TEXT,
    "callbackId" TEXT,
    "callbackTriggerKey" TEXT,
    "chatEventId" TEXT,
    "chatConnectionId" TEXT,
    "providerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemEvent_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "WebhookDestination" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "method" "WebhookMethod" NOT NULL DEFAULT 'POST',
    "signingSecret" TEXT NOT NULL,
    "organizationOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookDestination_pkey" PRIMARY KEY ("oid")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccessTagPolicy_id_key" ON "AccessTagPolicy"("id");

-- CreateIndex
CREATE UNIQUE INDEX "AccessTagPolicy_organizationOid_systemIdentifier_key" ON "AccessTagPolicy"("organizationOid", "systemIdentifier");

-- CreateIndex
CREATE INDEX "AccessTagEntity_storeOid_idx" ON "AccessTagEntity"("storeOid");

-- CreateIndex
CREATE INDEX "AccessTagEntity_skillMarketplaceOid_idx" ON "AccessTagEntity"("skillMarketplaceOid");

-- CreateIndex
CREATE INDEX "AccessTagEntity_skillPluginOid_idx" ON "AccessTagEntity"("skillPluginOid");

-- CreateIndex
CREATE INDEX "AccessTagEntity_magicMcpTokenOid_idx" ON "AccessTagEntity"("magicMcpTokenOid");

-- CreateIndex
CREATE INDEX "AccessTagEntity_magicMcpServerOid_idx" ON "AccessTagEntity"("magicMcpServerOid");

-- CreateIndex
CREATE INDEX "AccessTagEntity_magicMcpEndpointOid_idx" ON "AccessTagEntity"("magicMcpEndpointOid");

-- CreateIndex
CREATE UNIQUE INDEX "AccessTagEntity_accessTagOid_accessTagPolicyOid_skillOid_key" ON "AccessTagEntity"("accessTagOid", "accessTagPolicyOid", "skillOid");

-- CreateIndex
CREATE UNIQUE INDEX "AccessTagEntity_accessTagOid_accessTagPolicyOid_skillTempla_key" ON "AccessTagEntity"("accessTagOid", "accessTagPolicyOid", "skillTemplateOid");

-- CreateIndex
CREATE UNIQUE INDEX "AccessTagEntity_accessTagOid_accessTagPolicyOid_skillGroupO_key" ON "AccessTagEntity"("accessTagOid", "accessTagPolicyOid", "skillGroupOid");

-- CreateIndex
CREATE UNIQUE INDEX "AccessTagEntity_accessTagOid_accessTagPolicyOid_skillMarket_key" ON "AccessTagEntity"("accessTagOid", "accessTagPolicyOid", "skillMarketplaceOid");

-- CreateIndex
CREATE UNIQUE INDEX "AccessTagEntity_accessTagOid_accessTagPolicyOid_skillPlugin_key" ON "AccessTagEntity"("accessTagOid", "accessTagPolicyOid", "skillPluginOid");

-- CreateIndex
CREATE UNIQUE INDEX "AccessTagEntity_accessTagOid_accessTagPolicyOid_storeOid_key" ON "AccessTagEntity"("accessTagOid", "accessTagPolicyOid", "storeOid");

-- CreateIndex
CREATE UNIQUE INDEX "FineGrainedKey_id_key" ON "FineGrainedKey"("id");

-- CreateIndex
CREATE UNIQUE INDEX "FineGrainedKey_secret_key" ON "FineGrainedKey"("secret");

-- CreateIndex
CREATE INDEX "FineGrainedKey_instanceOid_idx" ON "FineGrainedKey"("instanceOid");

-- CreateIndex
CREATE INDEX "FineGrainedKey_accessTagOid_idx" ON "FineGrainedKey"("accessTagOid");

-- CreateIndex
CREATE INDEX "FineGrainedKey_expiresAt_idx" ON "FineGrainedKey"("expiresAt");

-- CreateIndex
CREATE INDEX "FineGrainedKey_status_idx" ON "FineGrainedKey"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SessionClientSecretReference_id_key" ON "SessionClientSecretReference"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SessionClientSecretReference_sessionId_key" ON "SessionClientSecretReference"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_id_key" ON "Account"("id");

-- CreateIndex
CREATE UNIQUE INDEX "AccountDomain_id_key" ON "AccountDomain"("id");

-- CreateIndex
CREATE UNIQUE INDEX "AccountDomain_domain_key" ON "AccountDomain"("domain");

-- CreateIndex
CREATE INDEX "AccountDomain_accountOid_status_id_idx" ON "AccountDomain"("accountOid", "status", "id");

-- CreateIndex
CREATE INDEX "AccountDomain_status_domain_idx" ON "AccountDomain"("status", "domain");

-- CreateIndex
CREATE UNIQUE INDEX "AccountDomainVerification_id_key" ON "AccountDomainVerification"("id");

-- CreateIndex
CREATE INDEX "AccountDomainVerification_accountDomainOid_type_status_idx" ON "AccountDomainVerification"("accountDomainOid", "type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AccountDomainVerification_accountDomainOid_type_key" ON "AccountDomainVerification"("accountDomainOid", "type");

-- CreateIndex
CREATE UNIQUE INDEX "AccountDomainVerificationStatusChange_id_key" ON "AccountDomainVerificationStatusChange"("id");

-- CreateIndex
CREATE INDEX "AccountDomainVerificationStatusChange_accountDomainVerifica_idx" ON "AccountDomainVerificationStatusChange"("accountDomainVerificationOid", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AccountDomainVerificationStatusChange_accountDomainOid_crea_idx" ON "AccountDomainVerificationStatusChange"("accountDomainOid", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "GlobalProfile_id_key" ON "GlobalProfile"("id");

-- CreateIndex
CREATE UNIQUE INDEX "GlobalProfileEmail_id_key" ON "GlobalProfileEmail"("id");

-- CreateIndex
CREATE UNIQUE INDEX "GlobalProfileEmail_email_key" ON "GlobalProfileEmail"("email");

-- CreateIndex
CREATE UNIQUE INDEX "NamespaceCompartment_id_key" ON "NamespaceCompartment"("id");

-- CreateIndex
CREATE UNIQUE INDEX "NamespaceCompartment_systemIdentifier_key" ON "NamespaceCompartment"("systemIdentifier");

-- CreateIndex
CREATE UNIQUE INDEX "NamespaceCompartment_value_key" ON "NamespaceCompartment"("value");

-- CreateIndex
CREATE UNIQUE INDEX "Namespace_id_key" ON "Namespace"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Namespace_value_compartmentOid_key" ON "Namespace"("value", "compartmentOid");

-- CreateIndex
CREATE UNIQUE INDEX "NamespaceProperty_id_key" ON "NamespaceProperty"("id");

-- CreateIndex
CREATE UNIQUE INDEX "NamespaceProperty_namespaceOid_workspaceOid_key" ON "NamespaceProperty"("namespaceOid", "workspaceOid");

-- CreateIndex
CREATE UNIQUE INDEX "NamespaceProperty_namespaceOid_organizationOid_key" ON "NamespaceProperty"("namespaceOid", "organizationOid");

-- CreateIndex
CREATE UNIQUE INDEX "NamespaceProperty_namespaceOid_portalOid_key" ON "NamespaceProperty"("namespaceOid", "portalOid");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_id_key" ON "Workspace"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_organizationOid_key" ON "Workspace"("organizationOid");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_portalOid_key" ON "Workspace"("portalOid");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_enterpriseId_key" ON "Workspace"("enterpriseId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceProfile_id_key" ON "WorkspaceProfile"("id");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceProfile_organizationMemberOid_key" ON "WorkspaceProfile"("organizationMemberOid");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceProfile_enterpriseMemberId_key" ON "WorkspaceProfile"("enterpriseMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceProfile_consumerProfileOid_key" ON "WorkspaceProfile"("consumerProfileOid");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceProfile_workspaceOid_globalProfileOid_key" ON "WorkspaceProfile"("workspaceOid", "globalProfileOid");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceInvite_id_key" ON "WorkspaceInvite"("id");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceInvite_consumerInviteOid_key" ON "WorkspaceInvite"("consumerInviteOid");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceInvite_organizationInviteOid_key" ON "WorkspaceInvite"("organizationInviteOid");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceInvite_enterpriseInviteId_key" ON "WorkspaceInvite"("enterpriseInviteId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceInvite_workspaceOid_globalProfileOid_key" ON "WorkspaceInvite"("workspaceOid", "globalProfileOid");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceGroup_id_key" ON "WorkspaceGroup"("id");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspacePolicy_id_key" ON "WorkspacePolicy"("id");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspacePolicyAssignment_id_key" ON "WorkspacePolicyAssignment"("id");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspacePolicyAssignment_workspacePolicyOid_workspaceGroup_key" ON "WorkspacePolicyAssignment"("workspacePolicyOid", "workspaceGroupOid");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspacePolicyAssignment_workspacePolicyOid_workspaceProfi_key" ON "WorkspacePolicyAssignment"("workspacePolicyOid", "workspaceProfileOid");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceGroupAssignment_id_key" ON "WorkspaceGroupAssignment"("id");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceGroupAssignment_workspaceGroupOid_workspaceProfile_key" ON "WorkspaceGroupAssignment"("workspaceGroupOid", "workspaceProfileOid");

-- CreateIndex
CREATE UNIQUE INDEX "AuditLog_id_key" ON "AuditLog"("id");

-- CreateIndex
CREATE INDEX "AuditLog_actorType_actorId_recordedAt_idx" ON "AuditLog"("actorType", "actorId", "recordedAt");

-- CreateIndex
CREATE INDEX "AuditLog_resource_action_recordedAt_idx" ON "AuditLog"("resource", "action", "recordedAt");

-- CreateIndex
CREATE INDEX "AuditLog_eventOid_idx" ON "AuditLog"("eventOid");

-- CreateIndex
CREATE INDEX "AuditLog_organizationOid_recordedAt_idx" ON "AuditLog"("organizationOid", "recordedAt");

-- CreateIndex
CREATE INDEX "AuditLog_organizationOid_oid_idx" ON "AuditLog"("organizationOid", "oid");

-- CreateIndex
CREATE INDEX "AuditLog_instanceOid_recordedAt_idx" ON "AuditLog"("instanceOid", "recordedAt");

-- CreateIndex
CREATE INDEX "AuditLog_organizationActorOid_recordedAt_idx" ON "AuditLog"("organizationActorOid", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Event_id_key" ON "Event"("id");

-- CreateIndex
CREATE INDEX "Event_actorType_actorId_recordedAt_idx" ON "Event"("actorType", "actorId", "recordedAt");

-- CreateIndex
CREATE INDEX "Event_resource_action_recordedAt_idx" ON "Event"("resource", "action", "recordedAt");

-- CreateIndex
CREATE INDEX "Event_organizationOid_recordedAt_idx" ON "Event"("organizationOid", "recordedAt");

-- CreateIndex
CREATE INDEX "Event_instanceOid_recordedAt_idx" ON "Event"("instanceOid", "recordedAt");

-- CreateIndex
CREATE INDEX "Event_organizationActorOid_recordedAt_idx" ON "Event"("organizationActorOid", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuditLogStream_id_key" ON "AuditLogStream"("id");

-- CreateIndex
CREATE UNIQUE INDEX "AuditLogStreamEvent_id_key" ON "AuditLogStreamEvent"("id");

-- CreateIndex
CREATE UNIQUE INDEX "AuditLogStreamRun_id_key" ON "AuditLogStreamRun"("id");

-- CreateIndex
CREATE INDEX "AuditLogStreamRun_auditLogStreamOid_createdAt_idx" ON "AuditLogStreamRun"("auditLogStreamOid", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLogStreamRun_status_createdAt_idx" ON "AuditLogStreamRun"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLogStreamRun_batchIdentifier_idx" ON "AuditLogStreamRun"("batchIdentifier");

-- CreateIndex
CREATE UNIQUE INDEX "Cell_identifier_key" ON "Cell"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "CellOrganization_slug_key" ON "CellOrganization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "CellPortal_slug_key" ON "CellPortal"("slug");

-- CreateIndex
CREATE INDEX "CellSkillPlugin_slug_idx" ON "CellSkillPlugin"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerAccess_id_key" ON "ConsumerAccess"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerAccess_consumerGroupOid_providerTemplateOid_key" ON "ConsumerAccess"("consumerGroupOid", "providerTemplateOid");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerAccess_consumerGroupOid_magicMcpServerOid_key" ON "ConsumerAccess"("consumerGroupOid", "magicMcpServerOid");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerAccess_consumerGroupOid_skillOid_key" ON "ConsumerAccess"("consumerGroupOid", "skillOid");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerAccess_consumerGroupOid_skillTemplateOid_key" ON "ConsumerAccess"("consumerGroupOid", "skillTemplateOid");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerAccess_consumerGroupOid_skillGroupOid_key" ON "ConsumerAccess"("consumerGroupOid", "skillGroupOid");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerAccess_consumerGroupOid_skillMarketplaceOid_key" ON "ConsumerAccess"("consumerGroupOid", "skillMarketplaceOid");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerAccess_consumerGroupOid_skillPluginOid_key" ON "ConsumerAccess"("consumerGroupOid", "skillPluginOid");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerAccessListing_id_key" ON "ConsumerAccessListing"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerAccessListing_surfaceOid_providerTemplateOid_key" ON "ConsumerAccessListing"("surfaceOid", "providerTemplateOid");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerAccessListing_surfaceOid_magicMcpServerOid_key" ON "ConsumerAccessListing"("surfaceOid", "magicMcpServerOid");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerAccessListing_surfaceOid_skillOid_key" ON "ConsumerAccessListing"("surfaceOid", "skillOid");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerAccessListing_surfaceOid_skillTemplateOid_key" ON "ConsumerAccessListing"("surfaceOid", "skillTemplateOid");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerAccessListing_surfaceOid_skillGroupOid_key" ON "ConsumerAccessListing"("surfaceOid", "skillGroupOid");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerAccessListing_surfaceOid_skillMarketplaceOid_key" ON "ConsumerAccessListing"("surfaceOid", "skillMarketplaceOid");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerAccessListing_surfaceOid_skillPluginOid_key" ON "ConsumerAccessListing"("surfaceOid", "skillPluginOid");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerAccessRequest_id_key" ON "ConsumerAccessRequest"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerAccessRequest_pendingKey_key" ON "ConsumerAccessRequest"("pendingKey");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerActor_id_key" ON "ConsumerActor"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerActor_identityActorOid_key" ON "ConsumerActor"("identityActorOid");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerActor_defaultForInstanceConsumerOid_key" ON "ConsumerActor"("defaultForInstanceConsumerOid");

-- CreateIndex
CREATE INDEX "ConsumerActor_defaultIdentityId_idx" ON "ConsumerActor"("defaultIdentityId");

-- CreateIndex
CREATE INDEX "ConsumerActor_instanceConsumerOid_idx" ON "ConsumerActor"("instanceConsumerOid");

-- CreateIndex
CREATE INDEX "ConsumerActor_consumerProfileOid_idx" ON "ConsumerActor"("consumerProfileOid");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerSession_id_key" ON "ConsumerSession"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerSession_tokenNonce_key" ON "ConsumerSession"("tokenNonce");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerSession_oauthAuthorizationOid_key" ON "ConsumerSession"("oauthAuthorizationOid");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerSession_consumerProfileOid_authSessionId_key" ON "ConsumerSession"("consumerProfileOid", "authSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerAuthExchange_id_key" ON "ConsumerAuthExchange"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerAuthExchange_surfaceOid_state_key" ON "ConsumerAuthExchange"("surfaceOid", "state");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerProviderSetupSessionBinding_id_key" ON "ConsumerProviderSetupSessionBinding"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerProviderSetupSessionBinding_instanceOid_providerSet_key" ON "ConsumerProviderSetupSessionBinding"("instanceOid", "providerSetupSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Consumer_id_key" ON "Consumer"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Consumer_email_organizationOid_key" ON "Consumer"("email", "organizationOid");

-- CreateIndex
CREATE UNIQUE INDEX "InstanceConsumer_id_key" ON "InstanceConsumer"("id");

-- CreateIndex
CREATE UNIQUE INDEX "InstanceConsumer_instanceOid_consumerOid_key" ON "InstanceConsumer"("instanceOid", "consumerOid");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerProfile_id_key" ON "ConsumerProfile"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerProfile_accessTagOid_key" ON "ConsumerProfile"("accessTagOid");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerProfile_organizationActorOid_key" ON "ConsumerProfile"("organizationActorOid");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerProfile_personalConsumerGroupOid_key" ON "ConsumerProfile"("personalConsumerGroupOid");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerProfile_surfaceOid_aresUserId_key" ON "ConsumerProfile"("surfaceOid", "aresUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerProfile_email_surfaceOid_key" ON "ConsumerProfile"("email", "surfaceOid");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerInvite_id_key" ON "ConsumerInvite"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerInvite_consumerProfileOid_key" ON "ConsumerInvite"("consumerProfileOid");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerInvite_surfaceOid_consumerOid_key" ON "ConsumerInvite"("surfaceOid", "consumerOid");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerProfileGroup_profileOid_groupOid_key" ON "ConsumerProfileGroup"("profileOid", "groupOid");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerOrganizationActor_consumerOid_organizationActorOid_key" ON "ConsumerOrganizationActor"("consumerOid", "organizationActorOid");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerClient_id_key" ON "ConsumerClient"("id");

-- CreateIndex
CREATE INDEX "ConsumerClient_hash_idx" ON "ConsumerClient"("hash");

-- CreateIndex
CREATE INDEX "ConsumerClient_logoReconciledAt_id_idx" ON "ConsumerClient"("logoReconciledAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerAuthClient_id_key" ON "ConsumerAuthClient"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerAuthClient_clientId_key" ON "ConsumerAuthClient"("clientId");

-- CreateIndex
CREATE INDEX "ConsumerAuthClient_registrationIp_createdAt_idx" ON "ConsumerAuthClient"("registrationIp", "createdAt");

-- CreateIndex
CREATE INDEX "ConsumerAuthClient_instanceOid_idx" ON "ConsumerAuthClient"("instanceOid");

-- CreateIndex
CREATE INDEX "ConsumerAuthClient_organizationOid_idx" ON "ConsumerAuthClient"("organizationOid");

-- CreateIndex
CREATE INDEX "ConsumerAuthClient_skillPluginOid_idx" ON "ConsumerAuthClient"("skillPluginOid");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerAuthClientSurface_id_key" ON "ConsumerAuthClientSurface"("id");

-- CreateIndex
CREATE INDEX "ConsumerAuthClientSurface_consumerAuthClientOid_idx" ON "ConsumerAuthClientSurface"("consumerAuthClientOid");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerAuthClientSurface_consumerSurfaceOid_consumerAuthCl_key" ON "ConsumerAuthClientSurface"("consumerSurfaceOid", "consumerAuthClientOid");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerAuthClientSurface_consumerAuthClientOid_consumerCli_key" ON "ConsumerAuthClientSurface"("consumerAuthClientOid", "consumerClientOid");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerAuthAttempt_id_key" ON "ConsumerAuthAttempt"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerAuthAttempt_authorizationCode_key" ON "ConsumerAuthAttempt"("authorizationCode");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerAuthAttempt_refreshToken_key" ON "ConsumerAuthAttempt"("refreshToken");

-- CreateIndex
CREATE INDEX "ConsumerAuthAttempt_consumerIntegrationEndpointOid_idx" ON "ConsumerAuthAttempt"("consumerIntegrationEndpointOid");

-- CreateIndex
CREATE INDEX "ConsumerAuthAttempt_skillPluginOid_idx" ON "ConsumerAuthAttempt"("skillPluginOid");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerAuthTestAuthorization_id_key" ON "ConsumerAuthTestAuthorization"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerAuthTestAuthorization_consumerAuthAttemptOid_key" ON "ConsumerAuthTestAuthorization"("consumerAuthAttemptOid");

-- CreateIndex
CREATE INDEX "ConsumerAuthTestAuthorization_consumerAuthClientOid_idx" ON "ConsumerAuthTestAuthorization"("consumerAuthClientOid");

-- CreateIndex
CREATE INDEX "ConsumerAuthTestAuthorization_consumerSurfaceOid_createdAt_idx" ON "ConsumerAuthTestAuthorization"("consumerSurfaceOid", "createdAt");

-- CreateIndex
CREATE INDEX "ConsumerAuthTestAuthorization_instanceOid_createdAt_idx" ON "ConsumerAuthTestAuthorization"("instanceOid", "createdAt");

-- CreateIndex
CREATE INDEX "ConsumerAuthTestAuthorization_expiresAt_idx" ON "ConsumerAuthTestAuthorization"("expiresAt");

-- CreateIndex
CREATE INDEX "ConsumerAuthTestAuthorization_consumedAt_idx" ON "ConsumerAuthTestAuthorization"("consumedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerGroup_id_key" ON "ConsumerGroup"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerGroup_accessTagOid_key" ON "ConsumerGroup"("accessTagOid");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerToken_id_key" ON "ConsumerToken"("id");

-- CreateIndex
CREATE INDEX "ConsumerToken_magicMcpTokenOid_idx" ON "ConsumerToken"("magicMcpTokenOid");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerToken_consumerProfileOid_magicMcpTokenOid_key" ON "ConsumerToken"("consumerProfileOid", "magicMcpTokenOid");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerIntegration_id_key" ON "ConsumerIntegration"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerIntegration_consumerProfileOid_magicMcpServerOid_key" ON "ConsumerIntegration"("consumerProfileOid", "magicMcpServerOid");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerIntegrationEndpoint_id_key" ON "ConsumerIntegrationEndpoint"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerIntegrationEndpoint_consumerProfileOid_magicMcpEndp_key" ON "ConsumerIntegrationEndpoint"("consumerProfileOid", "magicMcpEndpointOid");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerIntegrationSession_id_key" ON "ConsumerIntegrationSession"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerIntegrationSession_consumerIntegrationOid_magicMcpS_key" ON "ConsumerIntegrationSession"("consumerIntegrationOid", "magicMcpSessionOid");

-- CreateIndex
CREATE UNIQUE INDEX "Portal_id_key" ON "Portal"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Portal_slug_key" ON "Portal"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Portal_surfaceOid_key" ON "Portal"("surfaceOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderTemplate_id_key" ON "ProviderTemplate"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderTemplate_instanceOid_providerDeploymentId_key" ON "ProviderTemplate"("instanceOid", "providerDeploymentId");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderTemplate_instanceOid_subspaceIntegrationId_key" ON "ProviderTemplate"("instanceOid", "subspaceIntegrationId");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerSkill_id_key" ON "ConsumerSkill"("id");

-- CreateIndex
CREATE INDEX "ConsumerSkill_skillOid_idx" ON "ConsumerSkill"("skillOid");

-- CreateIndex
CREATE INDEX "ConsumerSkill_instanceOid_consumerOid_idx" ON "ConsumerSkill"("instanceOid", "consumerOid");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerSkill_consumerProfileOid_skillOid_key" ON "ConsumerSkill"("consumerProfileOid", "skillOid");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerSurface_id_key" ON "ConsumerSurface"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerSurface_publishableApiKeyOid_key" ON "ConsumerSurface"("publishableApiKeyOid");

-- CreateIndex
CREATE INDEX "ConsumerSurface_skillConfigurationId_idx" ON "ConsumerSurface"("skillConfigurationId");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerSurface_instanceOid_internalSurfaceUniqueIdentifier_key" ON "ConsumerSurface"("instanceOid", "internalSurfaceUniqueIdentifier");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerSurfaceProviderGroup_id_key" ON "ConsumerSurfaceProviderGroup"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerSurfaceProviderGroupListing_consumerSurfaceProvider_key" ON "ConsumerSurfaceProviderGroupListing"("consumerSurfaceProviderGroupOid", "consumerAccessListingOid");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerAuthTenant_id_key" ON "ConsumerAuthTenant"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerAuthTenant_aresAppId_key" ON "ConsumerAuthTenant"("aresAppId");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerAuthTenant_aresAppSlug_key" ON "ConsumerAuthTenant"("aresAppSlug");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerAuthTenant_aresClientId_key" ON "ConsumerAuthTenant"("aresClientId");

-- CreateIndex
CREATE INDEX "UsageMetric_ts_idx" ON "UsageMetric"("ts");

-- CreateIndex
CREATE INDEX "UsageMetric_instanceId_kind_ts_idx" ON "UsageMetric"("instanceId", "kind", "ts");

-- CreateIndex
CREATE INDEX "UsageMetric_instanceId_kind_providerId_ts_idx" ON "UsageMetric"("instanceId", "kind", "providerId", "ts");

-- CreateIndex
CREATE INDEX "UsageMetric_instanceId_kind_consumerId_ts_idx" ON "UsageMetric"("instanceId", "kind", "consumerId", "ts");

-- CreateIndex
CREATE INDEX "UsageMetric_instanceId_kind_consumerProfileId_ts_idx" ON "UsageMetric"("instanceId", "kind", "consumerProfileId", "ts");

-- CreateIndex
CREATE INDEX "UsageMetric_instanceId_kind_magicMcpServerId_ts_idx" ON "UsageMetric"("instanceId", "kind", "magicMcpServerId", "ts");

-- CreateIndex
CREATE INDEX "UsageMetric_instanceId_kind_integrationId_ts_idx" ON "UsageMetric"("instanceId", "kind", "integrationId", "ts");

-- CreateIndex
CREATE UNIQUE INDEX "EmailIdentity_id_key" ON "EmailIdentity"("id");

-- CreateIndex
CREATE UNIQUE INDEX "EmailIdentity_slug_key" ON "EmailIdentity"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentContent_cargoOid_key" ON "DocumentContent"("cargoOid");

-- CreateIndex
CREATE UNIQUE INDEX "Document_id_key" ON "Document"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Document_fileOid_key" ON "Document"("fileOid");

-- CreateIndex
CREATE INDEX "Document_resourceTenantOid_resourceGroupOid_idx" ON "Document"("resourceTenantOid", "resourceGroupOid");

-- CreateIndex
CREATE INDEX "Document_resourceTenantOid_resourceGroupOid_isTemplateBacki_idx" ON "Document"("resourceTenantOid", "resourceGroupOid", "isTemplateBacking");

-- CreateIndex
CREATE INDEX "Document_instanceOid_idx" ON "Document"("instanceOid");

-- CreateIndex
CREATE INDEX "Document_instanceOid_isTemplateBacking_idx" ON "Document"("instanceOid", "isTemplateBacking");

-- CreateIndex
CREATE INDEX "Document_isContentOwner_idx" ON "Document"("isContentOwner");

-- CreateIndex
CREATE INDEX "Document_draftVersionExpiresAt_idx" ON "Document"("draftVersionExpiresAt");

-- CreateIndex
CREATE INDEX "Document_contentOid_idx" ON "Document"("contentOid");

-- CreateIndex
CREATE INDEX "Document_currentVersionOid_idx" ON "Document"("currentVersionOid");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentParticipant_id_key" ON "DocumentParticipant"("id");

-- CreateIndex
CREATE INDEX "DocumentParticipant_storeParticipantOid_idx" ON "DocumentParticipant"("storeParticipantOid");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentParticipant_documentOid_resourceActorOid_key" ON "DocumentParticipant"("documentOid", "resourceActorOid");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentVersion_id_key" ON "DocumentVersion"("id");

-- CreateIndex
CREATE INDEX "DocumentVersion_documentOid_idx" ON "DocumentVersion"("documentOid");

-- CreateIndex
CREATE INDEX "DocumentVersion_contentOid_idx" ON "DocumentVersion"("contentOid");

-- CreateIndex
CREATE INDEX "DocumentVersion_previousVersionOid_idx" ON "DocumentVersion"("previousVersionOid");

-- CreateIndex
CREATE INDEX "DocumentVersion_createdAt_idx" ON "DocumentVersion"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentVersion_resourceTenantOid_resourceGroupOid_document_key" ON "DocumentVersion"("resourceTenantOid", "resourceGroupOid", "documentOid", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentVersion_instanceOid_documentOid_versionNumber_key" ON "DocumentVersion"("instanceOid", "documentOid", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentVersionEditors_id_key" ON "DocumentVersionEditors"("id");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentVersionEditors_documentVersionOid_resourceActorOid_key" ON "DocumentVersionEditors"("documentVersionOid", "resourceActorOid");

-- CreateIndex
CREATE UNIQUE INDEX "FilePurpose_id_key" ON "FilePurpose"("id");

-- CreateIndex
CREATE UNIQUE INDEX "FilePurpose_slug_key" ON "FilePurpose"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "File_id_key" ON "File"("id");

-- CreateIndex
CREATE INDEX "File_storeId_status_idx" ON "File"("storeId", "status");

-- CreateIndex
CREATE INDEX "File_status_expiresAt_oid_idx" ON "File"("status", "expiresAt", "oid");

-- CreateIndex
CREATE INDEX "File_delegatedContentUrlExpiresAt_idx" ON "File"("delegatedContentUrlExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "FileContentDelegator_id_key" ON "FileContentDelegator"("id");

-- CreateIndex
CREATE UNIQUE INDEX "FileContentDelegator_key_key" ON "FileContentDelegator"("key");

-- CreateIndex
CREATE UNIQUE INDEX "FilePendingContent_fileOid_key" ON "FilePendingContent"("fileOid");

-- CreateIndex
CREATE INDEX "FilePendingContent_flushAfter_idx" ON "FilePendingContent"("flushAfter");

-- CreateIndex
CREATE UNIQUE INDEX "FileLink_id_key" ON "FileLink"("id");

-- CreateIndex
CREATE UNIQUE INDEX "FileLink_key_key" ON "FileLink"("key");

-- CreateIndex
CREATE UNIQUE INDEX "FileReference_id_key" ON "FileReference"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Store_id_key" ON "Store"("id");

-- CreateIndex
CREATE INDEX "Store_resourceTenantOid_resourceGroupOid_dirtyAt_idx" ON "Store"("resourceTenantOid", "resourceGroupOid", "dirtyAt");

-- CreateIndex
CREATE INDEX "Store_resourceTenantOid_resourceGroupOid_isTemplateBacking_idx" ON "Store"("resourceTenantOid", "resourceGroupOid", "isTemplateBacking");

-- CreateIndex
CREATE INDEX "Store_instanceOid_dirtyAt_idx" ON "Store"("instanceOid", "dirtyAt");

-- CreateIndex
CREATE INDEX "Store_instanceOid_isTemplateBacking_idx" ON "Store"("instanceOid", "isTemplateBacking");

-- CreateIndex
CREATE UNIQUE INDEX "StoreTemplate_id_key" ON "StoreTemplate"("id");

-- CreateIndex
CREATE INDEX "StoreTemplate_resourceTenantOid_resourceGroupOid_idx" ON "StoreTemplate"("resourceTenantOid", "resourceGroupOid");

-- CreateIndex
CREATE INDEX "StoreTemplate_projectOid_instanceOid_idx" ON "StoreTemplate"("projectOid", "instanceOid");

-- CreateIndex
CREATE INDEX "StoreTemplate_sourceStoreOid_idx" ON "StoreTemplate"("sourceStoreOid");

-- CreateIndex
CREATE INDEX "StoreTemplate_hash_idx" ON "StoreTemplate"("hash");

-- CreateIndex
CREATE UNIQUE INDEX "StoreTemplateItem_id_key" ON "StoreTemplateItem"("id");

-- CreateIndex
CREATE INDEX "StoreTemplateItem_storeTemplateOid_hash_idx" ON "StoreTemplateItem"("storeTemplateOid", "hash");

-- CreateIndex
CREATE UNIQUE INDEX "StoreTemplateItem_storeTemplateOid_path_key" ON "StoreTemplateItem"("storeTemplateOid", "path");

-- CreateIndex
CREATE UNIQUE INDEX "StoreTemplateBacking_id_key" ON "StoreTemplateBacking"("id");

-- CreateIndex
CREATE UNIQUE INDEX "StoreTemplateBacking_storeOid_key" ON "StoreTemplateBacking"("storeOid");

-- CreateIndex
CREATE INDEX "StoreTemplateBacking_resourceTenantOid_resourceGroupOid_idx" ON "StoreTemplateBacking"("resourceTenantOid", "resourceGroupOid");

-- CreateIndex
CREATE INDEX "StoreTemplateBacking_instanceOid_idx" ON "StoreTemplateBacking"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "StoreTemplateBacking_storeTemplateOid_resourceTenantOid_res_key" ON "StoreTemplateBacking"("storeTemplateOid", "resourceTenantOid", "resourceGroupOid");

-- CreateIndex
CREATE UNIQUE INDEX "StoreTemplateBacking_storeTemplateOid_instanceOid_key" ON "StoreTemplateBacking"("storeTemplateOid", "instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "StoreItem_id_key" ON "StoreItem"("id");

-- CreateIndex
CREATE INDEX "StoreItem_parentDirectoryOid_idx" ON "StoreItem"("parentDirectoryOid");

-- CreateIndex
CREATE INDEX "StoreItem_documentOid_idx" ON "StoreItem"("documentOid");

-- CreateIndex
CREATE UNIQUE INDEX "StoreItem_storeOid_path_key" ON "StoreItem"("storeOid", "path");

-- CreateIndex
CREATE UNIQUE INDEX "StoreItem_directoryOid_key" ON "StoreItem"("directoryOid");

-- CreateIndex
CREATE UNIQUE INDEX "StoreVersion_id_key" ON "StoreVersion"("id");

-- CreateIndex
CREATE INDEX "StoreVersion_storeOid_createdAt_idx" ON "StoreVersion"("storeOid", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StoreVersion_storeOid_versionNumber_key" ON "StoreVersion"("storeOid", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "StoreVersion_storeOid_sourceDirtyAt_key" ON "StoreVersion"("storeOid", "sourceDirtyAt");

-- CreateIndex
CREATE UNIQUE INDEX "StoreVersionItem_id_key" ON "StoreVersionItem"("id");

-- CreateIndex
CREATE INDEX "StoreVersionItem_fileOid_idx" ON "StoreVersionItem"("fileOid");

-- CreateIndex
CREATE INDEX "StoreVersionItem_documentOid_idx" ON "StoreVersionItem"("documentOid");

-- CreateIndex
CREATE INDEX "StoreVersionItem_documentVersionOid_idx" ON "StoreVersionItem"("documentVersionOid");

-- CreateIndex
CREATE UNIQUE INDEX "StoreVersionItem_storeVersionOid_path_key" ON "StoreVersionItem"("storeVersionOid", "path");

-- CreateIndex
CREATE UNIQUE INDEX "StoreParticipantPrincipal_id_key" ON "StoreParticipantPrincipal"("id");

-- CreateIndex
CREATE INDEX "StoreParticipantPrincipal_consumerOid_idx" ON "StoreParticipantPrincipal"("consumerOid");

-- CreateIndex
CREATE INDEX "StoreParticipantPrincipal_primaryResourceActorOid_idx" ON "StoreParticipantPrincipal"("primaryResourceActorOid");

-- CreateIndex
CREATE UNIQUE INDEX "StoreParticipantPrincipal_storeOid_consumerOid_key" ON "StoreParticipantPrincipal"("storeOid", "consumerOid");

-- CreateIndex
CREATE UNIQUE INDEX "StoreParticipantPrincipal_storeOid_primaryResourceActorOid_key" ON "StoreParticipantPrincipal"("storeOid", "primaryResourceActorOid");

-- CreateIndex
CREATE UNIQUE INDEX "StoreParticipant_id_key" ON "StoreParticipant"("id");

-- CreateIndex
CREATE INDEX "StoreParticipant_storeParticipantOid_idx" ON "StoreParticipant"("storeParticipantOid");

-- CreateIndex
CREATE UNIQUE INDEX "StoreParticipant_storeOid_resourceActorOid_key" ON "StoreParticipant"("storeOid", "resourceActorOid");

-- CreateIndex
CREATE UNIQUE INDEX "StoreDirectory_id_key" ON "StoreDirectory"("id");

-- CreateIndex
CREATE UNIQUE INDEX "StoreDirectory_storeOid_path_key" ON "StoreDirectory"("storeOid", "path");

-- CreateIndex
CREATE UNIQUE INDEX "FileUpload_id_key" ON "FileUpload"("id");

-- CreateIndex
CREATE UNIQUE INDEX "FileUpload_storeId_key" ON "FileUpload"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "FileUpload_fileOid_key" ON "FileUpload"("fileOid");

-- CreateIndex
CREATE INDEX "FileUpload_status_expiresAt_oid_idx" ON "FileUpload"("status", "expiresAt", "oid");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityActor_id_key" ON "IdentityActor"("id");

-- CreateIndex
CREATE INDEX "IdentityActor_organizationOid_idx" ON "IdentityActor"("organizationOid");

-- CreateIndex
CREATE INDEX "IdentityActor_projectOid_idx" ON "IdentityActor"("projectOid");

-- CreateIndex
CREATE INDEX "IdentityActor_instanceOid_idx" ON "IdentityActor"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_id_key" ON "Agent"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_actorOid_key" ON "Agent"("actorOid");

-- CreateIndex
CREATE INDEX "Agent_organizationOid_idx" ON "Agent"("organizationOid");

-- CreateIndex
CREATE INDEX "Agent_projectOid_idx" ON "Agent"("projectOid");

-- CreateIndex
CREATE INDEX "Agent_instanceOid_idx" ON "Agent"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "AgentClient_id_key" ON "AgentClient"("id");

-- CreateIndex
CREATE INDEX "AgentClient_organizationOid_idx" ON "AgentClient"("organizationOid");

-- CreateIndex
CREATE INDEX "AgentClient_projectOid_idx" ON "AgentClient"("projectOid");

-- CreateIndex
CREATE INDEX "AgentClient_instanceOid_idx" ON "AgentClient"("instanceOid");

-- CreateIndex
CREATE INDEX "AgentClient_consumerClientOid_idx" ON "AgentClient"("consumerClientOid");

-- CreateIndex
CREATE UNIQUE INDEX "AgentClientRegistration_id_key" ON "AgentClientRegistration"("id");

-- CreateIndex
CREATE UNIQUE INDEX "AgentClientRegistration_consumerAuthClientOid_key" ON "AgentClientRegistration"("consumerAuthClientOid");

-- CreateIndex
CREATE INDEX "AgentClientRegistration_agentClientOid_idx" ON "AgentClientRegistration"("agentClientOid");

-- CreateIndex
CREATE UNIQUE INDEX "AgentInstance_id_key" ON "AgentInstance"("id");

-- CreateIndex
CREATE INDEX "AgentInstance_agentClientOid_idx" ON "AgentInstance"("agentClientOid");

-- CreateIndex
CREATE INDEX "AgentInstance_agentClientRegistrationOid_idx" ON "AgentInstance"("agentClientRegistrationOid");

-- CreateIndex
CREATE UNIQUE INDEX "AgentInstance_agentOid_hash_key" ON "AgentInstance"("agentOid", "hash");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKeySecret_id_key" ON "ApiKeySecret"("id");

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
CREATE UNIQUE INDEX "CliDevice_id_key" ON "CliDevice"("id");

-- CreateIndex
CREATE UNIQUE INDEX "CliDevice_ip_userOid_organizationOid_key" ON "CliDevice"("ip", "userOid", "organizationOid");

-- CreateIndex
CREATE UNIQUE INDEX "MachineAccess_id_key" ON "MachineAccess"("id");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthApplication_id_key" ON "OAuthApplication"("id");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthApplication_clientId_key" ON "OAuthApplication"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthApplication_organizationOid_systemIdentifier_key" ON "OAuthApplication"("organizationOid", "systemIdentifier");

-- CreateIndex
CREATE UNIQUE INDEX "InternalOAuthToken_id_key" ON "InternalOAuthToken"("id");

-- CreateIndex
CREATE UNIQUE INDEX "InternalOAuthToken_cacheKeyHash_key" ON "InternalOAuthToken"("cacheKeyHash");

-- CreateIndex
CREATE UNIQUE INDEX "InternalOAuthToken_oauthAuthorizationOid_key" ON "InternalOAuthToken"("oauthAuthorizationOid");

-- CreateIndex
CREATE UNIQUE INDEX "InternalOAuthToken_oauthTokenOid_key" ON "InternalOAuthToken"("oauthTokenOid");

-- CreateIndex
CREATE INDEX "InternalOAuthToken_oauthApplicationOid_organizationOid_idx" ON "InternalOAuthToken"("oauthApplicationOid", "organizationOid");

-- CreateIndex
CREATE INDEX "InternalOAuthToken_expiresAt_idx" ON "InternalOAuthToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthApplicationClientSecret_id_key" ON "OAuthApplicationClientSecret"("id");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthApplicationClientSecret_secret_key" ON "OAuthApplicationClientSecret"("secret");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthInstallation_id_key" ON "OAuthInstallation"("id");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthInstallation_oauthApplicationOid_organizationOid_key" ON "OAuthInstallation"("oauthApplicationOid", "organizationOid");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthAuthorization_id_key" ON "OAuthAuthorization"("id");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthAuthorization_organizationMemberOid_oauthApplicationOi_key" ON "OAuthAuthorization"("organizationMemberOid", "oauthApplicationOid");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthAuthorization_consumerProfileOid_oauthApplicationOid_key" ON "OAuthAuthorization"("consumerProfileOid", "oauthApplicationOid");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthAuthorizationFlow_id_key" ON "OAuthAuthorizationFlow"("id");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthToken_id_key" ON "OAuthToken"("id");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthToken_accessToken_key" ON "OAuthToken"("accessToken");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthToken_refreshToken_key" ON "OAuthToken"("refreshToken");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceAccount_id_key" ON "ServiceAccount"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceAccount_oauthApplicationOid_key" ON "ServiceAccount"("oauthApplicationOid");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceAccount_consumerProfileOid_key" ON "ServiceAccount"("consumerProfileOid");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceAccountCredential_id_key" ON "ServiceAccountCredential"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceAccountCredential_oauthAuthorizationOid_key" ON "ServiceAccountCredential"("oauthAuthorizationOid");

-- CreateIndex
CREATE UNIQUE INDEX "MagicMcpEndpoint_id_key" ON "MagicMcpEndpoint"("id");

-- CreateIndex
CREATE UNIQUE INDEX "MagicMcpEndpoint_slug_key" ON "MagicMcpEndpoint"("slug");

-- CreateIndex
CREATE INDEX "MagicMcpEndpoint_instanceOid_status_idx" ON "MagicMcpEndpoint"("instanceOid", "status");

-- CreateIndex
CREATE INDEX "MagicMcpEndpoint_subspaceSessionTemplateId_idx" ON "MagicMcpEndpoint"("subspaceSessionTemplateId");

-- CreateIndex
CREATE INDEX "MagicMcpEndpoint_ownerActorOid_idx" ON "MagicMcpEndpoint"("ownerActorOid");

-- CreateIndex
CREATE UNIQUE INDEX "MagicMcpEndpointServer_id_key" ON "MagicMcpEndpointServer"("id");

-- CreateIndex
CREATE UNIQUE INDEX "MagicMcpEndpointServer_magicMcpEndpointOid_magicMcpServerOi_key" ON "MagicMcpEndpointServer"("magicMcpEndpointOid", "magicMcpServerOid");

-- CreateIndex
CREATE UNIQUE INDEX "MagicMcpEndpointSkillSelection_id_key" ON "MagicMcpEndpointSkillSelection"("id");

-- CreateIndex
CREATE INDEX "MagicMcpEndpointSkillSelection_skillOid_idx" ON "MagicMcpEndpointSkillSelection"("skillOid");

-- CreateIndex
CREATE INDEX "MagicMcpEndpointSkillSelection_skillGroupOid_idx" ON "MagicMcpEndpointSkillSelection"("skillGroupOid");

-- CreateIndex
CREATE UNIQUE INDEX "MagicMcpEndpointSkillSelection_magicMcpEndpointOid_skillOid_key" ON "MagicMcpEndpointSkillSelection"("magicMcpEndpointOid", "skillOid");

-- CreateIndex
CREATE UNIQUE INDEX "MagicMcpEndpointSkillSelection_magicMcpEndpointOid_skillGro_key" ON "MagicMcpEndpointSkillSelection"("magicMcpEndpointOid", "skillGroupOid");

-- CreateIndex
CREATE UNIQUE INDEX "MagicMcpGroup_id_key" ON "MagicMcpGroup"("id");

-- CreateIndex
CREATE UNIQUE INDEX "MagicMcpGroup_slug_key" ON "MagicMcpGroup"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "MagicMcpGroupServer_magicMcpGroupOid_magicMcpServerOid_key" ON "MagicMcpGroupServer"("magicMcpGroupOid", "magicMcpServerOid");

-- CreateIndex
CREATE INDEX "MagicMcpGroupToken_magicMcpTokenOid_idx" ON "MagicMcpGroupToken"("magicMcpTokenOid");

-- CreateIndex
CREATE UNIQUE INDEX "MagicMcpGroupToken_magicMcpGroupOid_magicMcpTokenOid_key" ON "MagicMcpGroupToken"("magicMcpGroupOid", "magicMcpTokenOid");

-- CreateIndex
CREATE UNIQUE INDEX "MagicMcpServer_id_key" ON "MagicMcpServer"("id");

-- CreateIndex
CREATE INDEX "MagicMcpServer_ownerActorOid_idx" ON "MagicMcpServer"("ownerActorOid");

-- CreateIndex
CREATE INDEX "MagicMcpServer_instanceOid_status_idx" ON "MagicMcpServer"("instanceOid", "status");

-- CreateIndex
CREATE INDEX "MagicMcpServer_subspaceSessionTemplateId_idx" ON "MagicMcpServer"("subspaceSessionTemplateId");

-- CreateIndex
CREATE UNIQUE INDEX "MagicMcpServerAlias_slug_key" ON "MagicMcpServerAlias"("slug");

-- CreateIndex
CREATE INDEX "MagicMcpServerAlias_serverOid_idx" ON "MagicMcpServerAlias"("serverOid");

-- CreateIndex
CREATE UNIQUE INDEX "MagicMcpServerSubspaceSession_id_key" ON "MagicMcpServerSubspaceSession"("id");

-- CreateIndex
CREATE UNIQUE INDEX "MagicMcpServerSubspaceSession_magicMcpServerOid_key" ON "MagicMcpServerSubspaceSession"("magicMcpServerOid");

-- CreateIndex
CREATE UNIQUE INDEX "MagicMcpServerSubspaceSession_magicMcpEndpointOid_key" ON "MagicMcpServerSubspaceSession"("magicMcpEndpointOid");

-- CreateIndex
CREATE INDEX "MagicMcpServerSubspaceSession_subspaceSessionId_idx" ON "MagicMcpServerSubspaceSession"("subspaceSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "MagicMcpToken_id_key" ON "MagicMcpToken"("id");

-- CreateIndex
CREATE UNIQUE INDEX "MagicMcpToken_secret_key" ON "MagicMcpToken"("secret");

-- CreateIndex
CREATE INDEX "MagicMcpTokenUse_magicMcpServerOid_idx" ON "MagicMcpTokenUse"("magicMcpServerOid");

-- CreateIndex
CREATE INDEX "MagicMcpTokenUse_magicMcpEndpointOid_idx" ON "MagicMcpTokenUse"("magicMcpEndpointOid");

-- CreateIndex
CREATE INDEX "MagicMcpTokenUse_hour_idx" ON "MagicMcpTokenUse"("hour");

-- CreateIndex
CREATE UNIQUE INDEX "MagicMcpTokenUse_magicMcpTokenOid_magicMcpTarget_ip_ua_hour_key" ON "MagicMcpTokenUse"("magicMcpTokenOid", "magicMcpTarget", "ip", "ua", "hour");

-- CreateIndex
CREATE UNIQUE INDEX "Firewall_id_key" ON "Firewall"("id");

-- CreateIndex
CREATE INDEX "Firewall_instanceOid_status_idx" ON "Firewall"("instanceOid", "status");

-- CreateIndex
CREATE INDEX "Firewall_needsSubspaceSync_oid_idx" ON "Firewall"("needsSubspaceSync", "oid");

-- CreateIndex
CREATE UNIQUE INDEX "Firewall_instanceOid_slug_key" ON "Firewall"("instanceOid", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "FirewallNetworkPolicy_id_key" ON "FirewallNetworkPolicy"("id");

-- CreateIndex
CREATE INDEX "FirewallNetworkPolicy_networkPolicyOid_idx" ON "FirewallNetworkPolicy"("networkPolicyOid");

-- CreateIndex
CREATE UNIQUE INDEX "FirewallNetworkPolicy_firewallOid_networkPolicyOid_key" ON "FirewallNetworkPolicy"("firewallOid", "networkPolicyOid");

-- CreateIndex
CREATE UNIQUE INDEX "NetworkPolicy_id_key" ON "NetworkPolicy"("id");

-- CreateIndex
CREATE INDEX "NetworkPolicy_instanceOid_status_idx" ON "NetworkPolicy"("instanceOid", "status");

-- CreateIndex
CREATE INDEX "NetworkPolicy_needsSubspaceSync_oid_idx" ON "NetworkPolicy"("needsSubspaceSync", "oid");

-- CreateIndex
CREATE UNIQUE INDEX "NetworkPolicyVersion_id_key" ON "NetworkPolicyVersion"("id");

-- CreateIndex
CREATE UNIQUE INDEX "NetworkPolicyVersion_networkPolicyOid_version_key" ON "NetworkPolicyVersion"("networkPolicyOid", "version");

-- CreateIndex
CREATE UNIQUE INDEX "AccessRole_id_key" ON "AccessRole"("id");

-- CreateIndex
CREATE UNIQUE INDEX "AccessRole_organizationOid_slug_key" ON "AccessRole"("organizationOid", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "AccessRoleVersion_id_key" ON "AccessRoleVersion"("id");

-- CreateIndex
CREATE UNIQUE INDEX "AccessPolicy_id_key" ON "AccessPolicy"("id");

-- CreateIndex
CREATE INDEX "AccessPolicy_autoUpdateScopesHash_idx" ON "AccessPolicy"("autoUpdateScopesHash");

-- CreateIndex
CREATE INDEX "AccessPolicy_hasBeenCustomized_idx" ON "AccessPolicy"("hasBeenCustomized");

-- CreateIndex
CREATE INDEX "AccessPolicy_type_idx" ON "AccessPolicy"("type");

-- CreateIndex
CREATE UNIQUE INDEX "AccessPolicy_organizationOid_slug_key" ON "AccessPolicy"("organizationOid", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "AccessPolicyRole_id_key" ON "AccessPolicyRole"("id");

-- CreateIndex
CREATE UNIQUE INDEX "AccessPolicyRole_accessPolicyOid_accessRoleOid_key" ON "AccessPolicyRole"("accessPolicyOid", "accessRoleOid");

-- CreateIndex
CREATE UNIQUE INDEX "AccessPolicyProject_id_key" ON "AccessPolicyProject"("id");

-- CreateIndex
CREATE UNIQUE INDEX "AccessPolicyProject_accessPolicyOid_projectOid_key" ON "AccessPolicyProject"("accessPolicyOid", "projectOid");

-- CreateIndex
CREATE UNIQUE INDEX "AccessPolicyInstance_id_key" ON "AccessPolicyInstance"("id");

-- CreateIndex
CREATE UNIQUE INDEX "AccessPolicyInstance_accessPolicyOid_instanceOid_key" ON "AccessPolicyInstance"("accessPolicyOid", "instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "AccessPolicyVersion_id_key" ON "AccessPolicyVersion"("id");

-- CreateIndex
CREATE UNIQUE INDEX "AccessPolicyVersion_accessPolicyOid_index_key" ON "AccessPolicyVersion"("accessPolicyOid", "index");

-- CreateIndex
CREATE UNIQUE INDEX "AccessPolicyAssignment_id_key" ON "AccessPolicyAssignment"("id");

-- CreateIndex
CREATE INDEX "AccessPolicyAssignment_memberOid_idx" ON "AccessPolicyAssignment"("memberOid");

-- CreateIndex
CREATE INDEX "AccessPolicyAssignment_teamOid_idx" ON "AccessPolicyAssignment"("teamOid");

-- CreateIndex
CREATE INDEX "AccessPolicyAssignment_serviceAccountOid_idx" ON "AccessPolicyAssignment"("serviceAccountOid");

-- CreateIndex
CREATE UNIQUE INDEX "AccessPolicyAssignment_accessPolicyOid_serviceAccountOid_key" ON "AccessPolicyAssignment"("accessPolicyOid", "serviceAccountOid");

-- CreateIndex
CREATE UNIQUE INDEX "AccessPolicyAssignment_accessPolicyOid_memberOid_key" ON "AccessPolicyAssignment"("accessPolicyOid", "memberOid");

-- CreateIndex
CREATE UNIQUE INDEX "AccessPolicyAssignment_accessPolicyOid_teamOid_key" ON "AccessPolicyAssignment"("accessPolicyOid", "teamOid");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationActor_id_key" ON "OrganizationActor"("id");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationActor_isSystem_organizationOid_key" ON "OrganizationActor"("isSystem", "organizationOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectBrand_id_key" ON "ProjectBrand"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectBrand_identifier_key" ON "ProjectBrand"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectBrand_projectOid_key" ON "ProjectBrand"("projectOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectBrandUpdate_id_key" ON "ProjectBrandUpdate"("id");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationConfigType_id_key" ON "OrganizationConfigType"("id");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationConfigType_identifier_key" ON "OrganizationConfigType"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationConfig_id_key" ON "OrganizationConfig"("id");

-- CreateIndex
CREATE INDEX "OrganizationConfig_userOid_idx" ON "OrganizationConfig"("userOid");

-- CreateIndex
CREATE INDEX "OrganizationConfig_organizationOid_idx" ON "OrganizationConfig"("organizationOid");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationConfig_typeOid_targetHash_key" ON "OrganizationConfig"("typeOid", "targetHash");

-- CreateIndex
CREATE UNIQUE INDEX "Environment_id_key" ON "Environment"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Environment_instanceOid_key" ON "Environment"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "Sandbox_id_key" ON "Sandbox"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Sandbox_instanceOid_key" ON "Sandbox"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "Instance_id_key" ON "Instance"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Instance_slug_key" ON "Instance"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Instance_oldSlug_key" ON "Instance"("oldSlug");

-- CreateIndex
CREATE UNIQUE INDEX "Instance_resourceGroupOid_key" ON "Instance"("resourceGroupOid");

-- CreateIndex
CREATE INDEX "Instance_previousSlugs_idx" ON "Instance"("previousSlugs");

-- CreateIndex
CREATE INDEX "Instance_oldSlug_idx" ON "Instance"("oldSlug");

-- CreateIndex
CREATE INDEX "Instance_slug_idx" ON "Instance"("slug");

-- CreateIndex
CREATE INDEX "Instance_resourceTenantOid_idx" ON "Instance"("resourceTenantOid");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationLayoutType_id_key" ON "OrganizationLayoutType"("id");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationLayoutType_identifier_key" ON "OrganizationLayoutType"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationLayout_id_key" ON "OrganizationLayout"("id");

-- CreateIndex
CREATE INDEX "OrganizationLayout_userOid_idx" ON "OrganizationLayout"("userOid");

-- CreateIndex
CREATE INDEX "OrganizationLayout_organizationOid_idx" ON "OrganizationLayout"("organizationOid");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationLayout_typeOid_targetHash_key" ON "OrganizationLayout"("typeOid", "targetHash");

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
CREATE UNIQUE INDEX "OrganizationNotificationType_id_key" ON "OrganizationNotificationType"("id");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationNotificationType_identifier_key" ON "OrganizationNotificationType"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationNotification_id_key" ON "OrganizationNotification"("id");

-- CreateIndex
CREATE INDEX "OrganizationNotification_organizationOid_createdAt_idx" ON "OrganizationNotification"("organizationOid", "createdAt");

-- CreateIndex
CREATE INDEX "OrganizationNotification_typeOid_idx" ON "OrganizationNotification"("typeOid");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationNotificationDestination_id_key" ON "OrganizationNotificationDestination"("id");

-- CreateIndex
CREATE INDEX "OrganizationNotificationDestination_memberOid_status_create_idx" ON "OrganizationNotificationDestination"("memberOid", "status", "createdAt");

-- CreateIndex
CREATE INDEX "OrganizationNotificationDestination_notificationOid_idx" ON "OrganizationNotificationDestination"("notificationOid");

-- CreateIndex
CREATE INDEX "OrganizationNotificationDestination_emailStatus_emailSendAf_idx" ON "OrganizationNotificationDestination"("emailStatus", "emailSendAfter");

-- CreateIndex
CREATE INDEX "OrganizationNotificationDestination_emailDigestOid_idx" ON "OrganizationNotificationDestination"("emailDigestOid");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationNotificationDestination_memberOid_notificationO_key" ON "OrganizationNotificationDestination"("memberOid", "notificationOid");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationNotificationSetting_id_key" ON "OrganizationNotificationSetting"("id");

-- CreateIndex
CREATE INDEX "OrganizationNotificationSetting_organizationOid_userOid_idx" ON "OrganizationNotificationSetting"("organizationOid", "userOid");

-- CreateIndex
CREATE INDEX "OrganizationNotificationSetting_typeOid_idx" ON "OrganizationNotificationSetting"("typeOid");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationNotificationSetting_userOid_organizationOid_typ_key" ON "OrganizationNotificationSetting"("userOid", "organizationOid", "typeOid");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationNotificationDigestSetting_id_key" ON "OrganizationNotificationDigestSetting"("id");

-- CreateIndex
CREATE INDEX "OrganizationNotificationDigestSetting_organizationOid_userO_idx" ON "OrganizationNotificationDigestSetting"("organizationOid", "userOid");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationNotificationDigestSetting_userOid_organizationO_key" ON "OrganizationNotificationDigestSetting"("userOid", "organizationOid");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationNotificationEmailDigest_id_key" ON "OrganizationNotificationEmailDigest"("id");

-- CreateIndex
CREATE INDEX "OrganizationNotificationEmailDigest_status_scheduledFor_idx" ON "OrganizationNotificationEmailDigest"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "OrganizationNotificationEmailDigest_memberOid_createdAt_idx" ON "OrganizationNotificationEmailDigest"("memberOid", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_id_key" ON "Organization"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_resourceTenantOid_key" ON "Organization"("resourceTenantOid");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_resourceGroupOid_key" ON "Organization"("resourceGroupOid");

-- CreateIndex
CREATE INDEX "Organization_authVersion_idx" ON "Organization"("authVersion");

-- CreateIndex
CREATE INDEX "Organization_previousSlugs_idx" ON "Organization"("previousSlugs");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_id_key" ON "Profile"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_slug_key" ON "Profile"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_organizationOid_key" ON "Profile"("organizationOid");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_userOid_key" ON "Profile"("userOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileUpdate_id_key" ON "ProfileUpdate"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Project_id_key" ON "Project"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Project_resourceTenantOid_key" ON "Project"("resourceTenantOid");

-- CreateIndex
CREATE UNIQUE INDEX "Project_resourceGroupOid_key" ON "Project"("resourceGroupOid");

-- CreateIndex
CREATE INDEX "Project_previousSlugs_idx" ON "Project"("previousSlugs");

-- CreateIndex
CREATE UNIQUE INDEX "Team_id_key" ON "Team"("id");

-- CreateIndex
CREATE UNIQUE INDEX "TeamProject_id_key" ON "TeamProject"("id");

-- CreateIndex
CREATE UNIQUE INDEX "TeamProject_teamOid_projectOid_key" ON "TeamProject"("teamOid", "projectOid");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_id_key" ON "TeamMember"("id");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_teamOid_organizationActorOid_key" ON "TeamMember"("teamOid", "organizationActorOid");

-- CreateIndex
CREATE UNIQUE INDEX "OutpostInstance_id_key" ON "OutpostInstance"("id");

-- CreateIndex
CREATE INDEX "OutpostInstance_status_lastSeenAt_idx" ON "OutpostInstance"("status", "lastSeenAt");

-- CreateIndex
CREATE INDEX "OutpostInstance_status_expiresAt_idx" ON "OutpostInstance"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "OutpostInstance_outpostOid_identifier_key" ON "OutpostInstance"("outpostOid", "identifier");

-- CreateIndex
CREATE UNIQUE INDEX "OutpostInstanceService_id_key" ON "OutpostInstanceService"("id");

-- CreateIndex
CREATE INDEX "OutpostInstanceService_service_granted_idx" ON "OutpostInstanceService"("service", "granted");

-- CreateIndex
CREATE UNIQUE INDEX "OutpostInstanceService_instanceOid_service_key" ON "OutpostInstanceService"("instanceOid", "service");

-- CreateIndex
CREATE UNIQUE INDEX "OutpostInstanceKeyRotation_id_key" ON "OutpostInstanceKeyRotation"("id");

-- CreateIndex
CREATE INDEX "OutpostInstanceKeyRotation_createdAt_idx" ON "OutpostInstanceKeyRotation"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OutpostInstanceEvent_id_key" ON "OutpostInstanceEvent"("id");

-- CreateIndex
CREATE INDEX "OutpostInstanceEvent_createdAt_idx" ON "OutpostInstanceEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OutpostTokenKeyPair_id_key" ON "OutpostTokenKeyPair"("id");

-- CreateIndex
CREATE INDEX "OutpostTokenKeyPair_accountOid_organizationOid_status_idx" ON "OutpostTokenKeyPair"("accountOid", "organizationOid", "status");

-- CreateIndex
CREATE INDEX "OutpostTokenKeyPair_status_stopSigningAt_idx" ON "OutpostTokenKeyPair"("status", "stopSigningAt");

-- CreateIndex
CREATE INDEX "OutpostTokenKeyPair_status_stopVerifyingAt_idx" ON "OutpostTokenKeyPair"("status", "stopVerifyingAt");

-- CreateIndex
CREATE UNIQUE INDEX "Outpost_id_key" ON "Outpost"("id");

-- CreateIndex
CREATE INDEX "Outpost_status_connectionStatus_idx" ON "Outpost"("status", "connectionStatus");

-- CreateIndex
CREATE UNIQUE INDEX "OutpostCredential_id_key" ON "OutpostCredential"("id");

-- CreateIndex
CREATE UNIQUE INDEX "OutpostAccess_id_key" ON "OutpostAccess"("id");

-- CreateIndex
CREATE UNIQUE INDEX "OutpostAccess_outpostOid_instanceOid_key" ON "OutpostAccess"("outpostOid", "instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAssistantImplementation_id_key" ON "ProductAssistantImplementation"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAssistantImplementation_slug_key" ON "ProductAssistantImplementation"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAssistant_id_key" ON "ProductAssistant"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAssistant_slug_key" ON "ProductAssistant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAssistant_systemIdentifier_key" ON "ProductAssistant"("systemIdentifier");

-- CreateIndex
CREATE INDEX "ProductAssistant_projectOid_idx" ON "ProductAssistant"("projectOid");

-- CreateIndex
CREATE INDEX "ProductAssistant_implementationOid_idx" ON "ProductAssistant"("implementationOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAssistantConfig_id_key" ON "ProductAssistantConfig"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAssistantConfig_projectOid_key" ON "ProductAssistantConfig"("projectOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAssistantInstance_id_key" ON "ProductAssistantInstance"("id");

-- CreateIndex
CREATE INDEX "ProductAssistantInstance_projectOid_idx" ON "ProductAssistantInstance"("projectOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAssistantInstance_assistantOid_projectOid_key" ON "ProductAssistantInstance"("assistantOid", "projectOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAssistantConversation_id_key" ON "ProductAssistantConversation"("id");

-- CreateIndex
CREATE INDEX "ProductAssistantConversation_projectOid_instanceOid_idx" ON "ProductAssistantConversation"("projectOid", "instanceOid");

-- CreateIndex
CREATE INDEX "ProductAssistantConversation_assistantOid_assistantInstance_idx" ON "ProductAssistantConversation"("assistantOid", "assistantInstanceOid");

-- CreateIndex
CREATE INDEX "ProductAssistantConversation_createdByResourceActorOid_idx" ON "ProductAssistantConversation"("createdByResourceActorOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAssistantConversationParticipant_id_key" ON "ProductAssistantConversationParticipant"("id");

-- CreateIndex
CREATE INDEX "ProductAssistantConversationParticipant_conversationOid_idx" ON "ProductAssistantConversationParticipant"("conversationOid");

-- CreateIndex
CREATE INDEX "ProductAssistantConversationParticipant_resourceActorOid_idx" ON "ProductAssistantConversationParticipant"("resourceActorOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAssistantConversationParticipant_conversationOid_res_key" ON "ProductAssistantConversationParticipant"("conversationOid", "resourceActorOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAssistantRequest_id_key" ON "ProductAssistantRequest"("id");

-- CreateIndex
CREATE INDEX "ProductAssistantRequest_conversationOid_status_idx" ON "ProductAssistantRequest"("conversationOid", "status");

-- CreateIndex
CREATE INDEX "ProductAssistantRequest_assistantInstanceOid_idx" ON "ProductAssistantRequest"("assistantInstanceOid");

-- CreateIndex
CREATE INDEX "ProductAssistantRequest_resourceActorOid_idx" ON "ProductAssistantRequest"("resourceActorOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAssistantMessage_id_key" ON "ProductAssistantMessage"("id");

-- CreateIndex
CREATE INDEX "ProductAssistantMessage_runOid_idx" ON "ProductAssistantMessage"("runOid");

-- CreateIndex
CREATE INDEX "ProductAssistantMessage_requestOid_idx" ON "ProductAssistantMessage"("requestOid");

-- CreateIndex
CREATE INDEX "ProductAssistantMessage_assistantInstanceOid_idx" ON "ProductAssistantMessage"("assistantInstanceOid");

-- CreateIndex
CREATE INDEX "ProductAssistantMessage_assistantOid_idx" ON "ProductAssistantMessage"("assistantOid");

-- CreateIndex
CREATE INDEX "ProductAssistantMessage_parentMessageOid_idx" ON "ProductAssistantMessage"("parentMessageOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAssistantConversationItem_id_key" ON "ProductAssistantConversationItem"("id");

-- CreateIndex
CREATE INDEX "ProductAssistantConversationItem_conversationOid_idx" ON "ProductAssistantConversationItem"("conversationOid");

-- CreateIndex
CREATE INDEX "ProductAssistantConversationItem_messageOid_idx" ON "ProductAssistantConversationItem"("messageOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAssistantModel_id_key" ON "ProductAssistantModel"("id");

-- CreateIndex
CREATE INDEX "ProductAssistantModel_providerOid_idx" ON "ProductAssistantModel"("providerOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAssistantModel_slug_providerOid_key" ON "ProductAssistantModel"("slug", "providerOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAssistantModelProvider_id_key" ON "ProductAssistantModelProvider"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAssistantModelProvider_slug_key" ON "ProductAssistantModelProvider"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAssistantModelRun_id_key" ON "ProductAssistantModelRun"("id");

-- CreateIndex
CREATE INDEX "ProductAssistantModelRun_requestOid_idx" ON "ProductAssistantModelRun"("requestOid");

-- CreateIndex
CREATE INDEX "ProductAssistantModelRun_conversationOid_status_idx" ON "ProductAssistantModelRun"("conversationOid", "status");

-- CreateIndex
CREATE INDEX "ProductAssistantModelRun_assistantInstanceOid_idx" ON "ProductAssistantModelRun"("assistantInstanceOid");

-- CreateIndex
CREATE INDEX "ProductAssistantModelRun_projectOid_idx" ON "ProductAssistantModelRun"("projectOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAssistantSubspaceMcpConnection_id_key" ON "ProductAssistantSubspaceMcpConnection"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAssistantSubspaceMcpConnection_connectionId_key" ON "ProductAssistantSubspaceMcpConnection"("connectionId");

-- CreateIndex
CREATE INDEX "ProductAssistantSubspaceMcpConnection_projectOid_instanceOi_idx" ON "ProductAssistantSubspaceMcpConnection"("projectOid", "instanceOid");

-- CreateIndex
CREATE INDEX "ProductAssistantSubspaceMcpConnection_lastUsedAt_idx" ON "ProductAssistantSubspaceMcpConnection"("lastUsedAt");

-- CreateIndex
CREATE INDEX "ProductAssistantSubspaceMcpConnection_createdAt_idx" ON "ProductAssistantSubspaceMcpConnection"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAssistantSubspaceMcpConnection_instanceOid_sessionId_key" ON "ProductAssistantSubspaceMcpConnection"("instanceOid", "sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAssistantSubspaceMcpToolCache_id_key" ON "ProductAssistantSubspaceMcpToolCache"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAssistantSubspaceMcpToolCache_connectionId_key" ON "ProductAssistantSubspaceMcpToolCache"("connectionId");

-- CreateIndex
CREATE INDEX "ProductAssistantSubspaceMcpToolCache_expiresAt_idx" ON "ProductAssistantSubspaceMcpToolCache"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AccessLimiter_id_key" ON "AccessLimiter"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SandboxDisk_id_key" ON "SandboxDisk"("id");

-- CreateIndex
CREATE INDEX "SandboxDisk_instanceOid_type_status_idx" ON "SandboxDisk"("instanceOid", "type", "status");

-- CreateIndex
CREATE INDEX "SandboxDisk_machineOid_type_status_idx" ON "SandboxDisk"("machineOid", "type", "status");

-- CreateIndex
CREATE INDEX "SandboxDisk_tenantOid_status_idx" ON "SandboxDisk"("tenantOid", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SandboxMachineFirewall_id_key" ON "SandboxMachineFirewall"("id");

-- CreateIndex
CREATE INDEX "SandboxMachineFirewall_firewallOid_idx" ON "SandboxMachineFirewall"("firewallOid");

-- CreateIndex
CREATE UNIQUE INDEX "SandboxMachineFirewall_machineOid_firewallOid_key" ON "SandboxMachineFirewall"("machineOid", "firewallOid");

-- CreateIndex
CREATE UNIQUE INDEX "SandboxEgressPolicy_id_key" ON "SandboxEgressPolicy"("id");

-- CreateIndex
CREATE INDEX "SandboxEgressPolicy_needsCompile_oid_idx" ON "SandboxEgressPolicy"("needsCompile", "oid");

-- CreateIndex
CREATE INDEX "SandboxEgressPolicy_unusedAt_oid_idx" ON "SandboxEgressPolicy"("unusedAt", "oid");

-- CreateIndex
CREATE UNIQUE INDEX "SandboxEgressPolicy_instanceOid_firewallSetHash_key" ON "SandboxEgressPolicy"("instanceOid", "firewallSetHash");

-- CreateIndex
CREATE UNIQUE INDEX "SandboxEgressPolicyFirewall_id_key" ON "SandboxEgressPolicyFirewall"("id");

-- CreateIndex
CREATE INDEX "SandboxEgressPolicyFirewall_firewallOid_oid_idx" ON "SandboxEgressPolicyFirewall"("firewallOid", "oid");

-- CreateIndex
CREATE UNIQUE INDEX "SandboxEgressPolicyFirewall_policyOid_firewallOid_key" ON "SandboxEgressPolicyFirewall"("policyOid", "firewallOid");

-- CreateIndex
CREATE UNIQUE INDEX "SandboxEgressPolicyRegion_id_key" ON "SandboxEgressPolicyRegion"("id");

-- CreateIndex
CREATE INDEX "SandboxEgressPolicyRegion_status_oid_idx" ON "SandboxEgressPolicyRegion"("status", "oid");

-- CreateIndex
CREATE UNIQUE INDEX "SandboxEgressPolicyRegion_policyOid_tenantOid_key" ON "SandboxEgressPolicyRegion"("policyOid", "tenantOid");

-- CreateIndex
CREATE UNIQUE INDEX "SandboxMachineImageBuild_id_key" ON "SandboxMachineImageBuild"("id");

-- CreateIndex
CREATE INDEX "SandboxMachineImageBuild_instanceOid_status_idx" ON "SandboxMachineImageBuild"("instanceOid", "status");

-- CreateIndex
CREATE INDEX "SandboxMachineImageBuild_status_oid_idx" ON "SandboxMachineImageBuild"("status", "oid");

-- CreateIndex
CREATE INDEX "SandboxMachineImageBuild_status_lastCheckedAt_idx" ON "SandboxMachineImageBuild"("status", "lastCheckedAt");

-- CreateIndex
CREATE INDEX "SandboxMachineImageBuild_imageOid_createdAt_idx" ON "SandboxMachineImageBuild"("imageOid", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SandboxMachineImageBuildRegion_id_key" ON "SandboxMachineImageBuildRegion"("id");

-- CreateIndex
CREATE INDEX "SandboxMachineImageBuildRegion_status_oid_idx" ON "SandboxMachineImageBuildRegion"("status", "oid");

-- CreateIndex
CREATE UNIQUE INDEX "SandboxMachineImageBuildRegion_buildOid_regionOid_key" ON "SandboxMachineImageBuildRegion"("buildOid", "regionOid");

-- CreateIndex
CREATE UNIQUE INDEX "SandboxMachineImage_id_key" ON "SandboxMachineImage"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SandboxMachineImage_identifier_key" ON "SandboxMachineImage"("identifier");

-- CreateIndex
CREATE INDEX "SandboxMachineImage_instanceOid_status_idx" ON "SandboxMachineImage"("instanceOid", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SandboxMachineImageRegion_id_key" ON "SandboxMachineImageRegion"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SandboxMachineImageRegion_imageOid_regionOid_key" ON "SandboxMachineImageRegion"("imageOid", "regionOid");

-- CreateIndex
CREATE UNIQUE INDEX "SandboxMachineImageRegion_regionOid_genesisId_key" ON "SandboxMachineImageRegion"("regionOid", "genesisId");

-- CreateIndex
CREATE UNIQUE INDEX "SandboxMachineImageVersion_id_key" ON "SandboxMachineImageVersion"("id");

-- CreateIndex
CREATE INDEX "SandboxMachineImageVersion_imageOid_status_idx" ON "SandboxMachineImageVersion"("imageOid", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SandboxMachineImageVersion_imageOid_releaseKey_key" ON "SandboxMachineImageVersion"("imageOid", "releaseKey");

-- CreateIndex
CREATE UNIQUE INDEX "SandboxMachineImageVersion_imageOid_versionNumber_key" ON "SandboxMachineImageVersion"("imageOid", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SandboxMachineImageVersionRegion_id_key" ON "SandboxMachineImageVersionRegion"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SandboxMachineImageVersionRegion_versionOid_regionOid_key" ON "SandboxMachineImageVersionRegion"("versionOid", "regionOid");

-- CreateIndex
CREATE UNIQUE INDEX "SandboxMachineImageVersionRegion_regionOid_genesisId_key" ON "SandboxMachineImageVersionRegion"("regionOid", "genesisId");

-- CreateIndex
CREATE UNIQUE INDEX "SandboxMachine_id_key" ON "SandboxMachine"("id");

-- CreateIndex
CREATE INDEX "SandboxMachine_instanceOid_status_idx" ON "SandboxMachine"("instanceOid", "status");

-- CreateIndex
CREATE INDEX "SandboxMachine_tenantOid_status_idx" ON "SandboxMachine"("tenantOid", "status");

-- CreateIndex
CREATE INDEX "SandboxMachine_needsEgressSync_oid_idx" ON "SandboxMachine"("needsEgressSync", "oid");

-- CreateIndex
CREATE INDEX "SandboxMachine_egressPolicyOid_idx" ON "SandboxMachine"("egressPolicyOid");

-- CreateIndex
CREATE INDEX "SandboxMachine_instanceOid_imageOid_idx" ON "SandboxMachine"("instanceOid", "imageOid");

-- CreateIndex
CREATE UNIQUE INDEX "SandboxRegion_id_key" ON "SandboxRegion"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SandboxRegion_identifier_key" ON "SandboxRegion"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "SandboxSpec_id_key" ON "SandboxSpec"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SandboxSpec_identifier_key" ON "SandboxSpec"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "SandboxSpecRegion_id_key" ON "SandboxSpecRegion"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SandboxSpecRegion_specOid_regionOid_key" ON "SandboxSpecRegion"("specOid", "regionOid");

-- CreateIndex
CREATE UNIQUE INDEX "SandboxSpecRegion_regionOid_genesisId_key" ON "SandboxSpecRegion"("regionOid", "genesisId");

-- CreateIndex
CREATE UNIQUE INDEX "SandboxTenant_id_key" ON "SandboxTenant"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SandboxTenant_projectOid_regionOid_key" ON "SandboxTenant"("projectOid", "regionOid");

-- CreateIndex
CREATE UNIQUE INDEX "SandboxTenant_regionOid_slug_key" ON "SandboxTenant"("regionOid", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "SearchIndex_identifier_key" ON "SearchIndex"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "SearchIndexRecord_documentId_indexOid_key" ON "SearchIndexRecord"("documentId", "indexOid");

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
CREATE UNIQUE INDEX "SecretEvent_id_key" ON "SecretEvent"("id");

-- CreateIndex
CREATE UNIQUE INDEX "CargoSyncMetorialOwnedRecord_id_key" ON "CargoSyncMetorialOwnedRecord"("id");

-- CreateIndex
CREATE INDEX "CargoSyncMetorialOwnedRecord_model_idx" ON "CargoSyncMetorialOwnedRecord"("model");

-- CreateIndex
CREATE UNIQUE INDEX "CargoSyncMetorialOwnedRecord_model_recordId_key" ON "CargoSyncMetorialOwnedRecord"("model", "recordId");

-- CreateIndex
CREATE UNIQUE INDEX "CargoSyncRecord_id_key" ON "CargoSyncRecord"("id");

-- CreateIndex
CREATE INDEX "CargoSyncRecord_model_lastSeenRunId_idx" ON "CargoSyncRecord"("model", "lastSeenRunId");

-- CreateIndex
CREATE UNIQUE INDEX "CargoSyncRecord_model_recordId_key" ON "CargoSyncRecord"("model", "recordId");

-- CreateIndex
CREATE UNIQUE INDEX "CargoSyncRun_id_key" ON "CargoSyncRun"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SkillAgent_id_key" ON "SkillAgent"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SkillAgent_storeItemOid_key" ON "SkillAgent"("storeItemOid");

-- CreateIndex
CREATE UNIQUE INDEX "SkillConfiguration_id_key" ON "SkillConfiguration"("id");

-- CreateIndex
CREATE INDEX "SkillConfiguration_resourceTenantOid_resourceGroupOid_delet_idx" ON "SkillConfiguration"("resourceTenantOid", "resourceGroupOid", "deletedAt");

-- CreateIndex
CREATE INDEX "SkillConfiguration_resourceTenantOid_resourceGroupOid_isInt_idx" ON "SkillConfiguration"("resourceTenantOid", "resourceGroupOid", "isInternal");

-- CreateIndex
CREATE INDEX "SkillConfiguration_instanceOid_deletedAt_idx" ON "SkillConfiguration"("instanceOid", "deletedAt");

-- CreateIndex
CREATE INDEX "SkillConfiguration_instanceOid_isInternal_idx" ON "SkillConfiguration"("instanceOid", "isInternal");

-- CreateIndex
CREATE UNIQUE INDEX "SkillConfiguration_resourceGroupOid_isDefault_key" ON "SkillConfiguration"("resourceGroupOid", "isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "SkillConfiguration_instanceOid_isDefault_key" ON "SkillConfiguration"("instanceOid", "isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "SkillExportRef_cargoOid_key" ON "SkillExportRef"("cargoOid");

-- CreateIndex
CREATE UNIQUE INDEX "SkillExportRef_resourceTenantOid_resourceGroupOid_hash_key" ON "SkillExportRef"("resourceTenantOid", "resourceGroupOid", "hash");

-- CreateIndex
CREATE UNIQUE INDEX "SkillExportRef_instanceOid_hash_key" ON "SkillExportRef"("instanceOid", "hash");

-- CreateIndex
CREATE UNIQUE INDEX "SkillExport_id_key" ON "SkillExport"("id");

-- CreateIndex
CREATE INDEX "SkillExport_status_idx" ON "SkillExport"("status");

-- CreateIndex
CREATE INDEX "SkillExport_creatorResourceActorOid_idx" ON "SkillExport"("creatorResourceActorOid");

-- CreateIndex
CREATE UNIQUE INDEX "SkillGroup_id_key" ON "SkillGroup"("id");

-- CreateIndex
CREATE INDEX "SkillGroup_instanceOid_status_idx" ON "SkillGroup"("instanceOid", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SkillGroupItem_id_key" ON "SkillGroupItem"("id");

-- CreateIndex
CREATE INDEX "SkillGroupItem_skillOid_status_idx" ON "SkillGroupItem"("skillOid", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SkillGroupItem_skillGroupOid_skillOid_key" ON "SkillGroupItem"("skillGroupOid", "skillOid");

-- CreateIndex
CREATE UNIQUE INDEX "SkillImport_id_key" ON "SkillImport"("id");

-- CreateIndex
CREATE INDEX "SkillImport_resourceTenantOid_resourceGroupOid_createdAt_idx" ON "SkillImport"("resourceTenantOid", "resourceGroupOid", "createdAt");

-- CreateIndex
CREATE INDEX "SkillImport_instanceOid_createdAt_idx" ON "SkillImport"("instanceOid", "createdAt");

-- CreateIndex
CREATE INDEX "SkillImport_creatorResourceActorOid_createdAt_idx" ON "SkillImport"("creatorResourceActorOid", "createdAt");

-- CreateIndex
CREATE INDEX "SkillImport_status_updatedAt_idx" ON "SkillImport"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SkillImportItem_id_key" ON "SkillImportItem"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SkillImportItem_targetSkillId_key" ON "SkillImportItem"("targetSkillId");

-- CreateIndex
CREATE INDEX "SkillImportItem_skillImportOid_status_idx" ON "SkillImportItem"("skillImportOid", "status");

-- CreateIndex
CREATE INDEX "SkillImportItem_skillOid_idx" ON "SkillImportItem"("skillOid");

-- CreateIndex
CREATE UNIQUE INDEX "SkillImportItem_skillImportOid_path_key" ON "SkillImportItem"("skillImportOid", "path");

-- CreateIndex
CREATE UNIQUE INDEX "SkillMarketplace_id_key" ON "SkillMarketplace"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SkillMarketplace_slug_key" ON "SkillMarketplace"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "SkillMarketplace_destinationOid_key" ON "SkillMarketplace"("destinationOid");

-- CreateIndex
CREATE INDEX "SkillMarketplace_instanceOid_status_idx" ON "SkillMarketplace"("instanceOid", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SkillMarketplaceRepository_id_key" ON "SkillMarketplaceRepository"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SkillMarketplaceRepository_skillRepositoryOid_key" ON "SkillMarketplaceRepository"("skillRepositoryOid");

-- CreateIndex
CREATE INDEX "SkillMarketplaceRepository_skillMarketplaceOid_idx" ON "SkillMarketplaceRepository"("skillMarketplaceOid");

-- CreateIndex
CREATE UNIQUE INDEX "SkillMarketplaceRepository_skillMarketplaceOid_skillReposit_key" ON "SkillMarketplaceRepository"("skillMarketplaceOid", "skillRepositoryOid");

-- CreateIndex
CREATE UNIQUE INDEX "SkillMergeRequest_id_key" ON "SkillMergeRequest"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SkillMergeRequest_activePairKey_key" ON "SkillMergeRequest"("activePairKey");

-- CreateIndex
CREATE INDEX "SkillMergeRequest_resourceTenantOid_resourceGroupOid_status_idx" ON "SkillMergeRequest"("resourceTenantOid", "resourceGroupOid", "status", "createdAt");

-- CreateIndex
CREATE INDEX "SkillMergeRequest_instanceOid_status_createdAt_idx" ON "SkillMergeRequest"("instanceOid", "status", "createdAt");

-- CreateIndex
CREATE INDEX "SkillMergeRequest_sourceSkillOid_status_createdAt_idx" ON "SkillMergeRequest"("sourceSkillOid", "status", "createdAt");

-- CreateIndex
CREATE INDEX "SkillMergeRequest_targetSkillOid_status_createdAt_idx" ON "SkillMergeRequest"("targetSkillOid", "status", "createdAt");

-- CreateIndex
CREATE INDEX "SkillMergeRequest_baseSourceSkillVersionOid_idx" ON "SkillMergeRequest"("baseSourceSkillVersionOid");

-- CreateIndex
CREATE INDEX "SkillMergeRequest_createdByResourceActorOid_createdAt_idx" ON "SkillMergeRequest"("createdByResourceActorOid", "createdAt");

-- CreateIndex
CREATE INDEX "SkillMergeRequest_status_mergeStartedAt_idx" ON "SkillMergeRequest"("status", "mergeStartedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SkillForkSync_id_key" ON "SkillForkSync"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SkillForkSync_activePairKey_key" ON "SkillForkSync"("activePairKey");

-- CreateIndex
CREATE UNIQUE INDEX "SkillForkSync_generatedMergeRequestOid_key" ON "SkillForkSync"("generatedMergeRequestOid");

-- CreateIndex
CREATE INDEX "SkillForkSync_resourceTenantOid_resourceGroupOid_status_cre_idx" ON "SkillForkSync"("resourceTenantOid", "resourceGroupOid", "status", "createdAt");

-- CreateIndex
CREATE INDEX "SkillForkSync_instanceOid_status_createdAt_idx" ON "SkillForkSync"("instanceOid", "status", "createdAt");

-- CreateIndex
CREATE INDEX "SkillForkSync_forkSkillOid_status_createdAt_idx" ON "SkillForkSync"("forkSkillOid", "status", "createdAt");

-- CreateIndex
CREATE INDEX "SkillForkSync_upstreamSkillOid_status_createdAt_idx" ON "SkillForkSync"("upstreamSkillOid", "status", "createdAt");

-- CreateIndex
CREATE INDEX "SkillForkSync_createdByResourceActorOid_createdAt_idx" ON "SkillForkSync"("createdByResourceActorOid", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SkillMergeRequestItem_id_key" ON "SkillMergeRequestItem"("id");

-- CreateIndex
CREATE INDEX "SkillMergeRequestItem_skillMergeRequestOid_status_idx" ON "SkillMergeRequestItem"("skillMergeRequestOid", "status");

-- CreateIndex
CREATE INDEX "SkillMergeRequestItem_baseFileOid_idx" ON "SkillMergeRequestItem"("baseFileOid");

-- CreateIndex
CREATE INDEX "SkillMergeRequestItem_sourceFileOid_idx" ON "SkillMergeRequestItem"("sourceFileOid");

-- CreateIndex
CREATE INDEX "SkillMergeRequestItem_targetFileOid_idx" ON "SkillMergeRequestItem"("targetFileOid");

-- CreateIndex
CREATE INDEX "SkillMergeRequestItem_baseDocumentOid_idx" ON "SkillMergeRequestItem"("baseDocumentOid");

-- CreateIndex
CREATE INDEX "SkillMergeRequestItem_sourceDocumentOid_idx" ON "SkillMergeRequestItem"("sourceDocumentOid");

-- CreateIndex
CREATE INDEX "SkillMergeRequestItem_targetDocumentOid_idx" ON "SkillMergeRequestItem"("targetDocumentOid");

-- CreateIndex
CREATE INDEX "SkillMergeRequestItem_baseDocumentVersionOid_idx" ON "SkillMergeRequestItem"("baseDocumentVersionOid");

-- CreateIndex
CREATE INDEX "SkillMergeRequestItem_sourceDocumentVersionOid_idx" ON "SkillMergeRequestItem"("sourceDocumentVersionOid");

-- CreateIndex
CREATE INDEX "SkillMergeRequestItem_targetDocumentVersionOid_idx" ON "SkillMergeRequestItem"("targetDocumentVersionOid");

-- CreateIndex
CREATE UNIQUE INDEX "SkillMergeRequestItem_skillMergeRequestOid_path_key" ON "SkillMergeRequestItem"("skillMergeRequestOid", "path");

-- CreateIndex
CREATE UNIQUE INDEX "SkillMergeRequestComment_id_key" ON "SkillMergeRequestComment"("id");

-- CreateIndex
CREATE INDEX "SkillMergeRequestComment_skillMergeRequestOid_createdAt_idx" ON "SkillMergeRequestComment"("skillMergeRequestOid", "createdAt");

-- CreateIndex
CREATE INDEX "SkillMergeRequestComment_skillMergeRequestItemOid_createdAt_idx" ON "SkillMergeRequestComment"("skillMergeRequestItemOid", "createdAt");

-- CreateIndex
CREATE INDEX "SkillMergeRequestComment_resourceActorOid_createdAt_idx" ON "SkillMergeRequestComment"("resourceActorOid", "createdAt");

-- CreateIndex
CREATE INDEX "SkillMergeRequestComment_inReplyToCommentOid_idx" ON "SkillMergeRequestComment"("inReplyToCommentOid");

-- CreateIndex
CREATE INDEX "SkillMergeRequestComment_deletedAt_idx" ON "SkillMergeRequestComment"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SkillMergeRequestEvent_id_key" ON "SkillMergeRequestEvent"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SkillMergeRequestEvent_commentOid_key" ON "SkillMergeRequestEvent"("commentOid");

-- CreateIndex
CREATE INDEX "SkillMergeRequestEvent_skillMergeRequestOid_createdAt_oid_idx" ON "SkillMergeRequestEvent"("skillMergeRequestOid", "createdAt", "oid");

-- CreateIndex
CREATE INDEX "SkillMergeRequestEvent_resourceActorOid_createdAt_idx" ON "SkillMergeRequestEvent"("resourceActorOid", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SkillPlugin_id_key" ON "SkillPlugin"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SkillPlugin_slug_key" ON "SkillPlugin"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "SkillPlugin_destinationOid_key" ON "SkillPlugin"("destinationOid");

-- CreateIndex
CREATE INDEX "SkillPlugin_instanceOid_status_idx" ON "SkillPlugin"("instanceOid", "status");

-- CreateIndex
CREATE INDEX "SkillPlugin_slug_idx" ON "SkillPlugin"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "SkillMarketplacePlugin_id_key" ON "SkillMarketplacePlugin"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SkillMarketplacePlugin_skillMarketplaceOid_skillPluginOid_key" ON "SkillMarketplacePlugin"("skillMarketplaceOid", "skillPluginOid");

-- CreateIndex
CREATE UNIQUE INDEX "SkillMarketplacePlugin_skillMarketplaceOid_pluginSlug_key" ON "SkillMarketplacePlugin"("skillMarketplaceOid", "pluginSlug");

-- CreateIndex
CREATE UNIQUE INDEX "SkillPluginRepository_id_key" ON "SkillPluginRepository"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SkillPluginRepository_skillRepositoryOid_key" ON "SkillPluginRepository"("skillRepositoryOid");

-- CreateIndex
CREATE INDEX "SkillPluginRepository_skillPluginOid_idx" ON "SkillPluginRepository"("skillPluginOid");

-- CreateIndex
CREATE UNIQUE INDEX "SkillPluginRepository_skillPluginOid_skillRepositoryOid_key" ON "SkillPluginRepository"("skillPluginOid", "skillRepositoryOid");

-- CreateIndex
CREATE UNIQUE INDEX "SkillPluginSkill_id_key" ON "SkillPluginSkill"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SkillPluginSkill_skillPluginOid_skillOid_key" ON "SkillPluginSkill"("skillPluginOid", "skillOid");

-- CreateIndex
CREATE UNIQUE INDEX "SkillPluginSkill_skillPluginOid_pluginSkillSlug_key" ON "SkillPluginSkill"("skillPluginOid", "pluginSkillSlug");

-- CreateIndex
CREATE UNIQUE INDEX "ManagedSkillPlugin_id_key" ON "ManagedSkillPlugin"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ManagedSkillPlugin_skillOid_key" ON "ManagedSkillPlugin"("skillOid");

-- CreateIndex
CREATE UNIQUE INDEX "ManagedSkillPlugin_skillPluginOid_key" ON "ManagedSkillPlugin"("skillPluginOid");

-- CreateIndex
CREATE UNIQUE INDEX "SkillRepository_id_key" ON "SkillRepository"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SkillRepository_repoId_key" ON "SkillRepository"("repoId");

-- CreateIndex
CREATE INDEX "SkillRepository_resourceTenantOid_idx" ON "SkillRepository"("resourceTenantOid");

-- CreateIndex
CREATE INDEX "SkillRepository_resourceGroupOid_idx" ON "SkillRepository"("resourceGroupOid");

-- CreateIndex
CREATE INDEX "SkillRepository_projectOid_idx" ON "SkillRepository"("projectOid");

-- CreateIndex
CREATE INDEX "SkillRepository_instanceOid_idx" ON "SkillRepository"("instanceOid");

-- CreateIndex
CREATE INDEX "SkillRepository_nextRepairAt_idx" ON "SkillRepository"("nextRepairAt");

-- CreateIndex
CREATE INDEX "SkillRepository_lastDriftCheckAt_idx" ON "SkillRepository"("lastDriftCheckAt");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_id_key" ON "Skill"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_slug_key" ON "Skill"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_storeOid_key" ON "Skill"("storeOid");

-- CreateIndex
CREATE INDEX "Skill_instanceOid_status_idx" ON "Skill"("instanceOid", "status");

-- CreateIndex
CREATE INDEX "Skill_instanceOid_storeId_idx" ON "Skill"("instanceOid", "storeId");

-- CreateIndex
CREATE INDEX "Skill_createdByConsumerProfileOid_idx" ON "Skill"("createdByConsumerProfileOid");

-- CreateIndex
CREATE INDEX "Skill_forkedFromSkillVersionOid_idx" ON "Skill"("forkedFromSkillVersionOid");

-- CreateIndex
CREATE INDEX "Skill_resourceTenantOid_resourceGroupOid_idx" ON "Skill"("resourceTenantOid", "resourceGroupOid");

-- CreateIndex
CREATE UNIQUE INDEX "SkillVersion_id_key" ON "SkillVersion"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SkillVersion_storeVersionOid_key" ON "SkillVersion"("storeVersionOid");

-- CreateIndex
CREATE INDEX "SkillVersion_skillOid_createdAt_idx" ON "SkillVersion"("skillOid", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SkillVersion_skillOid_versionNumber_key" ON "SkillVersion"("skillOid", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SkillDestination_id_key" ON "SkillDestination"("id");

-- CreateIndex
CREATE INDEX "SkillDestination_syncRecoveryVersion_idx" ON "SkillDestination"("syncRecoveryVersion");

-- CreateIndex
CREATE INDEX "SkillDestination_isDirty_idx" ON "SkillDestination"("isDirty");

-- CreateIndex
CREATE INDEX "SkillDestination_shouldFlushAt_idx" ON "SkillDestination"("shouldFlushAt");

-- CreateIndex
CREATE INDEX "SkillDestination_mustFlushAt_idx" ON "SkillDestination"("mustFlushAt");

-- CreateIndex
CREATE INDEX "SkillDestinationFile_destinationOid_idx" ON "SkillDestinationFile"("destinationOid");

-- CreateIndex
CREATE INDEX "SkillDestinationFile_destinationOid_itemKey_idx" ON "SkillDestinationFile"("destinationOid", "itemKey");

-- CreateIndex
CREATE INDEX "SkillDestinationFile_destinationOid_pathBytes_idx" ON "SkillDestinationFile"("destinationOid", "pathBytes");

-- CreateIndex
CREATE INDEX "SkillDestinationFile_sourceKey_idx" ON "SkillDestinationFile"("sourceKey");

-- CreateIndex
CREATE UNIQUE INDEX "SkillDestinationFile_destinationOid_path_key" ON "SkillDestinationFile"("destinationOid", "path");

-- CreateIndex
CREATE UNIQUE INDEX "SkillDestinationManifest_id_key" ON "SkillDestinationManifest"("id");

-- CreateIndex
CREATE INDEX "SkillDestinationManifest_lastReferencedAt_idx" ON "SkillDestinationManifest"("lastReferencedAt");

-- CreateIndex
CREATE INDEX "SkillDestinationManifest_objectKey_idx" ON "SkillDestinationManifest"("objectKey");

-- CreateIndex
CREATE UNIQUE INDEX "SkillDestinationManifest_destinationOid_sha256_key" ON "SkillDestinationManifest"("destinationOid", "sha256");

-- CreateIndex
CREATE UNIQUE INDEX "SkillSyncBlob_key_key" ON "SkillSyncBlob"("key");

-- CreateIndex
CREATE UNIQUE INDEX "SkillSyncBlob_sha256_key" ON "SkillSyncBlob"("sha256");

-- CreateIndex
CREATE INDEX "SkillSyncBlob_lastReferencedAt_idx" ON "SkillSyncBlob"("lastReferencedAt");

-- CreateIndex
CREATE INDEX "SkillDestinationDeletedFile_destinationOid_createdAt_idx" ON "SkillDestinationDeletedFile"("destinationOid", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SkillDestinationDeletedFile_destinationOid_path_key" ON "SkillDestinationDeletedFile"("destinationOid", "path");

-- CreateIndex
CREATE UNIQUE INDEX "SkillDestinationItem_cargoOid_key" ON "SkillDestinationItem"("cargoOid");

-- CreateIndex
CREATE UNIQUE INDEX "SkillDestinationSync_id_key" ON "SkillDestinationSync"("id");

-- CreateIndex
CREATE INDEX "SkillDestinationSync_destinationOid_status_idx" ON "SkillDestinationSync"("destinationOid", "status");

-- CreateIndex
CREATE INDEX "SkillDestinationSync_status_createdAt_idx" ON "SkillDestinationSync"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SkillDestinationSync_status_updatedAt_idx" ON "SkillDestinationSync"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "SkillDestinationSync_createdAt_idx" ON "SkillDestinationSync"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SkillDestinationSyncRepositoryPropagation_id_key" ON "SkillDestinationSyncRepositoryPropagation"("id");

-- CreateIndex
CREATE INDEX "SkillDestinationSyncRepositoryPropagation_status_idx" ON "SkillDestinationSyncRepositoryPropagation"("status");

-- CreateIndex
CREATE INDEX "SkillDestinationSyncRepositoryPropagation_originSyncId_idx" ON "SkillDestinationSyncRepositoryPropagation"("originSyncId");

-- CreateIndex
CREATE INDEX "SkillDestinationSyncRepositoryPropagation_skillRepositoryOi_idx" ON "SkillDestinationSyncRepositoryPropagation"("skillRepositoryOid");

-- CreateIndex
CREATE UNIQUE INDEX "SkillDestinationSyncRepositoryPropagation_skillDestinationS_key" ON "SkillDestinationSyncRepositoryPropagation"("skillDestinationSyncOid", "skillRepositoryOid");

-- CreateIndex
CREATE INDEX "SkillOriginChangeNotificationCursor_leaseUntil_idx" ON "SkillOriginChangeNotificationCursor"("leaseUntil");

-- CreateIndex
CREATE UNIQUE INDEX "SkillParticipant_id_key" ON "SkillParticipant"("id");

-- CreateIndex
CREATE INDEX "SkillParticipant_resourceActorOid_idx" ON "SkillParticipant"("resourceActorOid");

-- CreateIndex
CREATE UNIQUE INDEX "SkillParticipant_skillOid_resourceActorOid_key" ON "SkillParticipant"("skillOid", "resourceActorOid");

-- CreateIndex
CREATE UNIQUE INDEX "SkillTemplate_id_key" ON "SkillTemplate"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SkillTemplate_systemIdentifier_key" ON "SkillTemplate"("systemIdentifier");

-- CreateIndex
CREATE UNIQUE INDEX "SkillTemplate_storeTemplateOid_key" ON "SkillTemplate"("storeTemplateOid");

-- CreateIndex
CREATE INDEX "SkillTemplate_instanceOid_status_idx" ON "SkillTemplate"("instanceOid", "status");

-- CreateIndex
CREATE INDEX "SkillTemplate_instanceOid_storeTemplateId_idx" ON "SkillTemplate"("instanceOid", "storeTemplateId");

-- CreateIndex
CREATE UNIQUE INDEX "ResourceTenant_id_key" ON "ResourceTenant"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ResourceTenant_identifier_key" ON "ResourceTenant"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "ResourceGroup_id_key" ON "ResourceGroup"("id");

-- CreateIndex
CREATE INDEX "ResourceGroup_resourceTenantOid_idx" ON "ResourceGroup"("resourceTenantOid");

-- CreateIndex
CREATE UNIQUE INDEX "ResourceGroup_resourceTenantOid_identifier_key" ON "ResourceGroup"("resourceTenantOid", "identifier");

-- CreateIndex
CREATE UNIQUE INDEX "ResourceActor_id_key" ON "ResourceActor"("id");

-- CreateIndex
CREATE INDEX "ResourceActor_consumerOid_idx" ON "ResourceActor"("consumerOid");

-- CreateIndex
CREATE INDEX "ResourceActor_consumerProfileOid_idx" ON "ResourceActor"("consumerProfileOid");

-- CreateIndex
CREATE UNIQUE INDEX "ResourceActor_resourceTenantOid_identifier_key" ON "ResourceActor"("resourceTenantOid", "identifier");

-- CreateIndex
CREATE UNIQUE INDEX "ResourceActor_resourceTenantOid_consumerProfileOid_key" ON "ResourceActor"("resourceTenantOid", "consumerProfileOid");

-- CreateIndex
CREATE UNIQUE INDEX "ResourceActor_resourceTenantOid_organizationActorOid_key" ON "ResourceActor"("resourceTenantOid", "organizationActorOid");

-- CreateIndex
CREATE UNIQUE INDEX "ResourceActor_projectOid_identifier_key" ON "ResourceActor"("projectOid", "identifier");

-- CreateIndex
CREATE UNIQUE INDEX "ResourceActor_projectOid_consumerProfileOid_key" ON "ResourceActor"("projectOid", "consumerProfileOid");

-- CreateIndex
CREATE UNIQUE INDEX "ResourceActor_projectOid_organizationActorOid_key" ON "ResourceActor"("projectOid", "organizationActorOid");

-- CreateIndex
CREATE UNIQUE INDEX "User_id_key" ON "User"("id");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_resourceTenantOid_key" ON "User"("resourceTenantOid");

-- CreateIndex
CREATE UNIQUE INDEX "User_resourceGroupOid_key" ON "User"("resourceGroupOid");

-- CreateIndex
CREATE UNIQUE INDEX "UserSession_id_key" ON "UserSession"("id");

-- CreateIndex
CREATE UNIQUE INDEX "UserSession_clientSecret_key" ON "UserSession"("clientSecret");

-- CreateIndex
CREATE UNIQUE INDEX "WebDiscovery_id_key" ON "WebDiscovery"("id");

-- CreateIndex
CREATE UNIQUE INDEX "WebDiscovery_urlKey_key" ON "WebDiscovery"("urlKey");

-- CreateIndex
CREATE INDEX "WebDiscovery_status_leaseExpiresAt_idx" ON "WebDiscovery"("status", "leaseExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebPage_id_key" ON "WebPage"("id");

-- CreateIndex
CREATE UNIQUE INDEX "WebPage_url_key" ON "WebPage"("url");

-- CreateIndex
CREATE UNIQUE INDEX "EventDeliveryIntent_id_key" ON "EventDeliveryIntent"("id");

-- CreateIndex
CREATE INDEX "EventDeliveryIntent_organizationOid_createdAt_idx" ON "EventDeliveryIntent"("organizationOid", "createdAt");

-- CreateIndex
CREATE INDEX "EventDeliveryIntent_instanceOid_createdAt_idx" ON "EventDeliveryIntent"("instanceOid", "createdAt");

-- CreateIndex
CREATE INDEX "EventDeliveryIntent_eventDestinationOid_createdAt_idx" ON "EventDeliveryIntent"("eventDestinationOid", "createdAt");

-- CreateIndex
CREATE INDEX "EventDeliveryIntent_status_nextAttemptAt_idx" ON "EventDeliveryIntent"("status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "EventDeliveryIntent_systemEventOid_eventDestinationOid_key" ON "EventDeliveryIntent"("systemEventOid", "eventDestinationOid");

-- CreateIndex
CREATE UNIQUE INDEX "EventDeliveryAttempt_id_key" ON "EventDeliveryAttempt"("id");

-- CreateIndex
CREATE INDEX "EventDeliveryAttempt_intentOid_attemptNumber_idx" ON "EventDeliveryAttempt"("intentOid", "attemptNumber");

-- CreateIndex
CREATE INDEX "EventDeliveryAttempt_organizationOid_createdAt_idx" ON "EventDeliveryAttempt"("organizationOid", "createdAt");

-- CreateIndex
CREATE INDEX "EventDeliveryAttempt_status_createdAt_idx" ON "EventDeliveryAttempt"("status", "createdAt");

-- CreateIndex
CREATE INDEX "EventDeliveryAttempt_detailsStorageKey_idx" ON "EventDeliveryAttempt"("detailsStorageKey");

-- CreateIndex
CREATE UNIQUE INDEX "EventDestination_id_key" ON "EventDestination"("id");

-- CreateIndex
CREATE UNIQUE INDEX "EventDestination_webhookDestinationOid_key" ON "EventDestination"("webhookDestinationOid");

-- CreateIndex
CREATE INDEX "EventDestination_organizationOid_status_idx" ON "EventDestination"("organizationOid", "status");

-- CreateIndex
CREATE UNIQUE INDEX "EventDestinationListener_id_key" ON "EventDestinationListener"("id");

-- CreateIndex
CREATE INDEX "EventDestinationListener_eventDestinationOid_idx" ON "EventDestinationListener"("eventDestinationOid");

-- CreateIndex
CREATE INDEX "EventDestinationListener_instanceOid_idx" ON "EventDestinationListener"("instanceOid");

-- CreateIndex
CREATE INDEX "EventDestinationListener_instanceOid_type_idx" ON "EventDestinationListener"("instanceOid", "type");

-- CreateIndex
CREATE INDEX "EventDestinationListener_type_callbackId_idx" ON "EventDestinationListener"("type", "callbackId");

-- CreateIndex
CREATE INDEX "EventDestinationListener_type_chatConnectionId_idx" ON "EventDestinationListener"("type", "chatConnectionId");

-- CreateIndex
CREATE INDEX "EventDestinationListener_type_providerId_idx" ON "EventDestinationListener"("type", "providerId");

-- CreateIndex
CREATE INDEX "EventDestinationListener_eventTypes_idx" ON "EventDestinationListener" USING GIN ("eventTypes");

-- CreateIndex
CREATE INDEX "EventDestinationListener_triggers_idx" ON "EventDestinationListener" USING GIN ("triggers");

-- CreateIndex
CREATE UNIQUE INDEX "SystemEvent_id_key" ON "SystemEvent"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SystemEvent_callbackEventId_key" ON "SystemEvent"("callbackEventId");

-- CreateIndex
CREATE UNIQUE INDEX "SystemEvent_chatEventId_key" ON "SystemEvent"("chatEventId");

-- CreateIndex
CREATE INDEX "SystemEvent_organizationOid_createdAt_idx" ON "SystemEvent"("organizationOid", "createdAt");

-- CreateIndex
CREATE INDEX "SystemEvent_instanceOid_createdAt_idx" ON "SystemEvent"("instanceOid", "createdAt");

-- CreateIndex
CREATE INDEX "SystemEvent_createdAt_id_idx" ON "SystemEvent"("createdAt", "id");

-- CreateIndex
CREATE INDEX "SystemEvent_eventType_idx" ON "SystemEvent"("eventType");

-- CreateIndex
CREATE INDEX "SystemEvent_callbackId_callbackTriggerKey_idx" ON "SystemEvent"("callbackId", "callbackTriggerKey");

-- CreateIndex
CREATE INDEX "SystemEvent_chatConnectionId_eventType_idx" ON "SystemEvent"("chatConnectionId", "eventType");

-- CreateIndex
CREATE INDEX "SystemEvent_providerId_eventType_idx" ON "SystemEvent"("providerId", "eventType");

-- CreateIndex
CREATE INDEX "SystemEvent_payloadStorageKey_idx" ON "SystemEvent"("payloadStorageKey");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookDestination_id_key" ON "WebhookDestination"("id");

-- AddForeignKey
ALTER TABLE "AccessTag" ADD CONSTRAINT "AccessTag_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessTagPolicy" ADD CONSTRAINT "AccessTagPolicy_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessTagEntity" ADD CONSTRAINT "AccessTagEntity_accessTagOid_fkey" FOREIGN KEY ("accessTagOid") REFERENCES "AccessTag"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessTagEntity" ADD CONSTRAINT "AccessTagEntity_accessTagPolicyOid_fkey" FOREIGN KEY ("accessTagPolicyOid") REFERENCES "AccessTagPolicy"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessTagEntity" ADD CONSTRAINT "AccessTagEntity_magicMcpTokenOid_fkey" FOREIGN KEY ("magicMcpTokenOid") REFERENCES "MagicMcpToken"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessTagEntity" ADD CONSTRAINT "AccessTagEntity_magicMcpServerOid_fkey" FOREIGN KEY ("magicMcpServerOid") REFERENCES "MagicMcpServer"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessTagEntity" ADD CONSTRAINT "AccessTagEntity_magicMcpEndpointOid_fkey" FOREIGN KEY ("magicMcpEndpointOid") REFERENCES "MagicMcpEndpoint"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessTagEntity" ADD CONSTRAINT "AccessTagEntity_providerTemplateOid_fkey" FOREIGN KEY ("providerTemplateOid") REFERENCES "ProviderTemplate"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessTagEntity" ADD CONSTRAINT "AccessTagEntity_skillOid_fkey" FOREIGN KEY ("skillOid") REFERENCES "Skill"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessTagEntity" ADD CONSTRAINT "AccessTagEntity_skillTemplateOid_fkey" FOREIGN KEY ("skillTemplateOid") REFERENCES "SkillTemplate"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessTagEntity" ADD CONSTRAINT "AccessTagEntity_skillGroupOid_fkey" FOREIGN KEY ("skillGroupOid") REFERENCES "SkillGroup"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessTagEntity" ADD CONSTRAINT "AccessTagEntity_skillMarketplaceOid_fkey" FOREIGN KEY ("skillMarketplaceOid") REFERENCES "SkillMarketplace"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessTagEntity" ADD CONSTRAINT "AccessTagEntity_skillPluginOid_fkey" FOREIGN KEY ("skillPluginOid") REFERENCES "SkillPlugin"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessTagEntity" ADD CONSTRAINT "AccessTagEntity_storeOid_fkey" FOREIGN KEY ("storeOid") REFERENCES "Store"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FineGrainedKey" ADD CONSTRAINT "FineGrainedKey_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FineGrainedKey" ADD CONSTRAINT "FineGrainedKey_accessTagOid_fkey" FOREIGN KEY ("accessTagOid") REFERENCES "AccessTag"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionClientSecretReference" ADD CONSTRAINT "SessionClientSecretReference_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionClientSecretReference" ADD CONSTRAINT "SessionClientSecretReference_fineGrainedKeyOid_fkey" FOREIGN KEY ("fineGrainedKeyOid") REFERENCES "FineGrainedKey"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_ownerOrganizationOid_fkey" FOREIGN KEY ("ownerOrganizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_rootOwnerAccountOid_fkey" FOREIGN KEY ("rootOwnerAccountOid") REFERENCES "Account"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_ownerAccountOid_fkey" FOREIGN KEY ("ownerAccountOid") REFERENCES "Account"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_cellOid_fkey" FOREIGN KEY ("cellOid") REFERENCES "Cell"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountDomain" ADD CONSTRAINT "AccountDomain_accountOid_fkey" FOREIGN KEY ("accountOid") REFERENCES "Account"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountDomainVerification" ADD CONSTRAINT "AccountDomainVerification_accountDomainOid_fkey" FOREIGN KEY ("accountDomainOid") REFERENCES "AccountDomain"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountDomainVerificationStatusChange" ADD CONSTRAINT "AccountDomainVerificationStatusChange_accountDomainVerific_fkey" FOREIGN KEY ("accountDomainVerificationOid") REFERENCES "AccountDomainVerification"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountDomainVerificationStatusChange" ADD CONSTRAINT "AccountDomainVerificationStatusChange_accountDomainOid_fkey" FOREIGN KEY ("accountDomainOid") REFERENCES "AccountDomain"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GlobalProfileEmail" ADD CONSTRAINT "GlobalProfileEmail_globalProfileOid_fkey" FOREIGN KEY ("globalProfileOid") REFERENCES "GlobalProfile"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Namespace" ADD CONSTRAINT "Namespace_compartmentOid_fkey" FOREIGN KEY ("compartmentOid") REFERENCES "NamespaceCompartment"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Namespace" ADD CONSTRAINT "Namespace_accountOid_fkey" FOREIGN KEY ("accountOid") REFERENCES "Account"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NamespaceProperty" ADD CONSTRAINT "NamespaceProperty_namespaceOid_fkey" FOREIGN KEY ("namespaceOid") REFERENCES "Namespace"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NamespaceProperty" ADD CONSTRAINT "NamespaceProperty_workspaceOid_fkey" FOREIGN KEY ("workspaceOid") REFERENCES "Workspace"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NamespaceProperty" ADD CONSTRAINT "NamespaceProperty_accountOid_fkey" FOREIGN KEY ("accountOid") REFERENCES "Account"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NamespaceProperty" ADD CONSTRAINT "NamespaceProperty_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NamespaceProperty" ADD CONSTRAINT "NamespaceProperty_portalOid_fkey" FOREIGN KEY ("portalOid") REFERENCES "Portal"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_accountOid_fkey" FOREIGN KEY ("accountOid") REFERENCES "Account"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_portalOid_fkey" FOREIGN KEY ("portalOid") REFERENCES "Portal"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceProfile" ADD CONSTRAINT "WorkspaceProfile_accountOid_fkey" FOREIGN KEY ("accountOid") REFERENCES "Account"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceProfile" ADD CONSTRAINT "WorkspaceProfile_workspaceOid_fkey" FOREIGN KEY ("workspaceOid") REFERENCES "Workspace"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceProfile" ADD CONSTRAINT "WorkspaceProfile_globalProfileOid_fkey" FOREIGN KEY ("globalProfileOid") REFERENCES "GlobalProfile"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceProfile" ADD CONSTRAINT "WorkspaceProfile_userOid_fkey" FOREIGN KEY ("userOid") REFERENCES "User"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceProfile" ADD CONSTRAINT "WorkspaceProfile_organizationMemberOid_fkey" FOREIGN KEY ("organizationMemberOid") REFERENCES "OrganizationMember"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceProfile" ADD CONSTRAINT "WorkspaceProfile_consumerOid_fkey" FOREIGN KEY ("consumerOid") REFERENCES "Consumer"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceProfile" ADD CONSTRAINT "WorkspaceProfile_instanceConsumerOid_fkey" FOREIGN KEY ("instanceConsumerOid") REFERENCES "InstanceConsumer"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceProfile" ADD CONSTRAINT "WorkspaceProfile_consumerProfileOid_fkey" FOREIGN KEY ("consumerProfileOid") REFERENCES "ConsumerProfile"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceInvite" ADD CONSTRAINT "WorkspaceInvite_accountOid_fkey" FOREIGN KEY ("accountOid") REFERENCES "Account"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceInvite" ADD CONSTRAINT "WorkspaceInvite_workspaceOid_fkey" FOREIGN KEY ("workspaceOid") REFERENCES "Workspace"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceInvite" ADD CONSTRAINT "WorkspaceInvite_globalProfileOid_fkey" FOREIGN KEY ("globalProfileOid") REFERENCES "GlobalProfile"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceInvite" ADD CONSTRAINT "WorkspaceInvite_consumerInviteOid_fkey" FOREIGN KEY ("consumerInviteOid") REFERENCES "ConsumerInvite"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceInvite" ADD CONSTRAINT "WorkspaceInvite_organizationInviteOid_fkey" FOREIGN KEY ("organizationInviteOid") REFERENCES "OrganizationInvite"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceGroup" ADD CONSTRAINT "WorkspaceGroup_workspaceOid_fkey" FOREIGN KEY ("workspaceOid") REFERENCES "Workspace"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceGroup" ADD CONSTRAINT "WorkspaceGroup_accountOid_fkey" FOREIGN KEY ("accountOid") REFERENCES "Account"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspacePolicy" ADD CONSTRAINT "WorkspacePolicy_workspaceOid_fkey" FOREIGN KEY ("workspaceOid") REFERENCES "Workspace"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspacePolicy" ADD CONSTRAINT "WorkspacePolicy_accountOid_fkey" FOREIGN KEY ("accountOid") REFERENCES "Account"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspacePolicyAssignment" ADD CONSTRAINT "WorkspacePolicyAssignment_workspacePolicyOid_fkey" FOREIGN KEY ("workspacePolicyOid") REFERENCES "WorkspacePolicy"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspacePolicyAssignment" ADD CONSTRAINT "WorkspacePolicyAssignment_workspaceGroupOid_fkey" FOREIGN KEY ("workspaceGroupOid") REFERENCES "WorkspaceGroup"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspacePolicyAssignment" ADD CONSTRAINT "WorkspacePolicyAssignment_workspaceProfileOid_fkey" FOREIGN KEY ("workspaceProfileOid") REFERENCES "WorkspaceProfile"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceGroupAssignment" ADD CONSTRAINT "WorkspaceGroupAssignment_workspaceGroupOid_fkey" FOREIGN KEY ("workspaceGroupOid") REFERENCES "WorkspaceGroup"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceGroupAssignment" ADD CONSTRAINT "WorkspaceGroupAssignment_workspaceProfileOid_fkey" FOREIGN KEY ("workspaceProfileOid") REFERENCES "WorkspaceProfile"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationActorOid_fkey" FOREIGN KEY ("organizationActorOid") REFERENCES "OrganizationActor"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_eventOid_fkey" FOREIGN KEY ("eventOid") REFERENCES "Event"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLogDirtyTracker" ADD CONSTRAINT "AuditLogDirtyTracker_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_organizationActorOid_fkey" FOREIGN KEY ("organizationActorOid") REFERENCES "OrganizationActor"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLogStream" ADD CONSTRAINT "AuditLogStream_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLogStreamEvent" ADD CONSTRAINT "AuditLogStreamEvent_auditLogStreamOid_fkey" FOREIGN KEY ("auditLogStreamOid") REFERENCES "AuditLogStream"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLogStreamRun" ADD CONSTRAINT "AuditLogStreamRun_auditLogStreamOid_fkey" FOREIGN KEY ("auditLogStreamOid") REFERENCES "AuditLogStream"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerAccess" ADD CONSTRAINT "ConsumerAccess_surfaceOid_fkey" FOREIGN KEY ("surfaceOid") REFERENCES "ConsumerSurface"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerAccess" ADD CONSTRAINT "ConsumerAccess_consumerGroupOid_fkey" FOREIGN KEY ("consumerGroupOid") REFERENCES "ConsumerGroup"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerAccess" ADD CONSTRAINT "ConsumerAccess_providerTemplateOid_fkey" FOREIGN KEY ("providerTemplateOid") REFERENCES "ProviderTemplate"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerAccess" ADD CONSTRAINT "ConsumerAccess_magicMcpServerOid_fkey" FOREIGN KEY ("magicMcpServerOid") REFERENCES "MagicMcpServer"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerAccess" ADD CONSTRAINT "ConsumerAccess_skillOid_fkey" FOREIGN KEY ("skillOid") REFERENCES "Skill"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerAccess" ADD CONSTRAINT "ConsumerAccess_skillTemplateOid_fkey" FOREIGN KEY ("skillTemplateOid") REFERENCES "SkillTemplate"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerAccess" ADD CONSTRAINT "ConsumerAccess_skillGroupOid_fkey" FOREIGN KEY ("skillGroupOid") REFERENCES "SkillGroup"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerAccess" ADD CONSTRAINT "ConsumerAccess_skillMarketplaceOid_fkey" FOREIGN KEY ("skillMarketplaceOid") REFERENCES "SkillMarketplace"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerAccess" ADD CONSTRAINT "ConsumerAccess_skillPluginOid_fkey" FOREIGN KEY ("skillPluginOid") REFERENCES "SkillPlugin"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerAccess" ADD CONSTRAINT "ConsumerAccess_listingOid_fkey" FOREIGN KEY ("listingOid") REFERENCES "ConsumerAccessListing"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerAccessListing" ADD CONSTRAINT "ConsumerAccessListing_surfaceOid_fkey" FOREIGN KEY ("surfaceOid") REFERENCES "ConsumerSurface"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerAccessListing" ADD CONSTRAINT "ConsumerAccessListing_providerTemplateOid_fkey" FOREIGN KEY ("providerTemplateOid") REFERENCES "ProviderTemplate"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerAccessListing" ADD CONSTRAINT "ConsumerAccessListing_magicMcpServerOid_fkey" FOREIGN KEY ("magicMcpServerOid") REFERENCES "MagicMcpServer"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerAccessListing" ADD CONSTRAINT "ConsumerAccessListing_skillOid_fkey" FOREIGN KEY ("skillOid") REFERENCES "Skill"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerAccessListing" ADD CONSTRAINT "ConsumerAccessListing_skillTemplateOid_fkey" FOREIGN KEY ("skillTemplateOid") REFERENCES "SkillTemplate"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerAccessListing" ADD CONSTRAINT "ConsumerAccessListing_skillGroupOid_fkey" FOREIGN KEY ("skillGroupOid") REFERENCES "SkillGroup"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerAccessListing" ADD CONSTRAINT "ConsumerAccessListing_skillMarketplaceOid_fkey" FOREIGN KEY ("skillMarketplaceOid") REFERENCES "SkillMarketplace"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerAccessListing" ADD CONSTRAINT "ConsumerAccessListing_skillPluginOid_fkey" FOREIGN KEY ("skillPluginOid") REFERENCES "SkillPlugin"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerAccessRequest" ADD CONSTRAINT "ConsumerAccessRequest_surfaceOid_fkey" FOREIGN KEY ("surfaceOid") REFERENCES "ConsumerSurface"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerAccessRequest" ADD CONSTRAINT "ConsumerAccessRequest_consumerProfileOid_fkey" FOREIGN KEY ("consumerProfileOid") REFERENCES "ConsumerProfile"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerAccessRequest" ADD CONSTRAINT "ConsumerAccessRequest_providerTemplateOid_fkey" FOREIGN KEY ("providerTemplateOid") REFERENCES "ProviderTemplate"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerAccessRequest" ADD CONSTRAINT "ConsumerAccessRequest_magicMcpServerOid_fkey" FOREIGN KEY ("magicMcpServerOid") REFERENCES "MagicMcpServer"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerActor" ADD CONSTRAINT "ConsumerActor_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerActor" ADD CONSTRAINT "ConsumerActor_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerActor" ADD CONSTRAINT "ConsumerActor_consumerOid_fkey" FOREIGN KEY ("consumerOid") REFERENCES "Consumer"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerActor" ADD CONSTRAINT "ConsumerActor_instanceConsumerOid_fkey" FOREIGN KEY ("instanceConsumerOid") REFERENCES "InstanceConsumer"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerActor" ADD CONSTRAINT "ConsumerActor_consumerProfileOid_fkey" FOREIGN KEY ("consumerProfileOid") REFERENCES "ConsumerProfile"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerActor" ADD CONSTRAINT "ConsumerActor_identityActorOid_fkey" FOREIGN KEY ("identityActorOid") REFERENCES "IdentityActor"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerActor" ADD CONSTRAINT "ConsumerActor_defaultForInstanceConsumerOid_fkey" FOREIGN KEY ("defaultForInstanceConsumerOid") REFERENCES "InstanceConsumer"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerSession" ADD CONSTRAINT "ConsumerSession_consumerProfileOid_fkey" FOREIGN KEY ("consumerProfileOid") REFERENCES "ConsumerProfile"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerSession" ADD CONSTRAINT "ConsumerSession_oauthAuthorizationOid_fkey" FOREIGN KEY ("oauthAuthorizationOid") REFERENCES "OAuthAuthorization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerAuthExchange" ADD CONSTRAINT "ConsumerAuthExchange_surfaceOid_fkey" FOREIGN KEY ("surfaceOid") REFERENCES "ConsumerSurface"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerAuthExchange" ADD CONSTRAINT "ConsumerAuthExchange_consumerSessionOid_fkey" FOREIGN KEY ("consumerSessionOid") REFERENCES "ConsumerSession"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerProviderSetupSessionBinding" ADD CONSTRAINT "ConsumerProviderSetupSessionBinding_consumerProfileOid_fkey" FOREIGN KEY ("consumerProfileOid") REFERENCES "ConsumerProfile"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerProviderSetupSessionBinding" ADD CONSTRAINT "ConsumerProviderSetupSessionBinding_providerTemplateOid_fkey" FOREIGN KEY ("providerTemplateOid") REFERENCES "ProviderTemplate"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerProviderSetupSessionBinding" ADD CONSTRAINT "ConsumerProviderSetupSessionBinding_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consumer" ADD CONSTRAINT "Consumer_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consumer" ADD CONSTRAINT "Consumer_organizationMemberOid_fkey" FOREIGN KEY ("organizationMemberOid") REFERENCES "OrganizationMember"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consumer" ADD CONSTRAINT "Consumer_organizationActorOid_fkey" FOREIGN KEY ("organizationActorOid") REFERENCES "OrganizationActor"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consumer" ADD CONSTRAINT "Consumer_globalProfileOid_fkey" FOREIGN KEY ("globalProfileOid") REFERENCES "GlobalProfile"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consumer" ADD CONSTRAINT "Consumer_userOid_fkey" FOREIGN KEY ("userOid") REFERENCES "User"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstanceConsumer" ADD CONSTRAINT "InstanceConsumer_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstanceConsumer" ADD CONSTRAINT "InstanceConsumer_consumerOid_fkey" FOREIGN KEY ("consumerOid") REFERENCES "Consumer"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstanceConsumer" ADD CONSTRAINT "InstanceConsumer_organizationMemberOid_fkey" FOREIGN KEY ("organizationMemberOid") REFERENCES "OrganizationMember"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstanceConsumer" ADD CONSTRAINT "InstanceConsumer_organizationActorOid_fkey" FOREIGN KEY ("organizationActorOid") REFERENCES "OrganizationActor"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerProfile" ADD CONSTRAINT "ConsumerProfile_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerProfile" ADD CONSTRAINT "ConsumerProfile_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerProfile" ADD CONSTRAINT "ConsumerProfile_surfaceOid_fkey" FOREIGN KEY ("surfaceOid") REFERENCES "ConsumerSurface"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerProfile" ADD CONSTRAINT "ConsumerProfile_consumerOid_fkey" FOREIGN KEY ("consumerOid") REFERENCES "Consumer"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerProfile" ADD CONSTRAINT "ConsumerProfile_accessTagOid_fkey" FOREIGN KEY ("accessTagOid") REFERENCES "AccessTag"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerProfile" ADD CONSTRAINT "ConsumerProfile_organizationMemberOid_fkey" FOREIGN KEY ("organizationMemberOid") REFERENCES "OrganizationMember"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerProfile" ADD CONSTRAINT "ConsumerProfile_organizationActorOid_fkey" FOREIGN KEY ("organizationActorOid") REFERENCES "OrganizationActor"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerProfile" ADD CONSTRAINT "ConsumerProfile_personalConsumerGroupOid_fkey" FOREIGN KEY ("personalConsumerGroupOid") REFERENCES "ConsumerGroup"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerInvite" ADD CONSTRAINT "ConsumerInvite_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerInvite" ADD CONSTRAINT "ConsumerInvite_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerInvite" ADD CONSTRAINT "ConsumerInvite_surfaceOid_fkey" FOREIGN KEY ("surfaceOid") REFERENCES "ConsumerSurface"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerInvite" ADD CONSTRAINT "ConsumerInvite_consumerOid_fkey" FOREIGN KEY ("consumerOid") REFERENCES "Consumer"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerInvite" ADD CONSTRAINT "ConsumerInvite_consumerProfileOid_fkey" FOREIGN KEY ("consumerProfileOid") REFERENCES "ConsumerProfile"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerInvite" ADD CONSTRAINT "ConsumerInvite_invitedByOid_fkey" FOREIGN KEY ("invitedByOid") REFERENCES "OrganizationActor"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerProfileGroup" ADD CONSTRAINT "ConsumerProfileGroup_profileOid_fkey" FOREIGN KEY ("profileOid") REFERENCES "ConsumerProfile"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerProfileGroup" ADD CONSTRAINT "ConsumerProfileGroup_groupOid_fkey" FOREIGN KEY ("groupOid") REFERENCES "ConsumerGroup"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerOrganizationActor" ADD CONSTRAINT "ConsumerOrganizationActor_consumerOid_fkey" FOREIGN KEY ("consumerOid") REFERENCES "Consumer"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerOrganizationActor" ADD CONSTRAINT "ConsumerOrganizationActor_organizationActorOid_fkey" FOREIGN KEY ("organizationActorOid") REFERENCES "OrganizationActor"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerClient" ADD CONSTRAINT "ConsumerClient_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerClient" ADD CONSTRAINT "ConsumerClient_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerClient" ADD CONSTRAINT "ConsumerClient_consumerSurfaceOid_fkey" FOREIGN KEY ("consumerSurfaceOid") REFERENCES "ConsumerSurface"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerAuthClient" ADD CONSTRAINT "ConsumerAuthClient_magicMcpServerOid_fkey" FOREIGN KEY ("magicMcpServerOid") REFERENCES "MagicMcpServer"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerAuthClient" ADD CONSTRAINT "ConsumerAuthClient_magicMcpEndpointOid_fkey" FOREIGN KEY ("magicMcpEndpointOid") REFERENCES "MagicMcpEndpoint"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerAuthClient" ADD CONSTRAINT "ConsumerAuthClient_skillPluginOid_fkey" FOREIGN KEY ("skillPluginOid") REFERENCES "SkillPlugin"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerAuthClient" ADD CONSTRAINT "ConsumerAuthClient_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerAuthClient" ADD CONSTRAINT "ConsumerAuthClient_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerAuthClient" ADD CONSTRAINT "ConsumerAuthClient_consumerSurfaceOid_fkey" FOREIGN KEY ("consumerSurfaceOid") REFERENCES "ConsumerSurface"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerAuthClient" ADD CONSTRAINT "ConsumerAuthClient_consumerClientOid_fkey" FOREIGN KEY ("consumerClientOid") REFERENCES "ConsumerClient"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerAuthClientSurface" ADD CONSTRAINT "ConsumerAuthClientSurface_consumerSurfaceOid_fkey" FOREIGN KEY ("consumerSurfaceOid") REFERENCES "ConsumerSurface"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerAuthClientSurface" ADD CONSTRAINT "ConsumerAuthClientSurface_consumerAuthClientOid_fkey" FOREIGN KEY ("consumerAuthClientOid") REFERENCES "ConsumerAuthClient"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerAuthClientSurface" ADD CONSTRAINT "ConsumerAuthClientSurface_consumerClientOid_fkey" FOREIGN KEY ("consumerClientOid") REFERENCES "ConsumerClient"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerAuthAttempt" ADD CONSTRAINT "ConsumerAuthAttempt_consumerAuthClientOid_fkey" FOREIGN KEY ("consumerAuthClientOid") REFERENCES "ConsumerAuthClient"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerAuthAttempt" ADD CONSTRAINT "ConsumerAuthAttempt_consumerProfileOid_fkey" FOREIGN KEY ("consumerProfileOid") REFERENCES "ConsumerProfile"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerAuthAttempt" ADD CONSTRAINT "ConsumerAuthAttempt_magicMcpEndpointOid_fkey" FOREIGN KEY ("magicMcpEndpointOid") REFERENCES "MagicMcpEndpoint"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerAuthAttempt" ADD CONSTRAINT "ConsumerAuthAttempt_consumerIntegrationEndpointOid_fkey" FOREIGN KEY ("consumerIntegrationEndpointOid") REFERENCES "ConsumerIntegrationEndpoint"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerAuthAttempt" ADD CONSTRAINT "ConsumerAuthAttempt_magicMcpTokenOid_fkey" FOREIGN KEY ("magicMcpTokenOid") REFERENCES "MagicMcpToken"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerAuthAttempt" ADD CONSTRAINT "ConsumerAuthAttempt_skillPluginOid_fkey" FOREIGN KEY ("skillPluginOid") REFERENCES "SkillPlugin"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerAuthTestAuthorization" ADD CONSTRAINT "ConsumerAuthTestAuthorization_consumerAuthClientOid_fkey" FOREIGN KEY ("consumerAuthClientOid") REFERENCES "ConsumerAuthClient"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerAuthTestAuthorization" ADD CONSTRAINT "ConsumerAuthTestAuthorization_consumerSurfaceOid_fkey" FOREIGN KEY ("consumerSurfaceOid") REFERENCES "ConsumerSurface"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerAuthTestAuthorization" ADD CONSTRAINT "ConsumerAuthTestAuthorization_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerAuthTestAuthorization" ADD CONSTRAINT "ConsumerAuthTestAuthorization_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerAuthTestAuthorization" ADD CONSTRAINT "ConsumerAuthTestAuthorization_consumerProfileOid_fkey" FOREIGN KEY ("consumerProfileOid") REFERENCES "ConsumerProfile"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerAuthTestAuthorization" ADD CONSTRAINT "ConsumerAuthTestAuthorization_magicMcpEndpointOid_fkey" FOREIGN KEY ("magicMcpEndpointOid") REFERENCES "MagicMcpEndpoint"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerAuthTestAuthorization" ADD CONSTRAINT "ConsumerAuthTestAuthorization_skillPluginOid_fkey" FOREIGN KEY ("skillPluginOid") REFERENCES "SkillPlugin"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerAuthTestAuthorization" ADD CONSTRAINT "ConsumerAuthTestAuthorization_consumerAuthAttemptOid_fkey" FOREIGN KEY ("consumerAuthAttemptOid") REFERENCES "ConsumerAuthAttempt"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerGroup" ADD CONSTRAINT "ConsumerGroup_surfaceOid_fkey" FOREIGN KEY ("surfaceOid") REFERENCES "ConsumerSurface"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerGroup" ADD CONSTRAINT "ConsumerGroup_accessTagOid_fkey" FOREIGN KEY ("accessTagOid") REFERENCES "AccessTag"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerToken" ADD CONSTRAINT "ConsumerToken_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerToken" ADD CONSTRAINT "ConsumerToken_consumerOid_fkey" FOREIGN KEY ("consumerOid") REFERENCES "Consumer"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerToken" ADD CONSTRAINT "ConsumerToken_consumerProfileOid_fkey" FOREIGN KEY ("consumerProfileOid") REFERENCES "ConsumerProfile"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerToken" ADD CONSTRAINT "ConsumerToken_magicMcpTokenOid_fkey" FOREIGN KEY ("magicMcpTokenOid") REFERENCES "MagicMcpToken"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerIntegration" ADD CONSTRAINT "ConsumerIntegration_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerIntegration" ADD CONSTRAINT "ConsumerIntegration_consumerOid_fkey" FOREIGN KEY ("consumerOid") REFERENCES "Consumer"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerIntegration" ADD CONSTRAINT "ConsumerIntegration_consumerProfileOid_fkey" FOREIGN KEY ("consumerProfileOid") REFERENCES "ConsumerProfile"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerIntegration" ADD CONSTRAINT "ConsumerIntegration_magicMcpServerOid_fkey" FOREIGN KEY ("magicMcpServerOid") REFERENCES "MagicMcpServer"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerIntegrationEndpoint" ADD CONSTRAINT "ConsumerIntegrationEndpoint_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerIntegrationEndpoint" ADD CONSTRAINT "ConsumerIntegrationEndpoint_consumerOid_fkey" FOREIGN KEY ("consumerOid") REFERENCES "Consumer"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerIntegrationEndpoint" ADD CONSTRAINT "ConsumerIntegrationEndpoint_consumerProfileOid_fkey" FOREIGN KEY ("consumerProfileOid") REFERENCES "ConsumerProfile"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerIntegrationEndpoint" ADD CONSTRAINT "ConsumerIntegrationEndpoint_magicMcpEndpointOid_fkey" FOREIGN KEY ("magicMcpEndpointOid") REFERENCES "MagicMcpEndpoint"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerIntegrationSession" ADD CONSTRAINT "ConsumerIntegrationSession_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerIntegrationSession" ADD CONSTRAINT "ConsumerIntegrationSession_consumerOid_fkey" FOREIGN KEY ("consumerOid") REFERENCES "Consumer"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerIntegrationSession" ADD CONSTRAINT "ConsumerIntegrationSession_consumerProfileOid_fkey" FOREIGN KEY ("consumerProfileOid") REFERENCES "ConsumerProfile"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerIntegrationSession" ADD CONSTRAINT "ConsumerIntegrationSession_consumerIntegrationOid_fkey" FOREIGN KEY ("consumerIntegrationOid") REFERENCES "ConsumerIntegration"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerIntegrationSession" ADD CONSTRAINT "ConsumerIntegrationSession_magicMcpSessionOid_fkey" FOREIGN KEY ("magicMcpSessionOid") REFERENCES "MagicMcpServerSubspaceSession"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Portal" ADD CONSTRAINT "Portal_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Portal" ADD CONSTRAINT "Portal_surfaceOid_fkey" FOREIGN KEY ("surfaceOid") REFERENCES "ConsumerSurface"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Portal" ADD CONSTRAINT "Portal_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Portal" ADD CONSTRAINT "Portal_portalSpecificNamespaceOid_fkey" FOREIGN KEY ("portalSpecificNamespaceOid") REFERENCES "Namespace"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderTemplate" ADD CONSTRAINT "ProviderTemplate_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderTemplate" ADD CONSTRAINT "ProviderTemplate_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerSkill" ADD CONSTRAINT "ConsumerSkill_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerSkill" ADD CONSTRAINT "ConsumerSkill_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerSkill" ADD CONSTRAINT "ConsumerSkill_surfaceOid_fkey" FOREIGN KEY ("surfaceOid") REFERENCES "ConsumerSurface"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerSkill" ADD CONSTRAINT "ConsumerSkill_consumerProfileOid_fkey" FOREIGN KEY ("consumerProfileOid") REFERENCES "ConsumerProfile"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerSkill" ADD CONSTRAINT "ConsumerSkill_consumerOid_fkey" FOREIGN KEY ("consumerOid") REFERENCES "Consumer"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerSkill" ADD CONSTRAINT "ConsumerSkill_skillOid_fkey" FOREIGN KEY ("skillOid") REFERENCES "Skill"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerSurface" ADD CONSTRAINT "ConsumerSurface_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerSurface" ADD CONSTRAINT "ConsumerSurface_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerSurface" ADD CONSTRAINT "ConsumerSurface_consumerAuthTenantOid_fkey" FOREIGN KEY ("consumerAuthTenantOid") REFERENCES "ConsumerAuthTenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerSurface" ADD CONSTRAINT "ConsumerSurface_publishableApiKeyOid_fkey" FOREIGN KEY ("publishableApiKeyOid") REFERENCES "ApiKey"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerSurface" ADD CONSTRAINT "ConsumerSurface_managedEveryoneGroupOid_fkey" FOREIGN KEY ("managedEveryoneGroupOid") REFERENCES "ConsumerGroup"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerSurfaceProviderGroup" ADD CONSTRAINT "ConsumerSurfaceProviderGroup_consumerSurfaceOid_fkey" FOREIGN KEY ("consumerSurfaceOid") REFERENCES "ConsumerSurface"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerSurfaceProviderGroupListing" ADD CONSTRAINT "ConsumerSurfaceProviderGroupListing_consumerSurfaceProvide_fkey" FOREIGN KEY ("consumerSurfaceProviderGroupOid") REFERENCES "ConsumerSurfaceProviderGroup"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerSurfaceProviderGroupListing" ADD CONSTRAINT "ConsumerSurfaceProviderGroupListing_consumerAccessListingO_fkey" FOREIGN KEY ("consumerAccessListingOid") REFERENCES "ConsumerAccessListing"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerAuthTenant" ADD CONSTRAINT "ConsumerAuthTenant_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutgoingEmail" ADD CONSTRAINT "OutgoingEmail_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "EmailIdentity"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutgoingEmailDestination" ADD CONSTRAINT "OutgoingEmailDestination_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "OutgoingEmail"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutgoingEmailContent" ADD CONSTRAINT "OutgoingEmailContent_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "OutgoingEmail"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutgoingEmailSend" ADD CONSTRAINT "OutgoingEmailSend_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "OutgoingEmailDestination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_resourceTenantOid_fkey" FOREIGN KEY ("resourceTenantOid") REFERENCES "ResourceTenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_resourceGroupOid_fkey" FOREIGN KEY ("resourceGroupOid") REFERENCES "ResourceGroup"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_contentOid_fkey" FOREIGN KEY ("contentOid") REFERENCES "DocumentContent"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_fileOid_fkey" FOREIGN KEY ("fileOid") REFERENCES "File"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_currentVersionOid_fkey" FOREIGN KEY ("currentVersionOid") REFERENCES "DocumentVersion"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_parentDocumentOid_fkey" FOREIGN KEY ("parentDocumentOid") REFERENCES "Document"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_createdByResourceActorOid_fkey" FOREIGN KEY ("createdByResourceActorOid") REFERENCES "ResourceActor"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentParticipant" ADD CONSTRAINT "DocumentParticipant_documentOid_fkey" FOREIGN KEY ("documentOid") REFERENCES "Document"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentParticipant" ADD CONSTRAINT "DocumentParticipant_resourceActorOid_fkey" FOREIGN KEY ("resourceActorOid") REFERENCES "ResourceActor"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentParticipant" ADD CONSTRAINT "DocumentParticipant_storeParticipantOid_fkey" FOREIGN KEY ("storeParticipantOid") REFERENCES "StoreParticipantPrincipal"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_resourceTenantOid_fkey" FOREIGN KEY ("resourceTenantOid") REFERENCES "ResourceTenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_resourceGroupOid_fkey" FOREIGN KEY ("resourceGroupOid") REFERENCES "ResourceGroup"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_documentOid_fkey" FOREIGN KEY ("documentOid") REFERENCES "Document"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_contentOid_fkey" FOREIGN KEY ("contentOid") REFERENCES "DocumentContent"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_previousVersionOid_fkey" FOREIGN KEY ("previousVersionOid") REFERENCES "DocumentVersion"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersionEditors" ADD CONSTRAINT "DocumentVersionEditors_documentVersionOid_fkey" FOREIGN KEY ("documentVersionOid") REFERENCES "DocumentVersion"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersionEditors" ADD CONSTRAINT "DocumentVersionEditors_resourceActorOid_fkey" FOREIGN KEY ("resourceActorOid") REFERENCES "ResourceActor"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_delegatorOid_fkey" FOREIGN KEY ("delegatorOid") REFERENCES "FileContentDelegator"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_purposeOid_fkey" FOREIGN KEY ("purposeOid") REFERENCES "FilePurpose"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_userOid_fkey" FOREIGN KEY ("userOid") REFERENCES "User"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_resourceTenantOid_fkey" FOREIGN KEY ("resourceTenantOid") REFERENCES "ResourceTenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_resourceGroupOid_fkey" FOREIGN KEY ("resourceGroupOid") REFERENCES "ResourceGroup"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_createdByResourceActorOid_fkey" FOREIGN KEY ("createdByResourceActorOid") REFERENCES "ResourceActor"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FilePendingContent" ADD CONSTRAINT "FilePendingContent_fileOid_fkey" FOREIGN KEY ("fileOid") REFERENCES "File"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileLink" ADD CONSTRAINT "FileLink_fileOid_fkey" FOREIGN KEY ("fileOid") REFERENCES "File"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileLink" ADD CONSTRAINT "FileLink_resourceTenantOid_fkey" FOREIGN KEY ("resourceTenantOid") REFERENCES "ResourceTenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileLink" ADD CONSTRAINT "FileLink_resourceGroupOid_fkey" FOREIGN KEY ("resourceGroupOid") REFERENCES "ResourceGroup"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileLink" ADD CONSTRAINT "FileLink_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileLink" ADD CONSTRAINT "FileLink_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileLink" ADD CONSTRAINT "FileLink_createdByResourceActorOid_fkey" FOREIGN KEY ("createdByResourceActorOid") REFERENCES "ResourceActor"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileReference" ADD CONSTRAINT "FileReference_fileLinkOid_fkey" FOREIGN KEY ("fileLinkOid") REFERENCES "FileLink"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileReference" ADD CONSTRAINT "FileReference_resourceTenantOid_fkey" FOREIGN KEY ("resourceTenantOid") REFERENCES "ResourceTenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileReference" ADD CONSTRAINT "FileReference_resourceGroupOid_fkey" FOREIGN KEY ("resourceGroupOid") REFERENCES "ResourceGroup"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileReference" ADD CONSTRAINT "FileReference_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileReference" ADD CONSTRAINT "FileReference_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Store" ADD CONSTRAINT "Store_createdByResourceActorOid_fkey" FOREIGN KEY ("createdByResourceActorOid") REFERENCES "ResourceActor"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Store" ADD CONSTRAINT "Store_resourceTenantOid_fkey" FOREIGN KEY ("resourceTenantOid") REFERENCES "ResourceTenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Store" ADD CONSTRAINT "Store_resourceGroupOid_fkey" FOREIGN KEY ("resourceGroupOid") REFERENCES "ResourceGroup"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Store" ADD CONSTRAINT "Store_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Store" ADD CONSTRAINT "Store_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Store" ADD CONSTRAINT "Store_parentStoreOid_fkey" FOREIGN KEY ("parentStoreOid") REFERENCES "Store"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Store" ADD CONSTRAINT "Store_parentStoreTemplateOid_fkey" FOREIGN KEY ("parentStoreTemplateOid") REFERENCES "StoreTemplate"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreTemplate" ADD CONSTRAINT "StoreTemplate_resourceTenantOid_fkey" FOREIGN KEY ("resourceTenantOid") REFERENCES "ResourceTenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreTemplate" ADD CONSTRAINT "StoreTemplate_resourceGroupOid_fkey" FOREIGN KEY ("resourceGroupOid") REFERENCES "ResourceGroup"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreTemplate" ADD CONSTRAINT "StoreTemplate_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreTemplate" ADD CONSTRAINT "StoreTemplate_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreTemplate" ADD CONSTRAINT "StoreTemplate_sourceStoreOid_fkey" FOREIGN KEY ("sourceStoreOid") REFERENCES "Store"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreTemplateItem" ADD CONSTRAINT "StoreTemplateItem_storeTemplateOid_fkey" FOREIGN KEY ("storeTemplateOid") REFERENCES "StoreTemplate"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreTemplateBacking" ADD CONSTRAINT "StoreTemplateBacking_storeTemplateOid_fkey" FOREIGN KEY ("storeTemplateOid") REFERENCES "StoreTemplate"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreTemplateBacking" ADD CONSTRAINT "StoreTemplateBacking_resourceTenantOid_fkey" FOREIGN KEY ("resourceTenantOid") REFERENCES "ResourceTenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreTemplateBacking" ADD CONSTRAINT "StoreTemplateBacking_resourceGroupOid_fkey" FOREIGN KEY ("resourceGroupOid") REFERENCES "ResourceGroup"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreTemplateBacking" ADD CONSTRAINT "StoreTemplateBacking_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreTemplateBacking" ADD CONSTRAINT "StoreTemplateBacking_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreTemplateBacking" ADD CONSTRAINT "StoreTemplateBacking_storeOid_fkey" FOREIGN KEY ("storeOid") REFERENCES "Store"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreItem" ADD CONSTRAINT "StoreItem_storeOid_fkey" FOREIGN KEY ("storeOid") REFERENCES "Store"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreItem" ADD CONSTRAINT "StoreItem_fileOid_fkey" FOREIGN KEY ("fileOid") REFERENCES "File"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreItem" ADD CONSTRAINT "StoreItem_referenceOid_fkey" FOREIGN KEY ("referenceOid") REFERENCES "FileReference"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreItem" ADD CONSTRAINT "StoreItem_documentOid_fkey" FOREIGN KEY ("documentOid") REFERENCES "Document"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreItem" ADD CONSTRAINT "StoreItem_directoryOid_fkey" FOREIGN KEY ("directoryOid") REFERENCES "StoreDirectory"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreItem" ADD CONSTRAINT "StoreItem_parentDirectoryOid_fkey" FOREIGN KEY ("parentDirectoryOid") REFERENCES "StoreDirectory"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreItem" ADD CONSTRAINT "StoreItem_lastModifiedByResourceActorOid_fkey" FOREIGN KEY ("lastModifiedByResourceActorOid") REFERENCES "ResourceActor"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreVersion" ADD CONSTRAINT "StoreVersion_storeOid_fkey" FOREIGN KEY ("storeOid") REFERENCES "Store"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreVersionItem" ADD CONSTRAINT "StoreVersionItem_storeVersionOid_fkey" FOREIGN KEY ("storeVersionOid") REFERENCES "StoreVersion"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreVersionItem" ADD CONSTRAINT "StoreVersionItem_fileOid_fkey" FOREIGN KEY ("fileOid") REFERENCES "File"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreVersionItem" ADD CONSTRAINT "StoreVersionItem_documentOid_fkey" FOREIGN KEY ("documentOid") REFERENCES "Document"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreVersionItem" ADD CONSTRAINT "StoreVersionItem_documentVersionOid_fkey" FOREIGN KEY ("documentVersionOid") REFERENCES "DocumentVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreParticipantPrincipal" ADD CONSTRAINT "StoreParticipantPrincipal_storeOid_fkey" FOREIGN KEY ("storeOid") REFERENCES "Store"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreParticipantPrincipal" ADD CONSTRAINT "StoreParticipantPrincipal_consumerOid_fkey" FOREIGN KEY ("consumerOid") REFERENCES "Consumer"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreParticipantPrincipal" ADD CONSTRAINT "StoreParticipantPrincipal_primaryResourceActorOid_fkey" FOREIGN KEY ("primaryResourceActorOid") REFERENCES "ResourceActor"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreParticipant" ADD CONSTRAINT "StoreParticipant_storeOid_fkey" FOREIGN KEY ("storeOid") REFERENCES "Store"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreParticipant" ADD CONSTRAINT "StoreParticipant_storeParticipantOid_fkey" FOREIGN KEY ("storeParticipantOid") REFERENCES "StoreParticipantPrincipal"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreParticipant" ADD CONSTRAINT "StoreParticipant_resourceActorOid_fkey" FOREIGN KEY ("resourceActorOid") REFERENCES "ResourceActor"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreDirectory" ADD CONSTRAINT "StoreDirectory_storeOid_fkey" FOREIGN KEY ("storeOid") REFERENCES "Store"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreDirectory" ADD CONSTRAINT "StoreDirectory_parentDirectoryOid_fkey" FOREIGN KEY ("parentDirectoryOid") REFERENCES "StoreDirectory"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileUpload" ADD CONSTRAINT "FileUpload_purposeOid_fkey" FOREIGN KEY ("purposeOid") REFERENCES "FilePurpose"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileUpload" ADD CONSTRAINT "FileUpload_userOid_fkey" FOREIGN KEY ("userOid") REFERENCES "User"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileUpload" ADD CONSTRAINT "FileUpload_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileUpload" ADD CONSTRAINT "FileUpload_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileUpload" ADD CONSTRAINT "FileUpload_createdByResourceActorOid_fkey" FOREIGN KEY ("createdByResourceActorOid") REFERENCES "ResourceActor"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileUpload" ADD CONSTRAINT "FileUpload_fileOid_fkey" FOREIGN KEY ("fileOid") REFERENCES "File"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityActor" ADD CONSTRAINT "IdentityActor_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityActor" ADD CONSTRAINT "IdentityActor_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityActor" ADD CONSTRAINT "IdentityActor_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_actorOid_fkey" FOREIGN KEY ("actorOid") REFERENCES "IdentityActor"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentClient" ADD CONSTRAINT "AgentClient_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentClient" ADD CONSTRAINT "AgentClient_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentClient" ADD CONSTRAINT "AgentClient_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentClient" ADD CONSTRAINT "AgentClient_consumerClientOid_fkey" FOREIGN KEY ("consumerClientOid") REFERENCES "ConsumerClient"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentClientRegistration" ADD CONSTRAINT "AgentClientRegistration_agentClientOid_fkey" FOREIGN KEY ("agentClientOid") REFERENCES "AgentClient"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentClientRegistration" ADD CONSTRAINT "AgentClientRegistration_consumerAuthClientOid_fkey" FOREIGN KEY ("consumerAuthClientOid") REFERENCES "ConsumerAuthClient"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentInstance" ADD CONSTRAINT "AgentInstance_agentOid_fkey" FOREIGN KEY ("agentOid") REFERENCES "Agent"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentInstance" ADD CONSTRAINT "AgentInstance_agentClientOid_fkey" FOREIGN KEY ("agentClientOid") REFERENCES "AgentClient"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentInstance" ADD CONSTRAINT "AgentInstance_agentClientRegistrationOid_fkey" FOREIGN KEY ("agentClientRegistrationOid") REFERENCES "AgentClientRegistration"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKeySecret" ADD CONSTRAINT "ApiKeySecret_apiKeyOid_fkey" FOREIGN KEY ("apiKeyOid") REFERENCES "ApiKey"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_machineAccessOid_fkey" FOREIGN KEY ("machineAccessOid") REFERENCES "MachineAccess"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKeyCreatedEmailSend" ADD CONSTRAINT "ApiKeyCreatedEmailSend_apiKeyOid_fkey" FOREIGN KEY ("apiKeyOid") REFERENCES "ApiKey"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKeyCreatedEmailSend" ADD CONSTRAINT "ApiKeyCreatedEmailSend_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKeyCreatedEmailSend" ADD CONSTRAINT "ApiKeyCreatedEmailSend_memberOid_fkey" FOREIGN KEY ("memberOid") REFERENCES "OrganizationMember"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKeyCreatedEmailSend" ADD CONSTRAINT "ApiKeyCreatedEmailSend_userOid_fkey" FOREIGN KEY ("userOid") REFERENCES "User"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKeyExpiredEmailSend" ADD CONSTRAINT "ApiKeyExpiredEmailSend_apiKeyOid_fkey" FOREIGN KEY ("apiKeyOid") REFERENCES "ApiKey"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKeyExpiredEmailSend" ADD CONSTRAINT "ApiKeyExpiredEmailSend_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKeyExpiredEmailSend" ADD CONSTRAINT "ApiKeyExpiredEmailSend_memberOid_fkey" FOREIGN KEY ("memberOid") REFERENCES "OrganizationMember"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKeyExpiredEmailSend" ADD CONSTRAINT "ApiKeyExpiredEmailSend_userOid_fkey" FOREIGN KEY ("userOid") REFERENCES "User"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CliDevice" ADD CONSTRAINT "CliDevice_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CliDevice" ADD CONSTRAINT "CliDevice_userOid_fkey" FOREIGN KEY ("userOid") REFERENCES "User"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CliDevice" ADD CONSTRAINT "CliDevice_oauthAuthorizationOid_fkey" FOREIGN KEY ("oauthAuthorizationOid") REFERENCES "OAuthAuthorization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineAccess" ADD CONSTRAINT "MachineAccess_actorOid_fkey" FOREIGN KEY ("actorOid") REFERENCES "OrganizationActor"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineAccess" ADD CONSTRAINT "MachineAccess_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineAccess" ADD CONSTRAINT "MachineAccess_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineAccess" ADD CONSTRAINT "MachineAccess_userOid_fkey" FOREIGN KEY ("userOid") REFERENCES "User"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthApplication" ADD CONSTRAINT "OAuthApplication_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthApplication" ADD CONSTRAINT "OAuthApplication_serverSideMachineAccessOid_fkey" FOREIGN KEY ("serverSideMachineAccessOid") REFERENCES "MachineAccess"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthApplication" ADD CONSTRAINT "OAuthApplication_scopedInstallationOid_fkey" FOREIGN KEY ("scopedInstallationOid") REFERENCES "OAuthInstallation"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalOAuthToken" ADD CONSTRAINT "InternalOAuthToken_oauthApplicationOid_fkey" FOREIGN KEY ("oauthApplicationOid") REFERENCES "OAuthApplication"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalOAuthToken" ADD CONSTRAINT "InternalOAuthToken_oauthInstallationOid_fkey" FOREIGN KEY ("oauthInstallationOid") REFERENCES "OAuthInstallation"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalOAuthToken" ADD CONSTRAINT "InternalOAuthToken_oauthAuthorizationOid_fkey" FOREIGN KEY ("oauthAuthorizationOid") REFERENCES "OAuthAuthorization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalOAuthToken" ADD CONSTRAINT "InternalOAuthToken_oauthTokenOid_fkey" FOREIGN KEY ("oauthTokenOid") REFERENCES "OAuthToken"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalOAuthToken" ADD CONSTRAINT "InternalOAuthToken_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalOAuthToken" ADD CONSTRAINT "InternalOAuthToken_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalOAuthToken" ADD CONSTRAINT "InternalOAuthToken_organizationMemberOid_fkey" FOREIGN KEY ("organizationMemberOid") REFERENCES "OrganizationMember"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalOAuthToken" ADD CONSTRAINT "InternalOAuthToken_machineAccessOid_fkey" FOREIGN KEY ("machineAccessOid") REFERENCES "MachineAccess"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthApplicationClientSecret" ADD CONSTRAINT "OAuthApplicationClientSecret_oauthApplicationOid_fkey" FOREIGN KEY ("oauthApplicationOid") REFERENCES "OAuthApplication"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthInstallation" ADD CONSTRAINT "OAuthInstallation_oauthApplicationOid_fkey" FOREIGN KEY ("oauthApplicationOid") REFERENCES "OAuthApplication"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthInstallation" ADD CONSTRAINT "OAuthInstallation_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthInstallation" ADD CONSTRAINT "OAuthInstallation_appActorOid_fkey" FOREIGN KEY ("appActorOid") REFERENCES "OrganizationActor"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthInstallation" ADD CONSTRAINT "OAuthInstallation_serverSideMachineAccessOid_fkey" FOREIGN KEY ("serverSideMachineAccessOid") REFERENCES "MachineAccess"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthAuthorization" ADD CONSTRAINT "OAuthAuthorization_oauthInstallationOid_fkey" FOREIGN KEY ("oauthInstallationOid") REFERENCES "OAuthInstallation"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthAuthorization" ADD CONSTRAINT "OAuthAuthorization_oauthApplicationOid_fkey" FOREIGN KEY ("oauthApplicationOid") REFERENCES "OAuthApplication"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthAuthorization" ADD CONSTRAINT "OAuthAuthorization_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthAuthorization" ADD CONSTRAINT "OAuthAuthorization_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthAuthorization" ADD CONSTRAINT "OAuthAuthorization_userOid_fkey" FOREIGN KEY ("userOid") REFERENCES "User"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthAuthorization" ADD CONSTRAINT "OAuthAuthorization_organizationMemberOid_fkey" FOREIGN KEY ("organizationMemberOid") REFERENCES "OrganizationMember"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthAuthorization" ADD CONSTRAINT "OAuthAuthorization_consumerProfileOid_fkey" FOREIGN KEY ("consumerProfileOid") REFERENCES "ConsumerProfile"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthAuthorization" ADD CONSTRAINT "OAuthAuthorization_machineAccessOid_fkey" FOREIGN KEY ("machineAccessOid") REFERENCES "MachineAccess"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthAuthorizationFlow" ADD CONSTRAINT "OAuthAuthorizationFlow_userOid_fkey" FOREIGN KEY ("userOid") REFERENCES "User"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthAuthorizationFlow" ADD CONSTRAINT "OAuthAuthorizationFlow_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthAuthorizationFlow" ADD CONSTRAINT "OAuthAuthorizationFlow_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthAuthorizationFlow" ADD CONSTRAINT "OAuthAuthorizationFlow_consumerProfileOid_fkey" FOREIGN KEY ("consumerProfileOid") REFERENCES "ConsumerProfile"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthAuthorizationFlow" ADD CONSTRAINT "OAuthAuthorizationFlow_oauthApplicationOid_fkey" FOREIGN KEY ("oauthApplicationOid") REFERENCES "OAuthApplication"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthAuthorizationFlow" ADD CONSTRAINT "OAuthAuthorizationFlow_oauthAuthorizationOid_fkey" FOREIGN KEY ("oauthAuthorizationOid") REFERENCES "OAuthAuthorization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthToken" ADD CONSTRAINT "OAuthToken_oauthAuthorizationOid_fkey" FOREIGN KEY ("oauthAuthorizationOid") REFERENCES "OAuthAuthorization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthToken" ADD CONSTRAINT "OAuthToken_oauthInstallationOid_fkey" FOREIGN KEY ("oauthInstallationOid") REFERENCES "OAuthInstallation"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceAccount" ADD CONSTRAINT "ServiceAccount_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceAccount" ADD CONSTRAINT "ServiceAccount_oauthApplicationOid_fkey" FOREIGN KEY ("oauthApplicationOid") REFERENCES "OAuthApplication"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceAccount" ADD CONSTRAINT "ServiceAccount_portalOid_fkey" FOREIGN KEY ("portalOid") REFERENCES "Portal"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceAccount" ADD CONSTRAINT "ServiceAccount_consumerProfileOid_fkey" FOREIGN KEY ("consumerProfileOid") REFERENCES "ConsumerProfile"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceAccountCredential" ADD CONSTRAINT "ServiceAccountCredential_serviceAccountOid_fkey" FOREIGN KEY ("serviceAccountOid") REFERENCES "ServiceAccount"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceAccountCredential" ADD CONSTRAINT "ServiceAccountCredential_oauthAuthorizationOid_fkey" FOREIGN KEY ("oauthAuthorizationOid") REFERENCES "OAuthAuthorization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MagicMcpEndpoint" ADD CONSTRAINT "MagicMcpEndpoint_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MagicMcpEndpoint" ADD CONSTRAINT "MagicMcpEndpoint_consumerProfileOid_fkey" FOREIGN KEY ("consumerProfileOid") REFERENCES "ConsumerProfile"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MagicMcpEndpoint" ADD CONSTRAINT "MagicMcpEndpoint_ownerActorOid_fkey" FOREIGN KEY ("ownerActorOid") REFERENCES "IdentityActor"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MagicMcpEndpoint" ADD CONSTRAINT "MagicMcpEndpoint_skillPluginOid_fkey" FOREIGN KEY ("skillPluginOid") REFERENCES "SkillPlugin"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MagicMcpEndpointServer" ADD CONSTRAINT "MagicMcpEndpointServer_magicMcpEndpointOid_fkey" FOREIGN KEY ("magicMcpEndpointOid") REFERENCES "MagicMcpEndpoint"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MagicMcpEndpointServer" ADD CONSTRAINT "MagicMcpEndpointServer_magicMcpServerOid_fkey" FOREIGN KEY ("magicMcpServerOid") REFERENCES "MagicMcpServer"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MagicMcpEndpointSkillSelection" ADD CONSTRAINT "MagicMcpEndpointSkillSelection_magicMcpEndpointOid_fkey" FOREIGN KEY ("magicMcpEndpointOid") REFERENCES "MagicMcpEndpoint"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MagicMcpEndpointSkillSelection" ADD CONSTRAINT "MagicMcpEndpointSkillSelection_skillOid_fkey" FOREIGN KEY ("skillOid") REFERENCES "Skill"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MagicMcpEndpointSkillSelection" ADD CONSTRAINT "MagicMcpEndpointSkillSelection_skillGroupOid_fkey" FOREIGN KEY ("skillGroupOid") REFERENCES "SkillGroup"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MagicMcpGroup" ADD CONSTRAINT "MagicMcpGroup_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MagicMcpGroupServer" ADD CONSTRAINT "MagicMcpGroupServer_magicMcpGroupOid_fkey" FOREIGN KEY ("magicMcpGroupOid") REFERENCES "MagicMcpGroup"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MagicMcpGroupServer" ADD CONSTRAINT "MagicMcpGroupServer_magicMcpServerOid_fkey" FOREIGN KEY ("magicMcpServerOid") REFERENCES "MagicMcpServer"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MagicMcpGroupToken" ADD CONSTRAINT "MagicMcpGroupToken_magicMcpGroupOid_fkey" FOREIGN KEY ("magicMcpGroupOid") REFERENCES "MagicMcpGroup"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MagicMcpGroupToken" ADD CONSTRAINT "MagicMcpGroupToken_magicMcpTokenOid_fkey" FOREIGN KEY ("magicMcpTokenOid") REFERENCES "MagicMcpToken"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MagicMcpServer" ADD CONSTRAINT "MagicMcpServer_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MagicMcpServer" ADD CONSTRAINT "MagicMcpServer_ownerActorOid_fkey" FOREIGN KEY ("ownerActorOid") REFERENCES "IdentityActor"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MagicMcpServerAlias" ADD CONSTRAINT "MagicMcpServerAlias_serverOid_fkey" FOREIGN KEY ("serverOid") REFERENCES "MagicMcpServer"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MagicMcpServerSubspaceSession" ADD CONSTRAINT "MagicMcpServerSubspaceSession_magicMcpServerOid_fkey" FOREIGN KEY ("magicMcpServerOid") REFERENCES "MagicMcpServer"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MagicMcpServerSubspaceSession" ADD CONSTRAINT "MagicMcpServerSubspaceSession_magicMcpEndpointOid_fkey" FOREIGN KEY ("magicMcpEndpointOid") REFERENCES "MagicMcpEndpoint"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MagicMcpServerSubspaceSession" ADD CONSTRAINT "MagicMcpServerSubspaceSession_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MagicMcpToken" ADD CONSTRAINT "MagicMcpToken_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MagicMcpToken" ADD CONSTRAINT "MagicMcpToken_magicMcpServerOid_fkey" FOREIGN KEY ("magicMcpServerOid") REFERENCES "MagicMcpServer"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MagicMcpToken" ADD CONSTRAINT "MagicMcpToken_magicMcpEndpointOid_fkey" FOREIGN KEY ("magicMcpEndpointOid") REFERENCES "MagicMcpEndpoint"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MagicMcpToken" ADD CONSTRAINT "MagicMcpToken_skillPluginOid_fkey" FOREIGN KEY ("skillPluginOid") REFERENCES "SkillPlugin"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MagicMcpTokenUse" ADD CONSTRAINT "MagicMcpTokenUse_magicMcpTokenOid_fkey" FOREIGN KEY ("magicMcpTokenOid") REFERENCES "MagicMcpToken"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MagicMcpTokenUse" ADD CONSTRAINT "MagicMcpTokenUse_magicMcpServerOid_fkey" FOREIGN KEY ("magicMcpServerOid") REFERENCES "MagicMcpServer"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MagicMcpTokenUse" ADD CONSTRAINT "MagicMcpTokenUse_magicMcpEndpointOid_fkey" FOREIGN KEY ("magicMcpEndpointOid") REFERENCES "MagicMcpEndpoint"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Firewall" ADD CONSTRAINT "Firewall_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Firewall" ADD CONSTRAINT "Firewall_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Firewall" ADD CONSTRAINT "Firewall_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirewallNetworkPolicy" ADD CONSTRAINT "FirewallNetworkPolicy_firewallOid_fkey" FOREIGN KEY ("firewallOid") REFERENCES "Firewall"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirewallNetworkPolicy" ADD CONSTRAINT "FirewallNetworkPolicy_networkPolicyOid_fkey" FOREIGN KEY ("networkPolicyOid") REFERENCES "NetworkPolicy"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkPolicy" ADD CONSTRAINT "NetworkPolicy_currentVersionOid_fkey" FOREIGN KEY ("currentVersionOid") REFERENCES "NetworkPolicyVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkPolicy" ADD CONSTRAINT "NetworkPolicy_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkPolicy" ADD CONSTRAINT "NetworkPolicy_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkPolicy" ADD CONSTRAINT "NetworkPolicy_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkPolicyVersion" ADD CONSTRAINT "NetworkPolicyVersion_networkPolicyOid_fkey" FOREIGN KEY ("networkPolicyOid") REFERENCES "NetworkPolicy"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessRole" ADD CONSTRAINT "AccessRole_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessRoleVersion" ADD CONSTRAINT "AccessRoleVersion_accessRoleOid_fkey" FOREIGN KEY ("accessRoleOid") REFERENCES "AccessRole"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessPolicy" ADD CONSTRAINT "AccessPolicy_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessPolicyRole" ADD CONSTRAINT "AccessPolicyRole_accessPolicyOid_fkey" FOREIGN KEY ("accessPolicyOid") REFERENCES "AccessPolicy"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessPolicyRole" ADD CONSTRAINT "AccessPolicyRole_accessRoleOid_fkey" FOREIGN KEY ("accessRoleOid") REFERENCES "AccessRole"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessPolicyProject" ADD CONSTRAINT "AccessPolicyProject_accessPolicyOid_fkey" FOREIGN KEY ("accessPolicyOid") REFERENCES "AccessPolicy"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessPolicyProject" ADD CONSTRAINT "AccessPolicyProject_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessPolicyInstance" ADD CONSTRAINT "AccessPolicyInstance_accessPolicyOid_fkey" FOREIGN KEY ("accessPolicyOid") REFERENCES "AccessPolicy"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessPolicyInstance" ADD CONSTRAINT "AccessPolicyInstance_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessPolicyVersion" ADD CONSTRAINT "AccessPolicyVersion_accessPolicyOid_fkey" FOREIGN KEY ("accessPolicyOid") REFERENCES "AccessPolicy"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessPolicyAssignment" ADD CONSTRAINT "AccessPolicyAssignment_accessPolicyOid_fkey" FOREIGN KEY ("accessPolicyOid") REFERENCES "AccessPolicy"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessPolicyAssignment" ADD CONSTRAINT "AccessPolicyAssignment_memberOid_fkey" FOREIGN KEY ("memberOid") REFERENCES "OrganizationMember"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessPolicyAssignment" ADD CONSTRAINT "AccessPolicyAssignment_teamOid_fkey" FOREIGN KEY ("teamOid") REFERENCES "Team"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessPolicyAssignment" ADD CONSTRAINT "AccessPolicyAssignment_serviceAccountOid_fkey" FOREIGN KEY ("serviceAccountOid") REFERENCES "ServiceAccount"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationActor" ADD CONSTRAINT "OrganizationActor_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectBrand" ADD CONSTRAINT "ProjectBrand_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectBrandUpdate" ADD CONSTRAINT "ProjectBrandUpdate_createdByOid_fkey" FOREIGN KEY ("createdByOid") REFERENCES "OrganizationActor"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectBrandUpdate" ADD CONSTRAINT "ProjectBrandUpdate_brandOid_fkey" FOREIGN KEY ("brandOid") REFERENCES "ProjectBrand"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationConfig" ADD CONSTRAINT "OrganizationConfig_typeOid_fkey" FOREIGN KEY ("typeOid") REFERENCES "OrganizationConfigType"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationConfig" ADD CONSTRAINT "OrganizationConfig_userOid_fkey" FOREIGN KEY ("userOid") REFERENCES "User"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationConfig" ADD CONSTRAINT "OrganizationConfig_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Environment" ADD CONSTRAINT "Environment_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Environment" ADD CONSTRAINT "Environment_creatorActorOid_fkey" FOREIGN KEY ("creatorActorOid") REFERENCES "OrganizationActor"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sandbox" ADD CONSTRAINT "Sandbox_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sandbox" ADD CONSTRAINT "Sandbox_creatorActorOid_fkey" FOREIGN KEY ("creatorActorOid") REFERENCES "OrganizationActor"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Instance" ADD CONSTRAINT "Instance_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Instance" ADD CONSTRAINT "Instance_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Instance" ADD CONSTRAINT "Instance_resourceTenantOid_fkey" FOREIGN KEY ("resourceTenantOid") REFERENCES "ResourceTenant"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Instance" ADD CONSTRAINT "Instance_resourceGroupOid_fkey" FOREIGN KEY ("resourceGroupOid") REFERENCES "ResourceGroup"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationLayout" ADD CONSTRAINT "OrganizationLayout_typeOid_fkey" FOREIGN KEY ("typeOid") REFERENCES "OrganizationLayoutType"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationLayout" ADD CONSTRAINT "OrganizationLayout_userOid_fkey" FOREIGN KEY ("userOid") REFERENCES "User"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationLayout" ADD CONSTRAINT "OrganizationLayout_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "OrganizationNotification" ADD CONSTRAINT "OrganizationNotification_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationNotification" ADD CONSTRAINT "OrganizationNotification_typeOid_fkey" FOREIGN KEY ("typeOid") REFERENCES "OrganizationNotificationType"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationNotificationDestination" ADD CONSTRAINT "OrganizationNotificationDestination_memberOid_fkey" FOREIGN KEY ("memberOid") REFERENCES "OrganizationMember"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationNotificationDestination" ADD CONSTRAINT "OrganizationNotificationDestination_notificationOid_fkey" FOREIGN KEY ("notificationOid") REFERENCES "OrganizationNotification"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationNotificationDestination" ADD CONSTRAINT "OrganizationNotificationDestination_emailDigestOid_fkey" FOREIGN KEY ("emailDigestOid") REFERENCES "OrganizationNotificationEmailDigest"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationNotificationSetting" ADD CONSTRAINT "OrganizationNotificationSetting_userOid_fkey" FOREIGN KEY ("userOid") REFERENCES "User"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationNotificationSetting" ADD CONSTRAINT "OrganizationNotificationSetting_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationNotificationSetting" ADD CONSTRAINT "OrganizationNotificationSetting_typeOid_fkey" FOREIGN KEY ("typeOid") REFERENCES "OrganizationNotificationType"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationNotificationDigestSetting" ADD CONSTRAINT "OrganizationNotificationDigestSetting_userOid_fkey" FOREIGN KEY ("userOid") REFERENCES "User"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationNotificationDigestSetting" ADD CONSTRAINT "OrganizationNotificationDigestSetting_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationNotificationEmailDigest" ADD CONSTRAINT "OrganizationNotificationEmailDigest_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationNotificationEmailDigest" ADD CONSTRAINT "OrganizationNotificationEmailDigest_memberOid_fkey" FOREIGN KEY ("memberOid") REFERENCES "OrganizationMember"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_resourceTenantOid_fkey" FOREIGN KEY ("resourceTenantOid") REFERENCES "ResourceTenant"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_resourceGroupOid_fkey" FOREIGN KEY ("resourceGroupOid") REFERENCES "ResourceGroup"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userOid_fkey" FOREIGN KEY ("userOid") REFERENCES "User"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileUpdate" ADD CONSTRAINT "ProfileUpdate_createdByOid_fkey" FOREIGN KEY ("createdByOid") REFERENCES "OrganizationActor"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileUpdate" ADD CONSTRAINT "ProfileUpdate_profileOid_fkey" FOREIGN KEY ("profileOid") REFERENCES "Profile"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_resourceTenantOid_fkey" FOREIGN KEY ("resourceTenantOid") REFERENCES "ResourceTenant"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_resourceGroupOid_fkey" FOREIGN KEY ("resourceGroupOid") REFERENCES "ResourceGroup"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamProject" ADD CONSTRAINT "TeamProject_teamOid_fkey" FOREIGN KEY ("teamOid") REFERENCES "Team"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamProject" ADD CONSTRAINT "TeamProject_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamOid_fkey" FOREIGN KEY ("teamOid") REFERENCES "Team"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_organizationActorOid_fkey" FOREIGN KEY ("organizationActorOid") REFERENCES "OrganizationActor"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutpostInstance" ADD CONSTRAINT "OutpostInstance_outpostOid_fkey" FOREIGN KEY ("outpostOid") REFERENCES "Outpost"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutpostInstance" ADD CONSTRAINT "OutpostInstance_credentialOid_fkey" FOREIGN KEY ("credentialOid") REFERENCES "OutpostCredential"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutpostInstanceService" ADD CONSTRAINT "OutpostInstanceService_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "OutpostInstance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutpostInstanceKeyRotation" ADD CONSTRAINT "OutpostInstanceKeyRotation_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "OutpostInstance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutpostInstanceEvent" ADD CONSTRAINT "OutpostInstanceEvent_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "OutpostInstance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutpostTokenKeyPair" ADD CONSTRAINT "OutpostTokenKeyPair_accountOid_fkey" FOREIGN KEY ("accountOid") REFERENCES "Account"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutpostTokenKeyPair" ADD CONSTRAINT "OutpostTokenKeyPair_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Outpost" ADD CONSTRAINT "Outpost_accountOid_fkey" FOREIGN KEY ("accountOid") REFERENCES "Account"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Outpost" ADD CONSTRAINT "Outpost_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutpostCredential" ADD CONSTRAINT "OutpostCredential_outpostOid_fkey" FOREIGN KEY ("outpostOid") REFERENCES "Outpost"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutpostAccess" ADD CONSTRAINT "OutpostAccess_outpostOid_fkey" FOREIGN KEY ("outpostOid") REFERENCES "Outpost"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutpostAccess" ADD CONSTRAINT "OutpostAccess_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutpostAccess" ADD CONSTRAINT "OutpostAccess_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutpostAccess" ADD CONSTRAINT "OutpostAccess_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAssistant" ADD CONSTRAINT "ProductAssistant_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAssistant" ADD CONSTRAINT "ProductAssistant_implementationOid_fkey" FOREIGN KEY ("implementationOid") REFERENCES "ProductAssistantImplementation"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAssistantConfig" ADD CONSTRAINT "ProductAssistantConfig_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAssistantInstance" ADD CONSTRAINT "ProductAssistantInstance_assistantOid_fkey" FOREIGN KEY ("assistantOid") REFERENCES "ProductAssistant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAssistantInstance" ADD CONSTRAINT "ProductAssistantInstance_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAssistantConversation" ADD CONSTRAINT "ProductAssistantConversation_assistantInstanceOid_fkey" FOREIGN KEY ("assistantInstanceOid") REFERENCES "ProductAssistantInstance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAssistantConversation" ADD CONSTRAINT "ProductAssistantConversation_assistantOid_fkey" FOREIGN KEY ("assistantOid") REFERENCES "ProductAssistant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAssistantConversation" ADD CONSTRAINT "ProductAssistantConversation_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAssistantConversation" ADD CONSTRAINT "ProductAssistantConversation_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAssistantConversation" ADD CONSTRAINT "ProductAssistantConversation_createdByResourceActorOid_fkey" FOREIGN KEY ("createdByResourceActorOid") REFERENCES "ResourceActor"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAssistantConversation" ADD CONSTRAINT "ProductAssistantConversation_rootMessageOid_fkey" FOREIGN KEY ("rootMessageOid") REFERENCES "ProductAssistantMessage"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAssistantConversationParticipant" ADD CONSTRAINT "ProductAssistantConversationParticipant_conversationOid_fkey" FOREIGN KEY ("conversationOid") REFERENCES "ProductAssistantConversation"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAssistantConversationParticipant" ADD CONSTRAINT "ProductAssistantConversationParticipant_resourceActorOid_fkey" FOREIGN KEY ("resourceActorOid") REFERENCES "ResourceActor"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAssistantRequest" ADD CONSTRAINT "ProductAssistantRequest_conversationOid_fkey" FOREIGN KEY ("conversationOid") REFERENCES "ProductAssistantConversation"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAssistantRequest" ADD CONSTRAINT "ProductAssistantRequest_assistantInstanceOid_fkey" FOREIGN KEY ("assistantInstanceOid") REFERENCES "ProductAssistantInstance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAssistantRequest" ADD CONSTRAINT "ProductAssistantRequest_assistantOid_fkey" FOREIGN KEY ("assistantOid") REFERENCES "ProductAssistant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAssistantRequest" ADD CONSTRAINT "ProductAssistantRequest_modelOid_fkey" FOREIGN KEY ("modelOid") REFERENCES "ProductAssistantModel"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAssistantRequest" ADD CONSTRAINT "ProductAssistantRequest_messageOid_fkey" FOREIGN KEY ("messageOid") REFERENCES "ProductAssistantMessage"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAssistantRequest" ADD CONSTRAINT "ProductAssistantRequest_resourceActorOid_fkey" FOREIGN KEY ("resourceActorOid") REFERENCES "ResourceActor"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAssistantMessage" ADD CONSTRAINT "ProductAssistantMessage_runOid_fkey" FOREIGN KEY ("runOid") REFERENCES "ProductAssistantModelRun"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAssistantMessage" ADD CONSTRAINT "ProductAssistantMessage_requestOid_fkey" FOREIGN KEY ("requestOid") REFERENCES "ProductAssistantRequest"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAssistantMessage" ADD CONSTRAINT "ProductAssistantMessage_assistantInstanceOid_fkey" FOREIGN KEY ("assistantInstanceOid") REFERENCES "ProductAssistantInstance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAssistantMessage" ADD CONSTRAINT "ProductAssistantMessage_assistantOid_fkey" FOREIGN KEY ("assistantOid") REFERENCES "ProductAssistant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAssistantMessage" ADD CONSTRAINT "ProductAssistantMessage_parentMessageOid_fkey" FOREIGN KEY ("parentMessageOid") REFERENCES "ProductAssistantMessage"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAssistantMessage" ADD CONSTRAINT "ProductAssistantMessage_modelOid_fkey" FOREIGN KEY ("modelOid") REFERENCES "ProductAssistantModel"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAssistantConversationItem" ADD CONSTRAINT "ProductAssistantConversationItem_conversationOid_fkey" FOREIGN KEY ("conversationOid") REFERENCES "ProductAssistantConversation"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAssistantConversationItem" ADD CONSTRAINT "ProductAssistantConversationItem_messageOid_fkey" FOREIGN KEY ("messageOid") REFERENCES "ProductAssistantMessage"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAssistantModel" ADD CONSTRAINT "ProductAssistantModel_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "ProductAssistantModelProvider"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAssistantModelRun" ADD CONSTRAINT "ProductAssistantModelRun_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAssistantModelRun" ADD CONSTRAINT "ProductAssistantModelRun_requestOid_fkey" FOREIGN KEY ("requestOid") REFERENCES "ProductAssistantRequest"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAssistantModelRun" ADD CONSTRAINT "ProductAssistantModelRun_conversationOid_fkey" FOREIGN KEY ("conversationOid") REFERENCES "ProductAssistantConversation"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAssistantModelRun" ADD CONSTRAINT "ProductAssistantModelRun_assistantInstanceOid_fkey" FOREIGN KEY ("assistantInstanceOid") REFERENCES "ProductAssistantInstance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAssistantModelRun" ADD CONSTRAINT "ProductAssistantModelRun_assistantOid_fkey" FOREIGN KEY ("assistantOid") REFERENCES "ProductAssistant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAssistantModelRun" ADD CONSTRAINT "ProductAssistantModelRun_modelOid_fkey" FOREIGN KEY ("modelOid") REFERENCES "ProductAssistantModel"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAssistantSubspaceMcpConnection" ADD CONSTRAINT "ProductAssistantSubspaceMcpConnection_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAssistantSubspaceMcpConnection" ADD CONSTRAINT "ProductAssistantSubspaceMcpConnection_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessLimiter" ADD CONSTRAINT "AccessLimiter_createdByActorOid_fkey" FOREIGN KEY ("createdByActorOid") REFERENCES "OrganizationActor"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessLimiter" ADD CONSTRAINT "AccessLimiter_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandboxDisk" ADD CONSTRAINT "SandboxDisk_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "SandboxTenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandboxDisk" ADD CONSTRAINT "SandboxDisk_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandboxDisk" ADD CONSTRAINT "SandboxDisk_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandboxDisk" ADD CONSTRAINT "SandboxDisk_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandboxDisk" ADD CONSTRAINT "SandboxDisk_machineOid_fkey" FOREIGN KEY ("machineOid") REFERENCES "SandboxMachine"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandboxMachineFirewall" ADD CONSTRAINT "SandboxMachineFirewall_machineOid_fkey" FOREIGN KEY ("machineOid") REFERENCES "SandboxMachine"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandboxMachineFirewall" ADD CONSTRAINT "SandboxMachineFirewall_firewallOid_fkey" FOREIGN KEY ("firewallOid") REFERENCES "Firewall"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandboxEgressPolicy" ADD CONSTRAINT "SandboxEgressPolicy_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandboxEgressPolicy" ADD CONSTRAINT "SandboxEgressPolicy_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandboxEgressPolicy" ADD CONSTRAINT "SandboxEgressPolicy_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandboxEgressPolicyFirewall" ADD CONSTRAINT "SandboxEgressPolicyFirewall_policyOid_fkey" FOREIGN KEY ("policyOid") REFERENCES "SandboxEgressPolicy"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandboxEgressPolicyFirewall" ADD CONSTRAINT "SandboxEgressPolicyFirewall_firewallOid_fkey" FOREIGN KEY ("firewallOid") REFERENCES "Firewall"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandboxEgressPolicyRegion" ADD CONSTRAINT "SandboxEgressPolicyRegion_policyOid_fkey" FOREIGN KEY ("policyOid") REFERENCES "SandboxEgressPolicy"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandboxEgressPolicyRegion" ADD CONSTRAINT "SandboxEgressPolicyRegion_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "SandboxTenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandboxMachineImageBuild" ADD CONSTRAINT "SandboxMachineImageBuild_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandboxMachineImageBuild" ADD CONSTRAINT "SandboxMachineImageBuild_sourceFileOid_fkey" FOREIGN KEY ("sourceFileOid") REFERENCES "File"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandboxMachineImageBuild" ADD CONSTRAINT "SandboxMachineImageBuild_imageOid_fkey" FOREIGN KEY ("imageOid") REFERENCES "SandboxMachineImage"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandboxMachineImageBuild" ADD CONSTRAINT "SandboxMachineImageBuild_versionOid_fkey" FOREIGN KEY ("versionOid") REFERENCES "SandboxMachineImageVersion"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandboxMachineImageBuildRegion" ADD CONSTRAINT "SandboxMachineImageBuildRegion_buildOid_fkey" FOREIGN KEY ("buildOid") REFERENCES "SandboxMachineImageBuild"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandboxMachineImageBuildRegion" ADD CONSTRAINT "SandboxMachineImageBuildRegion_regionOid_fkey" FOREIGN KEY ("regionOid") REFERENCES "SandboxRegion"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandboxMachineImageBuildRegion" ADD CONSTRAINT "SandboxMachineImageBuildRegion_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "SandboxTenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandboxMachineImage" ADD CONSTRAINT "SandboxMachineImage_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandboxMachineImage" ADD CONSTRAINT "SandboxMachineImage_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandboxMachineImage" ADD CONSTRAINT "SandboxMachineImage_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandboxMachineImageRegion" ADD CONSTRAINT "SandboxMachineImageRegion_imageOid_fkey" FOREIGN KEY ("imageOid") REFERENCES "SandboxMachineImage"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandboxMachineImageRegion" ADD CONSTRAINT "SandboxMachineImageRegion_regionOid_fkey" FOREIGN KEY ("regionOid") REFERENCES "SandboxRegion"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandboxMachineImageRegion" ADD CONSTRAINT "SandboxMachineImageRegion_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "SandboxTenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandboxMachineImageVersion" ADD CONSTRAINT "SandboxMachineImageVersion_imageOid_fkey" FOREIGN KEY ("imageOid") REFERENCES "SandboxMachineImage"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandboxMachineImageVersionRegion" ADD CONSTRAINT "SandboxMachineImageVersionRegion_versionOid_fkey" FOREIGN KEY ("versionOid") REFERENCES "SandboxMachineImageVersion"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandboxMachineImageVersionRegion" ADD CONSTRAINT "SandboxMachineImageVersionRegion_imageRegionOid_fkey" FOREIGN KEY ("imageRegionOid") REFERENCES "SandboxMachineImageRegion"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandboxMachineImageVersionRegion" ADD CONSTRAINT "SandboxMachineImageVersionRegion_regionOid_fkey" FOREIGN KEY ("regionOid") REFERENCES "SandboxRegion"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandboxMachine" ADD CONSTRAINT "SandboxMachine_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "SandboxTenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandboxMachine" ADD CONSTRAINT "SandboxMachine_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandboxMachine" ADD CONSTRAINT "SandboxMachine_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandboxMachine" ADD CONSTRAINT "SandboxMachine_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandboxMachine" ADD CONSTRAINT "SandboxMachine_imageOid_fkey" FOREIGN KEY ("imageOid") REFERENCES "SandboxMachineImage"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandboxMachine" ADD CONSTRAINT "SandboxMachine_egressPolicyOid_fkey" FOREIGN KEY ("egressPolicyOid") REFERENCES "SandboxEgressPolicy"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandboxMachine" ADD CONSTRAINT "SandboxMachine_appliedEgressRegionOid_fkey" FOREIGN KEY ("appliedEgressRegionOid") REFERENCES "SandboxEgressPolicyRegion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandboxSpecRegion" ADD CONSTRAINT "SandboxSpecRegion_specOid_fkey" FOREIGN KEY ("specOid") REFERENCES "SandboxSpec"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandboxSpecRegion" ADD CONSTRAINT "SandboxSpecRegion_regionOid_fkey" FOREIGN KEY ("regionOid") REFERENCES "SandboxRegion"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandboxTenant" ADD CONSTRAINT "SandboxTenant_regionOid_fkey" FOREIGN KEY ("regionOid") REFERENCES "SandboxRegion"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandboxTenant" ADD CONSTRAINT "SandboxTenant_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandboxTenant" ADD CONSTRAINT "SandboxTenant_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchIndexRecord" ADD CONSTRAINT "SearchIndexRecord_indexOid_fkey" FOREIGN KEY ("indexOid") REFERENCES "SearchIndex"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

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
ALTER TABLE "SkillAgent" ADD CONSTRAINT "SkillAgent_skillOid_fkey" FOREIGN KEY ("skillOid") REFERENCES "Skill"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillAgent" ADD CONSTRAINT "SkillAgent_storeItemOid_fkey" FOREIGN KEY ("storeItemOid") REFERENCES "StoreItem"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillAgent" ADD CONSTRAINT "SkillAgent_documentOid_fkey" FOREIGN KEY ("documentOid") REFERENCES "Document"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillConfiguration" ADD CONSTRAINT "SkillConfiguration_resourceTenantOid_fkey" FOREIGN KEY ("resourceTenantOid") REFERENCES "ResourceTenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillConfiguration" ADD CONSTRAINT "SkillConfiguration_resourceGroupOid_fkey" FOREIGN KEY ("resourceGroupOid") REFERENCES "ResourceGroup"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillConfiguration" ADD CONSTRAINT "SkillConfiguration_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillConfiguration" ADD CONSTRAINT "SkillConfiguration_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillExportRef" ADD CONSTRAINT "SkillExportRef_skillConfigurationOid_fkey" FOREIGN KEY ("skillConfigurationOid") REFERENCES "SkillConfiguration"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillExportRef" ADD CONSTRAINT "SkillExportRef_skillOid_fkey" FOREIGN KEY ("skillOid") REFERENCES "Skill"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillExportRef" ADD CONSTRAINT "SkillExportRef_managedSkillPluginOid_fkey" FOREIGN KEY ("managedSkillPluginOid") REFERENCES "ManagedSkillPlugin"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillExportRef" ADD CONSTRAINT "SkillExportRef_skillPluginOid_fkey" FOREIGN KEY ("skillPluginOid") REFERENCES "SkillPlugin"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillExportRef" ADD CONSTRAINT "SkillExportRef_skillMarketplaceOid_fkey" FOREIGN KEY ("skillMarketplaceOid") REFERENCES "SkillMarketplace"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillExportRef" ADD CONSTRAINT "SkillExportRef_fileOid_fkey" FOREIGN KEY ("fileOid") REFERENCES "File"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillExportRef" ADD CONSTRAINT "SkillExportRef_fileReferenceOid_fkey" FOREIGN KEY ("fileReferenceOid") REFERENCES "FileReference"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillExportRef" ADD CONSTRAINT "SkillExportRef_fileLinkOid_fkey" FOREIGN KEY ("fileLinkOid") REFERENCES "FileLink"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillExportRef" ADD CONSTRAINT "SkillExportRef_fileManifestOid_fkey" FOREIGN KEY ("fileManifestOid") REFERENCES "SkillDestinationManifest"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillExportRef" ADD CONSTRAINT "SkillExportRef_resourceTenantOid_fkey" FOREIGN KEY ("resourceTenantOid") REFERENCES "ResourceTenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillExportRef" ADD CONSTRAINT "SkillExportRef_resourceGroupOid_fkey" FOREIGN KEY ("resourceGroupOid") REFERENCES "ResourceGroup"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillExportRef" ADD CONSTRAINT "SkillExportRef_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillExportRef" ADD CONSTRAINT "SkillExportRef_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillExport" ADD CONSTRAINT "SkillExport_exportRefOid_fkey" FOREIGN KEY ("exportRefOid") REFERENCES "SkillExportRef"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillExport" ADD CONSTRAINT "SkillExport_fileOid_fkey" FOREIGN KEY ("fileOid") REFERENCES "File"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillExport" ADD CONSTRAINT "SkillExport_fileReferenceOid_fkey" FOREIGN KEY ("fileReferenceOid") REFERENCES "FileReference"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillExport" ADD CONSTRAINT "SkillExport_fileLinkOid_fkey" FOREIGN KEY ("fileLinkOid") REFERENCES "FileLink"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillExport" ADD CONSTRAINT "SkillExport_creatorResourceActorOid_fkey" FOREIGN KEY ("creatorResourceActorOid") REFERENCES "ResourceActor"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillExport" ADD CONSTRAINT "SkillExport_resourceTenantOid_fkey" FOREIGN KEY ("resourceTenantOid") REFERENCES "ResourceTenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillExport" ADD CONSTRAINT "SkillExport_resourceGroupOid_fkey" FOREIGN KEY ("resourceGroupOid") REFERENCES "ResourceGroup"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillExport" ADD CONSTRAINT "SkillExport_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillExport" ADD CONSTRAINT "SkillExport_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillGroup" ADD CONSTRAINT "SkillGroup_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillGroup" ADD CONSTRAINT "SkillGroup_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillGroupItem" ADD CONSTRAINT "SkillGroupItem_skillGroupOid_fkey" FOREIGN KEY ("skillGroupOid") REFERENCES "SkillGroup"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillGroupItem" ADD CONSTRAINT "SkillGroupItem_skillOid_fkey" FOREIGN KEY ("skillOid") REFERENCES "Skill"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillImport" ADD CONSTRAINT "SkillImport_sourceFileOid_fkey" FOREIGN KEY ("sourceFileOid") REFERENCES "File"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillImport" ADD CONSTRAINT "SkillImport_sourceFileReferenceOid_fkey" FOREIGN KEY ("sourceFileReferenceOid") REFERENCES "FileReference"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillImport" ADD CONSTRAINT "SkillImport_sourceFileLinkOid_fkey" FOREIGN KEY ("sourceFileLinkOid") REFERENCES "FileLink"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillImport" ADD CONSTRAINT "SkillImport_resourceTenantOid_fkey" FOREIGN KEY ("resourceTenantOid") REFERENCES "ResourceTenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillImport" ADD CONSTRAINT "SkillImport_resourceGroupOid_fkey" FOREIGN KEY ("resourceGroupOid") REFERENCES "ResourceGroup"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillImport" ADD CONSTRAINT "SkillImport_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillImport" ADD CONSTRAINT "SkillImport_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillImport" ADD CONSTRAINT "SkillImport_creatorResourceActorOid_fkey" FOREIGN KEY ("creatorResourceActorOid") REFERENCES "ResourceActor"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillImportItem" ADD CONSTRAINT "SkillImportItem_skillImportOid_fkey" FOREIGN KEY ("skillImportOid") REFERENCES "SkillImport"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillImportItem" ADD CONSTRAINT "SkillImportItem_skillOid_fkey" FOREIGN KEY ("skillOid") REFERENCES "Skill"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillMarketplace" ADD CONSTRAINT "SkillMarketplace_skillConfigurationOid_fkey" FOREIGN KEY ("skillConfigurationOid") REFERENCES "SkillConfiguration"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillMarketplace" ADD CONSTRAINT "SkillMarketplace_destinationOid_fkey" FOREIGN KEY ("destinationOid") REFERENCES "SkillDestination"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillMarketplace" ADD CONSTRAINT "SkillMarketplace_resourceTenantOid_fkey" FOREIGN KEY ("resourceTenantOid") REFERENCES "ResourceTenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillMarketplace" ADD CONSTRAINT "SkillMarketplace_resourceGroupOid_fkey" FOREIGN KEY ("resourceGroupOid") REFERENCES "ResourceGroup"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillMarketplace" ADD CONSTRAINT "SkillMarketplace_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillMarketplace" ADD CONSTRAINT "SkillMarketplace_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillMarketplace" ADD CONSTRAINT "SkillMarketplace_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillMarketplaceRepository" ADD CONSTRAINT "SkillMarketplaceRepository_skillMarketplaceOid_fkey" FOREIGN KEY ("skillMarketplaceOid") REFERENCES "SkillMarketplace"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillMarketplaceRepository" ADD CONSTRAINT "SkillMarketplaceRepository_skillRepositoryOid_fkey" FOREIGN KEY ("skillRepositoryOid") REFERENCES "SkillRepository"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillMergeRequest" ADD CONSTRAINT "SkillMergeRequest_resourceTenantOid_fkey" FOREIGN KEY ("resourceTenantOid") REFERENCES "ResourceTenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillMergeRequest" ADD CONSTRAINT "SkillMergeRequest_resourceGroupOid_fkey" FOREIGN KEY ("resourceGroupOid") REFERENCES "ResourceGroup"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillMergeRequest" ADD CONSTRAINT "SkillMergeRequest_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillMergeRequest" ADD CONSTRAINT "SkillMergeRequest_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillMergeRequest" ADD CONSTRAINT "SkillMergeRequest_sourceSkillOid_fkey" FOREIGN KEY ("sourceSkillOid") REFERENCES "Skill"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillMergeRequest" ADD CONSTRAINT "SkillMergeRequest_targetSkillOid_fkey" FOREIGN KEY ("targetSkillOid") REFERENCES "Skill"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillMergeRequest" ADD CONSTRAINT "SkillMergeRequest_baseSourceSkillVersionOid_fkey" FOREIGN KEY ("baseSourceSkillVersionOid") REFERENCES "SkillVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillMergeRequest" ADD CONSTRAINT "SkillMergeRequest_baseTargetSkillVersionOid_fkey" FOREIGN KEY ("baseTargetSkillVersionOid") REFERENCES "SkillVersion"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillMergeRequest" ADD CONSTRAINT "SkillMergeRequest_requestedSourceSkillVersionOid_fkey" FOREIGN KEY ("requestedSourceSkillVersionOid") REFERENCES "SkillVersion"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillMergeRequest" ADD CONSTRAINT "SkillMergeRequest_requestedTargetSkillVersionOid_fkey" FOREIGN KEY ("requestedTargetSkillVersionOid") REFERENCES "SkillVersion"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillMergeRequest" ADD CONSTRAINT "SkillMergeRequest_preMergeTargetSkillVersionOid_fkey" FOREIGN KEY ("preMergeTargetSkillVersionOid") REFERENCES "SkillVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillMergeRequest" ADD CONSTRAINT "SkillMergeRequest_mergedTargetSkillVersionOid_fkey" FOREIGN KEY ("mergedTargetSkillVersionOid") REFERENCES "SkillVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillMergeRequest" ADD CONSTRAINT "SkillMergeRequest_rollbackTargetSkillVersionOid_fkey" FOREIGN KEY ("rollbackTargetSkillVersionOid") REFERENCES "SkillVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillMergeRequest" ADD CONSTRAINT "SkillMergeRequest_createdByResourceActorOid_fkey" FOREIGN KEY ("createdByResourceActorOid") REFERENCES "ResourceActor"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillMergeRequest" ADD CONSTRAINT "SkillMergeRequest_mergeStartedByResourceActorOid_fkey" FOREIGN KEY ("mergeStartedByResourceActorOid") REFERENCES "ResourceActor"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillMergeRequest" ADD CONSTRAINT "SkillMergeRequest_mergedByResourceActorOid_fkey" FOREIGN KEY ("mergedByResourceActorOid") REFERENCES "ResourceActor"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillMergeRequest" ADD CONSTRAINT "SkillMergeRequest_closedByResourceActorOid_fkey" FOREIGN KEY ("closedByResourceActorOid") REFERENCES "ResourceActor"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillMergeRequest" ADD CONSTRAINT "SkillMergeRequest_rolledBackByResourceActorOid_fkey" FOREIGN KEY ("rolledBackByResourceActorOid") REFERENCES "ResourceActor"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillForkSync" ADD CONSTRAINT "SkillForkSync_resourceTenantOid_fkey" FOREIGN KEY ("resourceTenantOid") REFERENCES "ResourceTenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillForkSync" ADD CONSTRAINT "SkillForkSync_resourceGroupOid_fkey" FOREIGN KEY ("resourceGroupOid") REFERENCES "ResourceGroup"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillForkSync" ADD CONSTRAINT "SkillForkSync_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillForkSync" ADD CONSTRAINT "SkillForkSync_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillForkSync" ADD CONSTRAINT "SkillForkSync_forkSkillOid_fkey" FOREIGN KEY ("forkSkillOid") REFERENCES "Skill"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillForkSync" ADD CONSTRAINT "SkillForkSync_upstreamSkillOid_fkey" FOREIGN KEY ("upstreamSkillOid") REFERENCES "Skill"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillForkSync" ADD CONSTRAINT "SkillForkSync_createdByResourceActorOid_fkey" FOREIGN KEY ("createdByResourceActorOid") REFERENCES "ResourceActor"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillForkSync" ADD CONSTRAINT "SkillForkSync_generatedMergeRequestOid_fkey" FOREIGN KEY ("generatedMergeRequestOid") REFERENCES "SkillMergeRequest"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillMergeRequestItem" ADD CONSTRAINT "SkillMergeRequestItem_skillMergeRequestOid_fkey" FOREIGN KEY ("skillMergeRequestOid") REFERENCES "SkillMergeRequest"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillMergeRequestItem" ADD CONSTRAINT "SkillMergeRequestItem_baseFileOid_fkey" FOREIGN KEY ("baseFileOid") REFERENCES "File"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillMergeRequestItem" ADD CONSTRAINT "SkillMergeRequestItem_sourceFileOid_fkey" FOREIGN KEY ("sourceFileOid") REFERENCES "File"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillMergeRequestItem" ADD CONSTRAINT "SkillMergeRequestItem_targetFileOid_fkey" FOREIGN KEY ("targetFileOid") REFERENCES "File"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillMergeRequestItem" ADD CONSTRAINT "SkillMergeRequestItem_baseDocumentOid_fkey" FOREIGN KEY ("baseDocumentOid") REFERENCES "Document"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillMergeRequestItem" ADD CONSTRAINT "SkillMergeRequestItem_sourceDocumentOid_fkey" FOREIGN KEY ("sourceDocumentOid") REFERENCES "Document"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillMergeRequestItem" ADD CONSTRAINT "SkillMergeRequestItem_targetDocumentOid_fkey" FOREIGN KEY ("targetDocumentOid") REFERENCES "Document"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillMergeRequestItem" ADD CONSTRAINT "SkillMergeRequestItem_baseDocumentVersionOid_fkey" FOREIGN KEY ("baseDocumentVersionOid") REFERENCES "DocumentVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillMergeRequestItem" ADD CONSTRAINT "SkillMergeRequestItem_sourceDocumentVersionOid_fkey" FOREIGN KEY ("sourceDocumentVersionOid") REFERENCES "DocumentVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillMergeRequestItem" ADD CONSTRAINT "SkillMergeRequestItem_targetDocumentVersionOid_fkey" FOREIGN KEY ("targetDocumentVersionOid") REFERENCES "DocumentVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillMergeRequestItem" ADD CONSTRAINT "SkillMergeRequestItem_resolvedByResourceActorOid_fkey" FOREIGN KEY ("resolvedByResourceActorOid") REFERENCES "ResourceActor"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillMergeRequestComment" ADD CONSTRAINT "SkillMergeRequestComment_skillMergeRequestOid_fkey" FOREIGN KEY ("skillMergeRequestOid") REFERENCES "SkillMergeRequest"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillMergeRequestComment" ADD CONSTRAINT "SkillMergeRequestComment_skillMergeRequestItemOid_fkey" FOREIGN KEY ("skillMergeRequestItemOid") REFERENCES "SkillMergeRequestItem"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillMergeRequestComment" ADD CONSTRAINT "SkillMergeRequestComment_inReplyToCommentOid_fkey" FOREIGN KEY ("inReplyToCommentOid") REFERENCES "SkillMergeRequestComment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillMergeRequestComment" ADD CONSTRAINT "SkillMergeRequestComment_resourceActorOid_fkey" FOREIGN KEY ("resourceActorOid") REFERENCES "ResourceActor"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillMergeRequestEvent" ADD CONSTRAINT "SkillMergeRequestEvent_skillMergeRequestOid_fkey" FOREIGN KEY ("skillMergeRequestOid") REFERENCES "SkillMergeRequest"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillMergeRequestEvent" ADD CONSTRAINT "SkillMergeRequestEvent_resourceActorOid_fkey" FOREIGN KEY ("resourceActorOid") REFERENCES "ResourceActor"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillMergeRequestEvent" ADD CONSTRAINT "SkillMergeRequestEvent_commentOid_fkey" FOREIGN KEY ("commentOid") REFERENCES "SkillMergeRequestComment"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillPlugin" ADD CONSTRAINT "SkillPlugin_skillConfigurationOid_fkey" FOREIGN KEY ("skillConfigurationOid") REFERENCES "SkillConfiguration"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillPlugin" ADD CONSTRAINT "SkillPlugin_destinationOid_fkey" FOREIGN KEY ("destinationOid") REFERENCES "SkillDestination"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillPlugin" ADD CONSTRAINT "SkillPlugin_resourceTenantOid_fkey" FOREIGN KEY ("resourceTenantOid") REFERENCES "ResourceTenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillPlugin" ADD CONSTRAINT "SkillPlugin_resourceGroupOid_fkey" FOREIGN KEY ("resourceGroupOid") REFERENCES "ResourceGroup"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillPlugin" ADD CONSTRAINT "SkillPlugin_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillPlugin" ADD CONSTRAINT "SkillPlugin_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillPlugin" ADD CONSTRAINT "SkillPlugin_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillMarketplacePlugin" ADD CONSTRAINT "SkillMarketplacePlugin_skillConfigurationOid_fkey" FOREIGN KEY ("skillConfigurationOid") REFERENCES "SkillConfiguration"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillMarketplacePlugin" ADD CONSTRAINT "SkillMarketplacePlugin_skillMarketplaceOid_fkey" FOREIGN KEY ("skillMarketplaceOid") REFERENCES "SkillMarketplace"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillMarketplacePlugin" ADD CONSTRAINT "SkillMarketplacePlugin_skillPluginOid_fkey" FOREIGN KEY ("skillPluginOid") REFERENCES "SkillPlugin"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillPluginRepository" ADD CONSTRAINT "SkillPluginRepository_skillPluginOid_fkey" FOREIGN KEY ("skillPluginOid") REFERENCES "SkillPlugin"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillPluginRepository" ADD CONSTRAINT "SkillPluginRepository_skillRepositoryOid_fkey" FOREIGN KEY ("skillRepositoryOid") REFERENCES "SkillRepository"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillPluginSkill" ADD CONSTRAINT "SkillPluginSkill_skillConfigurationOid_fkey" FOREIGN KEY ("skillConfigurationOid") REFERENCES "SkillConfiguration"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillPluginSkill" ADD CONSTRAINT "SkillPluginSkill_skillOid_fkey" FOREIGN KEY ("skillOid") REFERENCES "Skill"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillPluginSkill" ADD CONSTRAINT "SkillPluginSkill_skillPluginOid_fkey" FOREIGN KEY ("skillPluginOid") REFERENCES "SkillPlugin"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagedSkillPlugin" ADD CONSTRAINT "ManagedSkillPlugin_skillOid_fkey" FOREIGN KEY ("skillOid") REFERENCES "Skill"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagedSkillPlugin" ADD CONSTRAINT "ManagedSkillPlugin_skillPluginOid_fkey" FOREIGN KEY ("skillPluginOid") REFERENCES "SkillPlugin"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillRepository" ADD CONSTRAINT "SkillRepository_resourceTenantOid_fkey" FOREIGN KEY ("resourceTenantOid") REFERENCES "ResourceTenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillRepository" ADD CONSTRAINT "SkillRepository_resourceGroupOid_fkey" FOREIGN KEY ("resourceGroupOid") REFERENCES "ResourceGroup"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillRepository" ADD CONSTRAINT "SkillRepository_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillRepository" ADD CONSTRAINT "SkillRepository_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillRepository" ADD CONSTRAINT "SkillRepository_lastPropagatedManifestOid_fkey" FOREIGN KEY ("lastPropagatedManifestOid") REFERENCES "SkillDestinationManifest"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_resourceTenantOid_fkey" FOREIGN KEY ("resourceTenantOid") REFERENCES "ResourceTenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_resourceGroupOid_fkey" FOREIGN KEY ("resourceGroupOid") REFERENCES "ResourceGroup"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_storeOid_fkey" FOREIGN KEY ("storeOid") REFERENCES "Store"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_parentSkillOid_fkey" FOREIGN KEY ("parentSkillOid") REFERENCES "Skill"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_forkedFromSkillVersionOid_fkey" FOREIGN KEY ("forkedFromSkillVersionOid") REFERENCES "SkillVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_parentSkillTemplateOid_fkey" FOREIGN KEY ("parentSkillTemplateOid") REFERENCES "SkillTemplate"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_createdByResourceActorOid_fkey" FOREIGN KEY ("createdByResourceActorOid") REFERENCES "ResourceActor"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_createdByOrganizationActorOid_fkey" FOREIGN KEY ("createdByOrganizationActorOid") REFERENCES "OrganizationActor"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_createdByConsumerOid_fkey" FOREIGN KEY ("createdByConsumerOid") REFERENCES "Consumer"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_createdByConsumerProfileOid_fkey" FOREIGN KEY ("createdByConsumerProfileOid") REFERENCES "ConsumerProfile"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillVersion" ADD CONSTRAINT "SkillVersion_skillOid_fkey" FOREIGN KEY ("skillOid") REFERENCES "Skill"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillVersion" ADD CONSTRAINT "SkillVersion_storeVersionOid_fkey" FOREIGN KEY ("storeVersionOid") REFERENCES "StoreVersion"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillDestination" ADD CONSTRAINT "SkillDestination_currentManifestOid_fkey" FOREIGN KEY ("currentManifestOid") REFERENCES "SkillDestinationManifest"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillDestinationFile" ADD CONSTRAINT "SkillDestinationFile_destinationOid_fkey" FOREIGN KEY ("destinationOid") REFERENCES "SkillDestination"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillDestinationManifest" ADD CONSTRAINT "SkillDestinationManifest_destinationOid_fkey" FOREIGN KEY ("destinationOid") REFERENCES "SkillDestination"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillDestinationDeletedFile" ADD CONSTRAINT "SkillDestinationDeletedFile_destinationOid_fkey" FOREIGN KEY ("destinationOid") REFERENCES "SkillDestination"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillDestinationItem" ADD CONSTRAINT "SkillDestinationItem_destinationOid_fkey" FOREIGN KEY ("destinationOid") REFERENCES "SkillDestination"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillDestinationItem" ADD CONSTRAINT "SkillDestinationItem_skillMarketplaceOid_fkey" FOREIGN KEY ("skillMarketplaceOid") REFERENCES "SkillMarketplace"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillDestinationItem" ADD CONSTRAINT "SkillDestinationItem_skillPluginOid_fkey" FOREIGN KEY ("skillPluginOid") REFERENCES "SkillPlugin"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillDestinationItem" ADD CONSTRAINT "SkillDestinationItem_skillOid_fkey" FOREIGN KEY ("skillOid") REFERENCES "Skill"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillDestinationSync" ADD CONSTRAINT "SkillDestinationSync_destinationOid_fkey" FOREIGN KEY ("destinationOid") REFERENCES "SkillDestination"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillDestinationSync" ADD CONSTRAINT "SkillDestinationSync_manifestOid_fkey" FOREIGN KEY ("manifestOid") REFERENCES "SkillDestinationManifest"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillDestinationSyncRepositoryPropagation" ADD CONSTRAINT "SkillDestinationSyncRepositoryPropagation_manifestOid_fkey" FOREIGN KEY ("manifestOid") REFERENCES "SkillDestinationManifest"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillDestinationSyncRepositoryPropagation" ADD CONSTRAINT "SkillDestinationSyncRepositoryPropagation_skillDestination_fkey" FOREIGN KEY ("skillDestinationSyncOid") REFERENCES "SkillDestinationSync"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillDestinationSyncRepositoryPropagation" ADD CONSTRAINT "SkillDestinationSyncRepositoryPropagation_skillRepositoryO_fkey" FOREIGN KEY ("skillRepositoryOid") REFERENCES "SkillRepository"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillParticipant" ADD CONSTRAINT "SkillParticipant_skillOid_fkey" FOREIGN KEY ("skillOid") REFERENCES "Skill"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillParticipant" ADD CONSTRAINT "SkillParticipant_resourceActorOid_fkey" FOREIGN KEY ("resourceActorOid") REFERENCES "ResourceActor"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillTemplate" ADD CONSTRAINT "SkillTemplate_storeTemplateOid_fkey" FOREIGN KEY ("storeTemplateOid") REFERENCES "StoreTemplate"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillTemplate" ADD CONSTRAINT "SkillTemplate_resourceTenantOid_fkey" FOREIGN KEY ("resourceTenantOid") REFERENCES "ResourceTenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillTemplate" ADD CONSTRAINT "SkillTemplate_resourceGroupOid_fkey" FOREIGN KEY ("resourceGroupOid") REFERENCES "ResourceGroup"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillTemplate" ADD CONSTRAINT "SkillTemplate_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillTemplate" ADD CONSTRAINT "SkillTemplate_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillTemplate" ADD CONSTRAINT "SkillTemplate_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceGroup" ADD CONSTRAINT "ResourceGroup_resourceTenantOid_fkey" FOREIGN KEY ("resourceTenantOid") REFERENCES "ResourceTenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceActor" ADD CONSTRAINT "ResourceActor_resourceTenantOid_fkey" FOREIGN KEY ("resourceTenantOid") REFERENCES "ResourceTenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceActor" ADD CONSTRAINT "ResourceActor_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceActor" ADD CONSTRAINT "ResourceActor_organizationActorOid_fkey" FOREIGN KEY ("organizationActorOid") REFERENCES "OrganizationActor"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceActor" ADD CONSTRAINT "ResourceActor_consumerOid_fkey" FOREIGN KEY ("consumerOid") REFERENCES "Consumer"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceActor" ADD CONSTRAINT "ResourceActor_consumerProfileOid_fkey" FOREIGN KEY ("consumerProfileOid") REFERENCES "ConsumerProfile"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_resourceTenantOid_fkey" FOREIGN KEY ("resourceTenantOid") REFERENCES "ResourceTenant"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_resourceGroupOid_fkey" FOREIGN KEY ("resourceGroupOid") REFERENCES "ResourceGroup"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_globalProfileOid_fkey" FOREIGN KEY ("globalProfileOid") REFERENCES "GlobalProfile"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userOid_fkey" FOREIGN KEY ("userOid") REFERENCES "User"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebDiscovery" ADD CONSTRAINT "WebDiscovery_bestPageOid_fkey" FOREIGN KEY ("bestPageOid") REFERENCES "WebPage"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventDeliveryIntent" ADD CONSTRAINT "EventDeliveryIntent_systemEventOid_fkey" FOREIGN KEY ("systemEventOid") REFERENCES "SystemEvent"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventDeliveryIntent" ADD CONSTRAINT "EventDeliveryIntent_eventDestinationOid_fkey" FOREIGN KEY ("eventDestinationOid") REFERENCES "EventDestination"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventDeliveryIntent" ADD CONSTRAINT "EventDeliveryIntent_eventDestinationListenerOid_fkey" FOREIGN KEY ("eventDestinationListenerOid") REFERENCES "EventDestinationListener"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventDeliveryIntent" ADD CONSTRAINT "EventDeliveryIntent_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventDeliveryIntent" ADD CONSTRAINT "EventDeliveryIntent_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventDeliveryAttempt" ADD CONSTRAINT "EventDeliveryAttempt_intentOid_fkey" FOREIGN KEY ("intentOid") REFERENCES "EventDeliveryIntent"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventDeliveryAttempt" ADD CONSTRAINT "EventDeliveryAttempt_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventDestination" ADD CONSTRAINT "EventDestination_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventDestination" ADD CONSTRAINT "EventDestination_webhookDestinationOid_fkey" FOREIGN KEY ("webhookDestinationOid") REFERENCES "WebhookDestination"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventDestinationListener" ADD CONSTRAINT "EventDestinationListener_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventDestinationListener" ADD CONSTRAINT "EventDestinationListener_eventDestinationOid_fkey" FOREIGN KEY ("eventDestinationOid") REFERENCES "EventDestination"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemEvent" ADD CONSTRAINT "SystemEvent_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemEvent" ADD CONSTRAINT "SystemEvent_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDestination" ADD CONSTRAINT "WebhookDestination_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

