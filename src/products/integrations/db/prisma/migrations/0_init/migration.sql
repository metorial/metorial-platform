-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AdapterIntegrationInstanceStatus" AS ENUM ('draft', 'active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "AdapterIntegrationInstanceProviderStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "AdapterIntegrationType" AS ENUM ('chat');

-- CreateEnum
CREATE TYPE "AdapterIntegrationStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "AdapterIntegrationProviderStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "AdapterIntegrationInstanceProviderSessionStatus" AS ENUM ('active', 'rotated', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "AgentType" AS ENUM ('mcp_client', 'custom', 'tool_call');

-- CreateEnum
CREATE TYPE "AgentClientType" AS ENUM ('mcp_client_oauth', 'system_client');

-- CreateEnum
CREATE TYPE "AgentInstanceType" AS ENUM ('mcp_client', 'tool_call');

-- CreateEnum
CREATE TYPE "ProviderAuthConfigType" AS ENUM ('manual', 'oauth_automated', 'oauth_manual');

-- CreateEnum
CREATE TYPE "ProviderAuthConfigSource" AS ENUM ('explorer', 'manual', 'setup_session', 'system', 'public_mcp');

-- CreateEnum
CREATE TYPE "ProviderAuthConfigStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "ProviderAuthCredentialsStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "ProviderAuthCredentialsType" AS ENUM ('oauth');

-- CreateEnum
CREATE TYPE "ProviderAuthCredentialsOrigin" AS ENUM ('tenant_created', 'managed_public', 'managed_backing');

-- CreateEnum
CREATE TYPE "ManagedProviderAuthCredentialsStatus" AS ENUM ('active', 'archived');

-- CreateEnum
CREATE TYPE "ProviderAuthConfigEventStatus" AS ENUM ('succeeded', 'failed');

-- CreateEnum
CREATE TYPE "ProviderOAuthSetupStatus" AS ENUM ('unused', 'opened', 'completed', 'failed', 'expired');

-- CreateEnum
CREATE TYPE "BackendType" AS ENUM ('slates', 'shuttle', 'native');

-- CreateEnum
CREATE TYPE "ShuttleServerType" AS ENUM ('container', 'function', 'remote');

-- CreateEnum
CREATE TYPE "ShuttleServerRemoteProtocol" AS ENUM ('sse', 'streamable_http', 'stateless');

-- CreateEnum
CREATE TYPE "CallbackStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "CallbackSyncStatus" AS ENUM ('pending', 'synced', 'failed');

-- CreateEnum
CREATE TYPE "CallbackOwnership" AS ENUM ('user', 'managed');

-- CreateEnum
CREATE TYPE "CallbackEventStatus" AS ENUM ('pending', 'processed', 'failed');

-- CreateEnum
CREATE TYPE "CallbackEventSource" AS ENUM ('webhook', 'polling', 'internal');

-- CreateEnum
CREATE TYPE "CallbackInstanceStatusV2" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "CallbackInstanceSyncStatus" AS ENUM ('pending', 'synced', 'failed');

-- CreateEnum
CREATE TYPE "CallbackInstanceGenerationStatus" AS ENUM ('provisioning', 'primary', 'replaced');

-- CreateEnum
CREATE TYPE "WebhookRegistrationStatus" AS ENUM ('awaiting_setup', 'active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "ChatAuthorType" AS ENUM ('user', 'app', 'system', 'webhook', 'unknown');

-- CreateEnum
CREATE TYPE "ChatAuthorRole" AS ENUM ('member', 'guest', 'unknown');

-- CreateEnum
CREATE TYPE "ChatChannelType" AS ENUM ('public', 'private', 'dm', 'group_dm', 'shared', 'announcement', 'forum', 'unknown');

-- CreateEnum
CREATE TYPE "ChatThreadType" AS ENUM ('conversation', 'dm', 'post');

-- CreateEnum
CREATE TYPE "ChatStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "ChatConnectionStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "ChatConnectionProviderStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "ChatInstanceStatus" AS ENUM ('draft', 'active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "ChatInstanceProviderStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "CustomProviderCommitStatus" AS ENUM ('pending', 'applied', 'failed');

-- CreateEnum
CREATE TYPE "CustomProviderCommitTrigger" AS ENUM ('manual', 'system', 'scm');

-- CreateEnum
CREATE TYPE "CustomProviderCommitType" AS ENUM ('create_version', 'merge_version_into_environment', 'rollback_to_version');

-- CreateEnum
CREATE TYPE "CustomProviderDeploymentStatus" AS ENUM ('queued', 'deploying', 'succeeded', 'failed');

-- CreateEnum
CREATE TYPE "CustomProviderDeploymentTrigger" AS ENUM ('manual', 'system', 'scm');

-- CreateEnum
CREATE TYPE "CustomProviderType" AS ENUM ('container', 'function', 'remote');

-- CreateEnum
CREATE TYPE "CustomProviderStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "UpcomingCustomProviderType" AS ENUM ('create_custom_provider', 'create_custom_provider_version');

-- CreateEnum
CREATE TYPE "CustomProviderVersionStatus" AS ENUM ('queued', 'deploying', 'deployment_succeeded', 'deployment_failed');

-- CreateEnum
CREATE TYPE "ProviderConfigStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "ProviderDeploymentStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "ProviderDeploymentConfigPairSpecificationDiscoveryStatus" AS ENUM ('discovering', 'discovered', 'failed');

-- CreateEnum
CREATE TYPE "ProviderDeploymentConfigPairDiscoveryStatus" AS ENUM ('failed', 'succeeded_with_warnings');

-- CreateEnum
CREATE TYPE "ProviderConfigVaultStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "EnclaveEnvironmentType" AS ENUM ('metorial', 'outpost');

-- CreateEnum
CREATE TYPE "FirewallStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "FirewallBindingTargetType" AS ENUM ('enclave', 'provider', 'network');

-- CreateEnum
CREATE TYPE "NetworkPolicyStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "EnclaveIngressNetworkLogResult" AS ENUM ('allowed', 'denied');

-- CreateEnum
CREATE TYPE "IdentityActorType" AS ENUM ('organization_member', 'person', 'agent', 'consumer');

-- CreateEnum
CREATE TYPE "IdentityActorStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "IdentityDelegationPermissions" AS ENUM ('provider_call', 'provider_read');

-- CreateEnum
CREATE TYPE "IdentityDelegationStatus" AS ENUM ('waiting_for_consent', 'denied', 'active', 'revoked', 'expired');

-- CreateEnum
CREATE TYPE "IdentityDelegationDeniedReason" AS ENUM ('request_denied', 'sub_delegation_depth_exceeded', 'sub_delegation_denied');

-- CreateEnum
CREATE TYPE "IdentityDelegationCredentialOverrideStatus" AS ENUM ('active', 'expired');

-- CreateEnum
CREATE TYPE "IdentityDelegationPartyRole" AS ENUM ('owner', 'delegator', 'delegatee');

-- CreateEnum
CREATE TYPE "IdentityDelegationAttestationType" AS ENUM ('api', 'request_approval', 'covered_by_previously_approved_delegation');

-- CreateEnum
CREATE TYPE "IdentityDelegationConfigStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "IdentityDelegationConfigSubDelegationBehavior" AS ENUM ('allow', 'deny', 'require_consent');

-- CreateEnum
CREATE TYPE "IdentityStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "IdentityCredentialStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "IdentityDelegationRequestStatus" AS ENUM ('pending', 'approved', 'denied', 'canceled');

-- CreateEnum
CREATE TYPE "IntegrationResourceSource" AS ENUM ('explorer');

-- CreateEnum
CREATE TYPE "MagicMcpServerOwnerType" AS ENUM ('server_owned', 'provider_template', 'integration');

-- CreateEnum
CREATE TYPE "MagicMcpServerProviderStatus" AS ENUM ('pending', 'active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "IntegrationInstanceStatus" AS ENUM ('draft', 'active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "IntegrationInstanceProviderStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "IntegrationInstanceGroupStatus" AS ENUM ('draft', 'active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "IntegrationInstanceGroupSourceStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "IntegrationInstanceGroupProviderStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "IntegrationProviderStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "ProviderListingStatus" AS ENUM ('active', 'archived', 'banned');

-- CreateEnum
CREATE TYPE "MonitorAlertStatus" AS ENUM ('pending', 'resolved', 'ignored');

-- CreateEnum
CREATE TYPE "MonitorAlertEventType" AS ENUM ('created', 'viewed', 'resolved', 'unresolved');

-- CreateEnum
CREATE TYPE "MonitorTarget" AS ENUM ('protoguard_filter', 'schema_change');

-- CreateEnum
CREATE TYPE "MonitorStatus" AS ENUM ('active', 'inactive', 'archived');

-- CreateEnum
CREATE TYPE "MonitorOwner" AS ENUM ('tenant', 'system');

-- CreateEnum
CREATE TYPE "ProviderAccess" AS ENUM ('public', 'tenant');

-- CreateEnum
CREATE TYPE "ProviderStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "ProviderAuthMethodType" AS ENUM ('oauth', 'token', 'service_account', 'custom');

-- CreateEnum
CREATE TYPE "ProviderSpecificationType" AS ENUM ('preliminary', 'full');

-- CreateEnum
CREATE TYPE "ProviderSpecificationChangeNotificationTarget" AS ENUM ('version', 'deployment_config_pair');

-- CreateEnum
CREATE TYPE "ProviderVersionSpecificationDiscoveryStatus" AS ENUM ('discovering', 'discovered', 'waiting_for_pair', 'not_discoverable');

-- CreateEnum
CREATE TYPE "PublicMcpServerAuthorizationStatus" AS ENUM ('pending', 'setup', 'code_issued', 'exchanged', 'denied', 'failed', 'expired');

-- CreateEnum
CREATE TYPE "PublicMcpServerClientAuthMethod" AS ENUM ('client_secret_basic', 'client_secret_post', 'none');

-- CreateEnum
CREATE TYPE "PublicMcpServerGrantStatus" AS ENUM ('pending_exchange', 'active', 'revoked', 'expired');

-- CreateEnum
CREATE TYPE "PublicMcpServerGrantRevocationReason" AS ENUM ('owner_revoked', 'user_revoked', 'refresh_token_reuse', 'authorization_code_reuse', 'server_archived', 'idle_expired', 'exchange_expired');

-- CreateEnum
CREATE TYPE "PublicMcpServerStatus" AS ENUM ('active', 'disabled', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "PublicMcpServerTokenType" AS ENUM ('access', 'refresh');

-- CreateEnum
CREATE TYPE "PublisherType" AS ENUM ('tenant', 'metorial', 'external');

-- CreateEnum
CREATE TYPE "ScmProvider" AS ENUM ('github', 'gitlab', 'bitbucket');

-- CreateEnum
CREATE TYPE "SessionConnectionStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "SessionConnectionState" AS ENUM ('connected', 'disconnected');

-- CreateEnum
CREATE TYPE "SessionConnectionInitState" AS ENUM ('pending', 'completed');

-- CreateEnum
CREATE TYPE "SessionConnectionMcpConnectionTransport" AS ENUM ('none', 'sse', 'streamable_http', 'sessionless');

-- CreateEnum
CREATE TYPE "SessionConnectionTransport" AS ENUM ('mcp', 'tool_call', 'metorial_protocol', 'system');

-- CreateEnum
CREATE TYPE "SessionConnectionProviderSpecificationStatus" AS ENUM ('discovering', 'discovered', 'failed');

-- CreateEnum
CREATE TYPE "EphemeralManagedSessionStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "SessionErrorType" AS ENUM ('message_processing_timeout', 'message_processing_provider_error', 'message_processing_system_error', 'provider_discovery_failed');

-- CreateEnum
CREATE TYPE "SessionEventType" AS ENUM ('session_created', 'session_started', 'provider_run_started', 'provider_run_stopped', 'message_created', 'message_processed', 'connection_created', 'connection_connected', 'connection_disconnected', 'connection_disabled', 'error_occurred', 'warning_occurred');

-- CreateEnum
CREATE TYPE "SessionDataRetentionLevel" AS ENUM ('full', 'intent_only', 'none');

-- CreateEnum
CREATE TYPE "SessionMessageStatus" AS ENUM ('waiting_for_response', 'failed', 'succeeded');

-- CreateEnum
CREATE TYPE "SessionMessageType" AS ENUM ('tool_call', 'mcp_control', 'mcp_message', 'unknown');

-- CreateEnum
CREATE TYPE "SessionMessageSource" AS ENUM ('client', 'provider');

-- CreateEnum
CREATE TYPE "SessionMessageFailureReason" AS ENUM ('timeout', 'provider_error', 'system_error', 'none');

-- CreateEnum
CREATE TYPE "SessionParticipantType" AS ENUM ('mcp_client', 'metorial_protocol_client', 'tool_call', 'agent', 'provider', 'system', 'unknown');

-- CreateEnum
CREATE TYPE "SessionParticipantConnectionType" AS ENUM ('mcp', 'metorial_protocol', 'tool_call');

-- CreateEnum
CREATE TYPE "ProtoGuardIssueType" AS ENUM ('instruction_override', 'role_hijack', 'jailbreak_persona', 'prompt_exfiltration', 'tool_call_forgery', 'format_break', 'instruction_block', 'unicode_smuggling', 'encoded_payload', 'typoglycemia');

-- CreateEnum
CREATE TYPE "ProtoGuardSeverity" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "ProtoGuardRunStatus" AS ENUM ('completed', 'failed');

-- CreateEnum
CREATE TYPE "SessionProviderStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "ProviderRunStatus" AS ENUM ('running', 'stopped');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "SessionTemplateStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "SessionTemplateProviderStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "SkillStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "SkillIntegrationStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "SkillProviderStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "SkillItemType" AS ENUM ('integration', 'provider');

-- CreateEnum
CREATE TYPE "SkillItemStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "SkillTemplateStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "SkillTemplateOwner" AS ENUM ('system', 'tenant');

-- CreateEnum
CREATE TYPE "ConsumerProfileInviteStatus" AS ENUM ('unset', 'invited', 'accepted');

-- CreateEnum
CREATE TYPE "ConsumerProfileStatus" AS ENUM ('active', 'deleted');

-- CreateEnum
CREATE TYPE "InstanceType" AS ENUM ('development', 'production');

-- CreateEnum
CREATE TYPE "InstanceStatus" AS ENUM ('active', 'deleted');

-- CreateEnum
CREATE TYPE "EnvironmentType" AS ENUM ('development', 'production');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('external', 'system');

-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('default', 'user');

-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('active', 'deleted');

-- CreateEnum
CREATE TYPE "OrganizationActorType" AS ENUM ('member', 'machine_access', 'system', 'oauth_application', 'agent', 'consumer_profile');

-- CreateEnum
CREATE TYPE "OrganizationMemberRole" AS ENUM ('admin', 'member');

-- CreateEnum
CREATE TYPE "OrganizationMemberStatus" AS ENUM ('active', 'deleted');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('active', 'deleted');

-- CreateEnum
CREATE TYPE "ProviderSetupSessionStatus" AS ENUM ('pending', 'completed', 'failed', 'expired', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "ProviderSetupSessionType" AS ENUM ('auth_only', 'config_only', 'auth_and_config', 'admin', 'auto');

-- CreateEnum
CREATE TYPE "ProviderSetupSessionTypeConcrete" AS ENUM ('auth_only', 'config_only', 'auth_and_config', 'admin');

-- CreateEnum
CREATE TYPE "ProviderSetupSessionUiMode" AS ENUM ('metorial_elements', 'dashboard_embeddable');

-- CreateEnum
CREATE TYPE "ProviderSetupSessionEventType" AS ENUM ('created', 'link_opened', 'config_set', 'auth_config_set', 'oauth_setup_completed', 'oauth_setup_failed', 'completed', 'expired');

-- CreateEnum
CREATE TYPE "IntegrationSetupSessionStatus" AS ENUM ('pending', 'successful', 'expired', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "IntegrationSetupSessionEventType" AS ENUM ('created', 'link_opened', 'provider_started', 'provider_completed', 'completed', 'expired');

-- CreateTable
CREATE TABLE "AdapterIntegrationInstance" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "AdapterIntegrationInstanceStatus" NOT NULL,
    "isStandalone" BOOLEAN NOT NULL,
    "adapterIntegrationOid" BIGINT NOT NULL,
    "integrationInstanceOid" BIGINT NOT NULL,
    "integrationOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT NOT NULL,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "solutionOid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdapterIntegrationInstance_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "AdapterIntegrationInstanceProvider" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "AdapterIntegrationInstanceProviderStatus" NOT NULL,
    "adapterIntegrationInstanceOid" BIGINT NOT NULL,
    "adapterIntegrationProviderOid" BIGINT NOT NULL,
    "adapterIntegrationOid" BIGINT NOT NULL,
    "integrationInstanceProviderOid" BIGINT NOT NULL,
    "integrationInstanceOid" BIGINT NOT NULL,
    "integrationProviderOid" BIGINT NOT NULL,
    "integrationOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT NOT NULL,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "solutionOid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentSessionOid" BIGINT,
    "providerHash" TEXT,
    "willRotateSessionAt" TIMESTAMP(3),

    CONSTRAINT "AdapterIntegrationInstanceProvider_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "AdapterIntegration" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "AdapterIntegrationType" NOT NULL,
    "status" "AdapterIntegrationStatus" NOT NULL,
    "isStandalone" BOOLEAN NOT NULL,
    "adapterGlobalOid" BIGINT NOT NULL,
    "integrationOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT NOT NULL,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "solutionOid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdapterIntegration_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "AdapterIntegrationProvider" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "AdapterIntegrationProviderStatus" NOT NULL,
    "adapterIntegrationOid" BIGINT NOT NULL,
    "integrationOid" BIGINT NOT NULL,
    "integrationProviderOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT NOT NULL,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "solutionOid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdapterIntegrationProvider_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "AdapterIntegrationInstanceProviderSession" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "AdapterIntegrationInstanceProviderSessionStatus" NOT NULL,
    "rotatedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "adapterIntegrationInstanceProviderOid" BIGINT NOT NULL,
    "sessionOid" BIGINT NOT NULL,
    "adapterIntegrationInstanceOid" BIGINT NOT NULL,
    "adapterIntegrationOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT NOT NULL,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "solutionOid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdapterIntegrationInstanceProviderSession_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Agent" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "AgentStatus" NOT NULL,
    "isParentDeleted" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "slug" TEXT NOT NULL,
    "metadata" JSONB,
    "privateMetadata" JSONB,
    "hash" TEXT,
    "type" "AgentType" NOT NULL DEFAULT 'custom',
    "actorOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "solutionOid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "AgentClient" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AgentClientType" NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "solutionOid" INTEGER NOT NULL,
    "privateMetadata" JSONB,
    "foreignId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastConnectedAt" TIMESTAMP(3),

    CONSTRAINT "AgentClient_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "AgentClientRegistration" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "privateMetadata" JSONB,
    "oauthRegistrationId" TEXT,
    "agentClientOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentClientRegistration_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "AgentInstance" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT,
    "description" TEXT,
    "hash" TEXT NOT NULL,
    "type" "AgentInstanceType" NOT NULL,
    "agentOid" BIGINT NOT NULL,
    "agentClientOid" BIGINT,
    "agentClientRegistrationOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastConnectedAt" TIMESTAMP(3),

    CONSTRAINT "AgentInstance_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderAuthConfig" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "ProviderAuthConfigType" NOT NULL,
    "source" "ProviderAuthConfigSource" NOT NULL,
    "status" "ProviderAuthConfigStatus" NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "isParentDeleted" BOOLEAN NOT NULL DEFAULT false,
    "isEphemeral" BOOLEAN NOT NULL,
    "isDefault" BOOLEAN NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "privateMetadata" JSONB,
    "scopes" JSONB NOT NULL DEFAULT '[]',
    "needsScopeSync" BOOLEAN NOT NULL DEFAULT true,
    "toolFilter" JSONB NOT NULL DEFAULT '{"type":"v1.allow_all"}',
    "providerOid" BIGINT NOT NULL,
    "authMethodOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "solutionOid" INTEGER NOT NULL,
    "backendOid" BIGINT NOT NULL,
    "owningIntegrationInstanceOid" BIGINT,
    "owningIntegrationInstanceProviderOid" BIGINT,
    "isOwnerLocked" BOOLEAN NOT NULL DEFAULT false,
    "isOwnerOnlyVisible" BOOLEAN NOT NULL DEFAULT false,
    "isSystemOwned" BOOLEAN NOT NULL DEFAULT false,
    "ownerActorOid" BIGINT,
    "deploymentOid" BIGINT,
    "currentVersionOid" BIGINT,
    "authCredentialsOid" BIGINT,
    "ownerPublicMcpServerOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderAuthConfig_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderAuthConfigVersion" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "authConfigOid" BIGINT NOT NULL,
    "slateAuthConfigOid" BIGINT,
    "shuttleAuthConfigOid" BIGINT,
    "authCredentialsOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderAuthConfigVersion_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderAuthConfigUpdate" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "authConfigOid" BIGINT NOT NULL,
    "fromVersionOid" BIGINT,
    "toVersionOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderAuthConfigUpdate_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderAuthCredentials" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "ProviderAuthCredentialsType" NOT NULL,
    "status" "ProviderAuthCredentialsStatus" NOT NULL,
    "origin" "ProviderAuthCredentialsOrigin" NOT NULL DEFAULT 'tenant_created',
    "isEphemeral" BOOLEAN NOT NULL,
    "isDefault" BOOLEAN NOT NULL,
    "isAutoRegistration" BOOLEAN NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "privateMetadata" JSONB,
    "scopes" JSONB NOT NULL DEFAULT '[]',
    "needsScopeSync" BOOLEAN NOT NULL DEFAULT true,
    "tenantOid" BIGINT,
    "projectOid" BIGINT,
    "environmentOid" BIGINT,
    "instanceOid" BIGINT,
    "solutionOid" INTEGER,
    "providerOid" BIGINT NOT NULL,
    "backendOid" BIGINT NOT NULL,
    "slateCredentialsOid" BIGINT,
    "shuttleCredentialsOid" BIGINT,
    "managedCredentialsOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "ProviderAuthCredentials_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ManagedProviderAuthCredentials" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "ManagedProviderAuthCredentialsStatus" NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "solutionOid" INTEGER NOT NULL,
    "providerAuthMethodOid" BIGINT NOT NULL,
    "providerOid" BIGINT,
    "providerAuthMethodGlobalOid" BIGINT,
    "oauthClientId" TEXT NOT NULL,
    "oauthClientSecret" TEXT NOT NULL,
    "oauthScopes" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManagedProviderAuthCredentials_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ManagedProviderAuthCredentialsBacking" (
    "oid" BIGINT NOT NULL,
    "managedCredentialsOid" BIGINT NOT NULL,
    "providerAuthCredentialsOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "solutionOid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManagedProviderAuthCredentialsBacking_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderAuthConfigEvent" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "status" "ProviderAuthConfigEventStatus" NOT NULL DEFAULT 'succeeded',
    "providerInvocationId" TEXT,
    "payload" JSONB,
    "authConfigOid" BIGINT,
    "authCredentialsOid" BIGINT,
    "oauthSetupOid" BIGINT,
    "providerOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "environmentOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "instanceOid" BIGINT,
    "solutionOid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderAuthConfigEvent_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderAuthConfigErrorGlobal" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "firstOccurrenceOid" BIGINT,
    "providerOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "environmentOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "instanceOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "occurrenceCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProviderAuthConfigErrorGlobal_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderAuthConfigError" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "isParentDeleted" BOOLEAN NOT NULL DEFAULT false,
    "isProcessing" BOOLEAN NOT NULL,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "payload" JSONB,
    "providerInvocationId" TEXT,
    "groupOid" BIGINT,
    "authConfigEventOid" BIGINT,
    "authConfigOid" BIGINT,
    "authCredentialsOid" BIGINT,
    "oauthSetupOid" BIGINT,
    "providerOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "environmentOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "instanceOid" BIGINT,
    "solutionOid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderAuthConfigError_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderAuthExport" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "note" TEXT,
    "ip" TEXT,
    "ua" TEXT,
    "metadata" JSONB,
    "isParentDeleted" BOOLEAN NOT NULL DEFAULT false,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "solutionOid" INTEGER NOT NULL,
    "authConfigOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "ProviderAuthExport_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderAuthImport" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "ip" TEXT,
    "ua" TEXT,
    "note" TEXT,
    "metadata" JSONB,
    "isParentDeleted" BOOLEAN NOT NULL DEFAULT false,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "solutionOid" INTEGER NOT NULL,
    "authConfigOid" BIGINT NOT NULL,
    "authConfigUpdateOid" BIGINT NOT NULL,
    "deploymentOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "ProviderAuthImport_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderOAuthSetup" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "ProviderOAuthSetupStatus" NOT NULL DEFAULT 'unused',
    "clientSecret" TEXT NOT NULL,
    "isParentDeleted" BOOLEAN NOT NULL DEFAULT false,
    "isEphemeral" BOOLEAN NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "toolFilter" JSONB NOT NULL DEFAULT '{"type":"v1.allow_all"}',
    "redirectUrl" TEXT,
    "backendUrl" TEXT NOT NULL,
    "adminInstructions" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "authCredentialsOid" BIGINT NOT NULL,
    "authMethodOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "solutionOid" INTEGER NOT NULL,
    "providerOid" BIGINT NOT NULL,
    "deploymentOid" BIGINT,
    "authConfigOid" BIGINT,
    "slateOAuthSetupOid" BIGINT,
    "shuttleOAuthSetupOid" BIGINT,
    "ownerPublicMcpServerOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderOAuthSetup_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Backend" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "BackendType" NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Backend_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ShuttleOAuthCredentials" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "shuttleServerOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShuttleOAuthCredentials_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ShuttleOAuthSetup" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "shuttleServerOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShuttleOAuthSetup_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ShuttleAuthConfig" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "shuttleServerOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "providerAuthConfigUpdateOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShuttleAuthConfig_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ShuttleServerConfig" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "shuttleServerOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "lockedShuttleVersionOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShuttleServerConfig_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ShuttleCustomServer" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "shuttleTenantId" TEXT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "serverOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShuttleCustomServer_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ShuttleCustomServerDeployment" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "serverOid" BIGINT NOT NULL,
    "customServerOid" BIGINT NOT NULL,
    "serverVersionOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShuttleCustomServerDeployment_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ServerInstanceConfiguration" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServerInstanceConfiguration_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ShuttleConnection" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "providerRunOid" BIGINT NOT NULL,
    "shuttleServerOid" BIGINT NOT NULL,
    "shuttleServerVersionOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShuttleConnection_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ShuttleServer" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "ShuttleServerType" NOT NULL,
    "identifier" TEXT NOT NULL,
    "shuttleTenantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShuttleServer_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ShuttleServerVersion" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "serverOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShuttleServerVersion_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ShuttleSyncChangeNotificationCursor" (
    "backendOid" BIGINT NOT NULL,
    "cursor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShuttleSyncChangeNotificationCursor_pkey" PRIMARY KEY ("backendOid")
);

-- CreateTable
CREATE TABLE "ShuttleSyncAuthConfigEventCursor" (
    "backendOid" BIGINT NOT NULL,
    "cursor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShuttleSyncAuthConfigEventCursor_pkey" PRIMARY KEY ("backendOid")
);

-- CreateTable
CREATE TABLE "ShuttleSyncOAuthSetupEventCursor" (
    "backendOid" BIGINT NOT NULL,
    "cursor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShuttleSyncOAuthSetupEventCursor_pkey" PRIMARY KEY ("backendOid")
);

-- CreateTable
CREATE TABLE "ShuttleSyncMcpServerRegistryCursor" (
    "registryUrl" TEXT NOT NULL,
    "cursor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShuttleSyncMcpServerRegistryCursor_pkey" PRIMARY KEY ("registryUrl")
);

-- CreateTable
CREATE TABLE "ShuttleSyncServer" (
    "id" UUID NOT NULL,
    "registryUrl" TEXT NOT NULL,
    "shuttleServerId" TEXT NOT NULL,
    "registryServerId" TEXT NOT NULL,
    "record" JSONB NOT NULL,
    "readmePending" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ShuttleSyncServer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlateOAuthCredentials" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "slateOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateOAuthCredentials_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateOAuthSetup" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "slateOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateOAuthSetup_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateAuthConfig" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "slateOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "providerAuthConfigUpdateOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateAuthConfig_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateCallback" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "slateOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "callbackOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateCallback_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateCallbackInstance" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "triggerRegistrationId" TEXT NOT NULL,
    "slateCallbackOid" BIGINT NOT NULL,
    "slateInstanceOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "callbackInstanceOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateCallbackInstance_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateWebhookRegistration" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "triggerGroupKey" TEXT NOT NULL,
    "urlKey" TEXT NOT NULL,
    "slateOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "webhookRegistrationOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateWebhookRegistration_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateTriggerEvent" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "triggerId" TEXT NOT NULL,
    "slateWebhookEventId" TEXT,
    "slateCallbackInstanceOid" BIGINT NOT NULL,
    "callbackEventOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateTriggerEvent_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateInstance" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "slateOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "lockedSlateVersionOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateInstance_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateInstanceConfiguration" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateInstanceConfiguration_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateToolCall" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "sessionOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateToolCall_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateSession" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "providerRunOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateSession_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Slate" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "identifierInRegistry" TEXT,
    "registryUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Slate_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateVersion" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "slateOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateVersion_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlatesSyncChangeNotificationCursor" (
    "backendOid" BIGINT NOT NULL,
    "cursor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlatesSyncChangeNotificationCursor_pkey" PRIMARY KEY ("backendOid")
);

-- CreateTable
CREATE TABLE "SlatesSyncAuthConfigEventCursor" (
    "backendOid" BIGINT NOT NULL,
    "cursor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlatesSyncAuthConfigEventCursor_pkey" PRIMARY KEY ("backendOid")
);

-- CreateTable
CREATE TABLE "SlatesSyncOAuthSetupEventCursor" (
    "backendOid" BIGINT NOT NULL,
    "cursor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlatesSyncOAuthSetupEventCursor_pkey" PRIMARY KEY ("backendOid")
);

-- CreateTable
CREATE TABLE "CallbackV2" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "CallbackStatus" NOT NULL,
    "syncStatus" "CallbackSyncStatus" NOT NULL DEFAULT 'pending',
    "archivedAt" TIMESTAMP(3),
    "ownership" "CallbackOwnership" NOT NULL DEFAULT 'user',
    "managedAdapterGlobalOid" BIGINT,
    "lastSyncErrorCode" TEXT,
    "lastSyncErrorMessage" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "integrationOid" BIGINT NOT NULL,
    "integrationProviderOid" BIGINT NOT NULL,
    "providerOid" BIGINT NOT NULL,
    "providerVariantOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT NOT NULL,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "solutionOid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallbackV2_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "CallbackEventV2" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "CallbackEventStatus" NOT NULL DEFAULT 'pending',
    "source" "CallbackEventSource" NOT NULL,
    "providerTriggerKey" TEXT NOT NULL,
    "providerTriggerOid" BIGINT,
    "mappedType" TEXT,
    "mappedId" TEXT,
    "callbackOid" BIGINT NOT NULL,
    "callbackInstanceOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT NOT NULL,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "solutionOid" INTEGER NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallbackEventV2_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "CallbackInstanceV2" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "CallbackInstanceStatusV2" NOT NULL,
    "syncStatus" "CallbackInstanceSyncStatus" NOT NULL DEFAULT 'pending',
    "generationStatus" "CallbackInstanceGenerationStatus" NOT NULL DEFAULT 'primary',
    "isParentDeleted" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "lastSyncErrorCode" TEXT,
    "lastSyncErrorMessage" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "callbackOid" BIGINT NOT NULL,
    "integrationInstanceOid" BIGINT NOT NULL,
    "integrationInstanceProviderOid" BIGINT NOT NULL,
    "providerConfigVersionOid" BIGINT,
    "providerAuthConfigVersionOid" BIGINT,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT NOT NULL,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "solutionOid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallbackInstanceV2_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "WebhookRegistrationV2" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "WebhookRegistrationStatus" NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "receiveUrl" TEXT,
    "setup" JSONB,
    "providerOid" BIGINT NOT NULL,
    "providerVariantOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT NOT NULL,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "solutionOid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookRegistrationV2_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ChatAuthor" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "type" "ChatAuthorType" NOT NULL,
    "role" "ChatAuthorRole" NOT NULL,
    "providerType" TEXT NOT NULL,
    "isMe" BOOLEAN NOT NULL,
    "email" TEXT,
    "imageUrl" TEXT,
    "raw" JSONB NOT NULL,
    "chatOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastInteractionAt" TIMESTAMP(3),

    CONSTRAINT "ChatAuthor_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ChatWorkspace" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT,
    "domain" TEXT,
    "imageUrl" TEXT,
    "raw" JSONB NOT NULL,
    "syncHash" TEXT,
    "chatOid" BIGINT NOT NULL,
    "chatInstanceProviderOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatWorkspace_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ChatChannel" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "ChatChannelType" NOT NULL,
    "providerType" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "name" TEXT,
    "topic" TEXT,
    "subject" TEXT,
    "hasAccess" BOOLEAN NOT NULL DEFAULT true,
    "memberCount" INTEGER,
    "context" JSONB,
    "permalink" TEXT,
    "raw" JSONB NOT NULL,
    "syncHash" TEXT,
    "chatOid" BIGINT NOT NULL,
    "workspaceOid" BIGINT,
    "recipientOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastInteractionAt" TIMESTAMP(3),

    CONSTRAINT "ChatChannel_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ChatThread" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "ChatThreadType" NOT NULL,
    "providerType" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "subject" TEXT,
    "context" JSONB,
    "permalink" TEXT,
    "rootMessageId" TEXT,
    "replyCount" INTEGER,
    "lastReplyAt" TIMESTAMP(3),
    "raw" JSONB NOT NULL,
    "syncHash" TEXT,
    "channelOid" BIGINT NOT NULL,
    "chatOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastInteractionAt" TIMESTAMP(3),

    CONSTRAINT "ChatThread_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Chat" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "ChatStatus" NOT NULL DEFAULT 'active',
    "isParentDeleted" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "name" TEXT NOT NULL,
    "chatConnectionOid" BIGINT NOT NULL,
    "chatInstanceOid" BIGINT NOT NULL,
    "chatInstanceProviderOid" BIGINT NOT NULL,
    "adapterOid" BIGINT NOT NULL,
    "providerOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Chat_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ChatConnection" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "ChatConnectionStatus" NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "privateMetadata" JSONB,
    "adapterIntegrationOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT NOT NULL,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "solutionOid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatConnection_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ChatConnectionProvider" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "ChatConnectionProviderStatus" NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "chatConnectionOid" BIGINT NOT NULL,
    "adapterIntegrationOid" BIGINT NOT NULL,
    "adapterIntegrationProviderOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT NOT NULL,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "solutionOid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatConnectionProvider_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ChatEvent" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "source" "CallbackEventSource" NOT NULL,
    "providerEventId" TEXT,
    "sessionMessageOid" BIGINT,
    "chatOid" BIGINT,
    "chatConnectionOid" BIGINT NOT NULL,
    "chatInstanceOid" BIGINT,
    "chatInstanceProviderOid" BIGINT,
    "channelOid" BIGINT,
    "threadOid" BIGINT,
    "messageOid" BIGINT,
    "authorOid" BIGINT,
    "providerChannelId" TEXT,
    "providerThreadId" TEXT,
    "providerMessageId" TEXT,
    "providerAuthorId" TEXT,
    "payload" JSONB,
    "payloadStorageKey" TEXT,
    "callbackEventOid" BIGINT,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT NOT NULL,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "solutionOid" INTEGER NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatEvent_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ChatInstance" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "ChatInstanceStatus" NOT NULL,
    "isParentDeleted" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "privateMetadata" JSONB,
    "chatConnectionOid" BIGINT NOT NULL,
    "adapterIntegrationInstanceOid" BIGINT NOT NULL,
    "adapterIntegrationOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT NOT NULL,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "solutionOid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatInstance_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ChatInstanceProvider" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "ChatInstanceProviderStatus" NOT NULL,
    "isParentDeleted" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "privateMetadata" JSONB,
    "chatInstanceOid" BIGINT NOT NULL,
    "chatConnectionProviderOid" BIGINT NOT NULL,
    "chatConnectionOid" BIGINT NOT NULL,
    "authorOid" BIGINT,
    "adapterIntegrationInstanceProviderOid" BIGINT NOT NULL,
    "adapterIntegrationInstanceOid" BIGINT NOT NULL,
    "adapterIntegrationProviderOid" BIGINT NOT NULL,
    "adapterIntegrationOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT NOT NULL,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "solutionOid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatInstanceProvider_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "providerType" TEXT NOT NULL,
    "replyToMessageId" TEXT,
    "body" JSONB,
    "reactions" JSONB,
    "unfurls" JSONB,
    "syncHash" TEXT,
    "channelOid" BIGINT NOT NULL,
    "threadOid" BIGINT,
    "authorOid" BIGINT,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "edited" BOOLEAN NOT NULL DEFAULT false,
    "editedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastInteractionAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "groupOid" BIGINT,
    "isChildMessage" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ChatMessageGroup" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "channelOid" BIGINT NOT NULL,
    "primaryMessageOid" BIGINT,
    "providerGroupKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessageGroup_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ChatMessageAttachment" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "messageOid" BIGINT NOT NULL,
    "fileId" TEXT NOT NULL,
    "uploadedFileId" TEXT,
    "uploadedFileReferenceId" TEXT,
    "toolCallAttachmentOid" BIGINT,
    "type" TEXT NOT NULL,
    "name" TEXT,
    "mimeType" TEXT,
    "size" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "attachmentId" TEXT,
    "clientReferenceId" TEXT,
    "providerFileReference" JSONB,
    "raw" JSONB,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessageAttachment_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "CustomProviderCommit" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "CustomProviderCommitStatus" NOT NULL,
    "trigger" "CustomProviderCommitTrigger" NOT NULL,
    "type" "CustomProviderCommitType" NOT NULL,
    "message" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "creatorActorOid" BIGINT NOT NULL,
    "fromEnvironmentOid" BIGINT,
    "toEnvironmentOid" BIGINT NOT NULL,
    "toEnvironmentVersionBeforeOid" BIGINT,
    "targetCustomProviderVersionOid" BIGINT NOT NULL,
    "customProviderOid" BIGINT NOT NULL,
    "scmRepoPushOid" BIGINT,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "solutionOid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedAt" TIMESTAMP(3),

    CONSTRAINT "CustomProviderCommit_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "CustomProviderDeployment" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "CustomProviderDeploymentStatus" NOT NULL,
    "trigger" "CustomProviderDeploymentTrigger" NOT NULL,
    "creatorActorOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "solutionOid" INTEGER NOT NULL,
    "customProviderOid" BIGINT NOT NULL,
    "sourceEnvironmentOid" BIGINT,
    "commitOid" BIGINT,
    "shuttleServerVersionOid" BIGINT,
    "shuttleCustomServerOid" BIGINT,
    "shuttleCustomServerDeploymentOid" BIGINT,
    "scmRepoOid" BIGINT,
    "immutableCodeBucketOid" BIGINT,
    "scmRepoPushOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "CustomProviderDeployment_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "CustomProviderEnvironment" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "branchName" TEXT,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "solutionOid" INTEGER NOT NULL,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "providerEnvironmentOid" BIGINT,
    "customProviderOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomProviderEnvironment_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "CustomProviderEnvironmentVersion" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "customProviderEnvironmentOid" BIGINT NOT NULL,
    "customProviderVersionOid" BIGINT NOT NULL,
    "providerEnvironmentVersionOid" BIGINT,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "commitOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomProviderEnvironmentVersion_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "CustomProvider" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "CustomProviderType" NOT NULL,
    "status" "CustomProviderStatus" NOT NULL DEFAULT 'active',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "maxVersionIndex" INTEGER NOT NULL DEFAULT 0,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "solutionOid" INTEGER NOT NULL,
    "providerOid" BIGINT,
    "providerVariantOid" BIGINT,
    "shuttleCustomServerOid" BIGINT,
    "scmRepoOid" BIGINT,
    "draftCodeBucketOid" BIGINT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CustomProvider_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "UpcomingCustomProvider" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "UpcomingCustomProviderType" NOT NULL,
    "message" TEXT,
    "customProviderOid" BIGINT NOT NULL,
    "customProviderDeploymentOid" BIGINT NOT NULL,
    "customProviderVersionOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "solutionOid" INTEGER NOT NULL,
    "actorOid" BIGINT NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UpcomingCustomProvider_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "CustomProviderVersion" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "CustomProviderVersionStatus" NOT NULL,
    "versionIndex" INTEGER NOT NULL,
    "versionIdentifier" TEXT NOT NULL,
    "payload" JSONB,
    "creatorActorOid" BIGINT NOT NULL,
    "customProviderOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "solutionOid" INTEGER NOT NULL,
    "providerVersionOid" BIGINT,
    "deploymentOid" BIGINT NOT NULL,
    "shuttleServerVersionOid" BIGINT,
    "shuttleCustomServerOid" BIGINT,
    "shuttleCustomServerDeploymentOid" BIGINT,
    "scmRepoOid" BIGINT,
    "immutableCodeBucketOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomProviderVersion_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderConfig" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "ProviderConfigStatus" NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "isDefault" BOOLEAN NOT NULL,
    "isEphemeral" BOOLEAN NOT NULL,
    "isForVault" BOOLEAN NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "privateMetadata" JSONB,
    "toolFilter" JSONB NOT NULL DEFAULT '{"type":"v1.allow_all"}',
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "solutionOid" INTEGER NOT NULL,
    "providerOid" BIGINT NOT NULL,
    "specificationOid" BIGINT NOT NULL,
    "owningIntegrationInstanceOid" BIGINT,
    "owningIntegrationInstanceProviderOid" BIGINT,
    "source" "IntegrationResourceSource",
    "isOwnerLocked" BOOLEAN NOT NULL DEFAULT false,
    "isOwnerOnlyVisible" BOOLEAN NOT NULL DEFAULT false,
    "isSystemOwned" BOOLEAN NOT NULL DEFAULT false,
    "ownerActorOid" BIGINT,
    "deploymentOid" BIGINT,
    "fromVaultOid" BIGINT,
    "parentConfigOid" BIGINT,
    "currentVersionOid" BIGINT,
    "ownerPublicMcpServerOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderConfig_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderConfigVersion" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "configOid" BIGINT NOT NULL,
    "slateInstanceOid" BIGINT,
    "shuttleConfigOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderConfigVersion_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderConfigUpdate" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "configOid" BIGINT NOT NULL,
    "fromVersionOid" BIGINT,
    "toVersionOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderConfigUpdate_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderDeployment" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "ProviderDeploymentStatus" NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "isEphemeral" BOOLEAN NOT NULL,
    "isDefault" BOOLEAN NOT NULL,
    "isEnclaveReconciled" BOOLEAN NOT NULL DEFAULT false,
    "isMonitorReconciled" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "privateMetadata" JSONB,
    "toolFilter" JSONB NOT NULL DEFAULT '{"type":"v1.allow_all"}',
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "solutionOid" INTEGER NOT NULL,
    "providerOid" BIGINT NOT NULL,
    "providerVariantOid" BIGINT NOT NULL,
    "defaultConfigOid" BIGINT,
    "defaultAuthConfigOid" BIGINT,
    "currentVersionOid" BIGINT,
    "slateInstanceConfigurationOid" BIGINT,
    "serverInstanceConfigurationOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderDeployment_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderDeploymentVersion" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "providerVariantOid" BIGINT NOT NULL,
    "lockedVersionOid" BIGINT,
    "deploymentOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderDeploymentVersion_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "TenantOAuthCallbackUrl" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "providerOid" BIGINT NOT NULL,
    "providerTypeOid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantOAuthCallbackUrl_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderDeploymentConfigPair" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "providerDeploymentVersionOid" BIGINT NOT NULL,
    "providerConfigVersionOid" BIGINT NOT NULL,
    "providerAuthConfigVersionOid" BIGINT,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "lastUsedPairVersionOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderDeploymentConfigPair_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderDeploymentConfigPairProviderVersion" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "pairOid" BIGINT NOT NULL,
    "versionOid" BIGINT NOT NULL,
    "latestDiscoveryRecordOid" BIGINT,
    "previousPairVersionOid" BIGINT,
    "specificationDiscoveryStatus" "ProviderDeploymentConfigPairSpecificationDiscoveryStatus" NOT NULL,
    "specificationOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderDeploymentConfigPairProviderVersion_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderDeploymentConfigPairSpecificationChange" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "fromSpecificationOid" BIGINT NOT NULL,
    "toSpecificationOid" BIGINT NOT NULL,
    "fromPairVersionOid" BIGINT NOT NULL,
    "toPairVersionOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderDeploymentConfigPairSpecificationChange_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderDeploymentConfigPairDiscovery" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "ProviderDeploymentConfigPairDiscoveryStatus" NOT NULL,
    "pairOid" BIGINT NOT NULL,
    "versionOid" BIGINT NOT NULL,
    "warnings" JSONB[],
    "error" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderDeploymentConfigPairDiscovery_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "EnvironmentProvider" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "providerOid" BIGINT NOT NULL,
    "solutionOid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnvironmentProvider_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderConfigVault" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "ProviderConfigVaultStatus" NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "privateMetadata" JSONB,
    "configOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "solutionOid" INTEGER NOT NULL,
    "providerOid" BIGINT NOT NULL,
    "deploymentOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderConfigVault_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "EnclaveEnvironment" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "EnclaveEnvironmentType" NOT NULL,
    "systemIdentifier" TEXT,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnclaveEnvironment_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Enclave" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "hasFunctionBayBacking" BOOLEAN NOT NULL DEFAULT false,
    "compiledNetworkRules" JSONB,
    "needsEnclaveReconciliation" BOOLEAN NOT NULL DEFAULT true,
    "enclaveEnvironmentOid" BIGINT NOT NULL,
    "providerDeploymentOid" BIGINT NOT NULL,
    "networkOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "Enclave_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Network" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Network_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Firewall" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "FirewallStatus" NOT NULL DEFAULT 'active',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "slug" TEXT NOT NULL,
    "sourceRevision" INTEGER NOT NULL DEFAULT 0,
    "networkOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Firewall_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "FirewallBinding" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "firewallOid" BIGINT NOT NULL,
    "targetType" "FirewallBindingTargetType" NOT NULL,
    "enclaveOid" BIGINT,
    "providerOid" BIGINT,
    "networkOid" BIGINT,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FirewallBinding_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "NetworkPolicy" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "NetworkPolicyStatus" NOT NULL DEFAULT 'active',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "currentVersionOid" BIGINT,
    "currentVersionNumber" INTEGER NOT NULL DEFAULT 0,
    "sourceRevision" INTEGER NOT NULL DEFAULT 0,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "NetworkPolicy_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "NetworkPolicyVersion" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "rules" JSONB NOT NULL,
    "networkPolicyOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NetworkPolicyVersion_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "FirewallNetworkPolicy" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "firewallOid" BIGINT NOT NULL,
    "networkPolicyOid" BIGINT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FirewallNetworkPolicy_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "EnclaveIngressNetworkLog" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "enclaveOid" BIGINT NOT NULL,
    "sessionId" TEXT,
    "bucketStart" TIMESTAMP(3) NOT NULL,
    "sourceIp" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "result" "EnclaveIngressNetworkLogResult" NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "tenantOid" BIGINT NOT NULL,
    "environmentOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "instanceOid" BIGINT,
    "solutionOid" INTEGER NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnclaveIngressNetworkLog_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "IdentityActor" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "IdentityActorType" NOT NULL,
    "status" "IdentityActorStatus" NOT NULL,
    "isParentDeleted" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "privateMetadata" JSONB,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "solutionOid" INTEGER NOT NULL,
    "consumerOid" BIGINT,
    "instanceConsumerOid" BIGINT,
    "consumerProfileOid" BIGINT,
    "defaultForInstanceConsumerOid" BIGINT,
    "defaultIdentityOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "IdentityActor_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "DelegatedIdentity" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "permissions" "IdentityDelegationPermissions"[],
    "delegationLevel" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL,
    "identityOid" BIGINT NOT NULL,
    "actorOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atLeastHoldsUntil" TIMESTAMP(3),

    CONSTRAINT "DelegatedIdentity_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "DelegatedIdentityCredential" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "permissions" "IdentityDelegationPermissions"[],
    "isActive" BOOLEAN NOT NULL,
    "delegatedIdentityOid" BIGINT NOT NULL,
    "credentialOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atLeastHoldsUntil" TIMESTAMP(3),

    CONSTRAINT "DelegatedIdentityCredential_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "DelegatedIdentityUpdate" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "delegatedIdentityOid" BIGINT NOT NULL,
    "isActiveBefore" BOOLEAN NOT NULL,
    "isActiveAfter" BOOLEAN NOT NULL,
    "delegationLevelBefore" INTEGER NOT NULL,
    "delegationLevelAfter" INTEGER NOT NULL,
    "permissionsBefore" "IdentityDelegationPermissions"[],
    "permissionsAfter" "IdentityDelegationPermissions"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DelegatedIdentityUpdate_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "DelegatedIdentityCredentialUpdate" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "updateOid" BIGINT NOT NULL,
    "delegatedCredentialOid" BIGINT NOT NULL,
    "isActiveBefore" BOOLEAN NOT NULL,
    "isActiveAfter" BOOLEAN NOT NULL,
    "permissionsBefore" "IdentityDelegationPermissions"[],
    "permissionsAfter" "IdentityDelegationPermissions"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DelegatedIdentityCredentialUpdate_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "IdentityDelegation" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "IdentityDelegationStatus" NOT NULL,
    "delegationLevel" INTEGER NOT NULL,
    "permissions" "IdentityDelegationPermissions"[],
    "deniedReason" "IdentityDelegationDeniedReason",
    "wasCoveredByPreviousDelegationAndAutoApproved" BOOLEAN NOT NULL,
    "note" TEXT,
    "metadata" JSONB,
    "identityOid" BIGINT NOT NULL,
    "subDelegatedFromOid" BIGINT,
    "delegateeOid" BIGINT NOT NULL,
    "delegationConfigOid" BIGINT,
    "selectedDelegationConfigVersionOid" BIGINT NOT NULL,
    "attestationOid" BIGINT,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "solutionOid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "identityDelegationOid" BIGINT,

    CONSTRAINT "IdentityDelegation_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "IdentityDelegationCredentialOverride" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "IdentityDelegationCredentialOverrideStatus" NOT NULL,
    "permissions" "IdentityDelegationPermissions"[],
    "delegationOid" BIGINT NOT NULL,
    "credentialOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "IdentityDelegationCredentialOverride_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "IdentityDelegationParty" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "delegationOid" BIGINT NOT NULL,
    "actorOid" BIGINT NOT NULL,
    "roles" "IdentityDelegationPartyRole"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdentityDelegationParty_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "IdentityDelegationAttestation" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "IdentityDelegationAttestationType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdentityDelegationAttestation_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "IdentityDelegationConfig" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL,
    "status" "IdentityDelegationConfigStatus" NOT NULL,
    "isParentDeleted" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "solutionOid" INTEGER NOT NULL,
    "currentVersionOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "IdentityDelegationConfig_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "IdentityDelegationConfigVersion" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "subDelegationBehavior" "IdentityDelegationConfigSubDelegationBehavior" NOT NULL,
    "subDelegationDepth" INTEGER NOT NULL,
    "delegationConfigOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdentityDelegationConfigVersion_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Identity" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "IdentityStatus" NOT NULL,
    "isParentDeleted" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "privateMetadata" JSONB,
    "needsReconciliation" BOOLEAN NOT NULL,
    "actorOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "solutionOid" INTEGER NOT NULL,
    "delegationConfigOid" BIGINT,
    "ownedByIntegrationInstanceOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Identity_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "IdentityCredential" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "IdentityStatus" NOT NULL,
    "privateMetadata" JSONB,
    "identityOid" BIGINT NOT NULL,
    "deploymentOid" BIGINT,
    "configOid" BIGINT,
    "authConfigOid" BIGINT,
    "providerOid" BIGINT NOT NULL,
    "delegationConfigOid" BIGINT,
    "integrationInstanceOid" BIGINT,
    "integrationInstanceProviderOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "IdentityCredential_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "IdentityDelegationRequest" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "IdentityDelegationRequestStatus" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "delegationOid" BIGINT NOT NULL,
    "attestationOid" BIGINT,
    "requesterOid" BIGINT NOT NULL,
    "identityOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "solutionOid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdentityDelegationRequest_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "MagicMcpServerBacking" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "ownerType" "MagicMcpServerOwnerType" NOT NULL DEFAULT 'server_owned',
    "providerTemplateBackingOid" BIGINT,
    "ownerIntegrationOid" BIGINT,
    "integrationOid" BIGINT,
    "integrationInstanceOid" BIGINT NOT NULL,
    "sessionTemplateOid" BIGINT NOT NULL,
    "ephemeralManagedSessionOid" BIGINT NOT NULL,
    "actorOid" BIGINT,
    "identityOid" BIGINT,
    "isOwnerLocked" BOOLEAN NOT NULL DEFAULT false,
    "isOwnerOnlyVisible" BOOLEAN NOT NULL DEFAULT false,
    "isSystemOwned" BOOLEAN NOT NULL DEFAULT false,
    "ownerActorOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MagicMcpServerBacking_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "MagicMcpServerProvider" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "MagicMcpServerProviderStatus" NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "magicMcpServerBackingOid" BIGINT NOT NULL,
    "integrationProviderOid" BIGINT NOT NULL,
    "integrationInstanceProviderOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MagicMcpServerProvider_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "MagicMcpEndpointBacking" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "integrationGroupOid" BIGINT NOT NULL,
    "sessionTemplateOid" BIGINT NOT NULL,
    "ephemeralManagedSessionOid" BIGINT NOT NULL,
    "actorOid" BIGINT,
    "isOwnerLocked" BOOLEAN NOT NULL DEFAULT false,
    "isOwnerOnlyVisible" BOOLEAN NOT NULL DEFAULT false,
    "isSystemOwned" BOOLEAN NOT NULL DEFAULT false,
    "ownerActorOid" BIGINT,

    CONSTRAINT "MagicMcpEndpointBacking_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "MagicMcpEndpointServerBacking" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "magicMcpEndpointBackingOid" BIGINT NOT NULL,
    "magicMcpServerBackingOid" BIGINT NOT NULL,
    "toolFilters" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MagicMcpEndpointServerBacking_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderTemplateBacking" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "integrationOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderTemplateBacking_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "IntegrationInstance" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "IntegrationInstanceStatus" NOT NULL,
    "isHiddenDraft" BOOLEAN NOT NULL DEFAULT false,
    "isParentDeleted" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "isMagicMcpBacking" BOOLEAN NOT NULL DEFAULT false,
    "isAdapterBacking" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "privateMetadata" JSONB,
    "integrationOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "solutionOid" INTEGER NOT NULL,
    "identityActorOid" BIGINT,
    "identityOid" BIGINT,
    "source" "IntegrationResourceSource",
    "isOwnerLocked" BOOLEAN NOT NULL DEFAULT false,
    "isOwnerOnlyVisible" BOOLEAN NOT NULL DEFAULT false,
    "isSystemOwned" BOOLEAN NOT NULL DEFAULT false,
    "ownerActorOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationInstance_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "IntegrationInstanceProvider" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "IntegrationInstanceProviderStatus" NOT NULL,
    "isParentDeleted" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "privateMetadata" JSONB,
    "currentVersionOid" BIGINT,
    "integrationOid" BIGINT NOT NULL,
    "integrationInstanceOid" BIGINT NOT NULL,
    "integrationProviderOid" BIGINT NOT NULL,
    "integrationVersionOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "solutionOid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationInstanceProvider_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "IntegrationInstanceProviderVersion" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "IntegrationInstanceProviderStatus" NOT NULL,
    "integrationInstanceProviderOid" BIGINT NOT NULL,
    "integrationProviderVersionOid" BIGINT NOT NULL,
    "toolFilter" JSONB,
    "isOverrideToolFilter" BOOLEAN NOT NULL,
    "configOid" BIGINT,
    "authConfigOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationInstanceProviderVersion_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "IntegrationInstanceGroup" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "IntegrationInstanceGroupStatus" NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "isMagicMcpBacking" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "privateMetadata" JSONB,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "solutionOid" INTEGER NOT NULL,
    "identityActorOid" BIGINT,
    "identityOid" BIGINT,
    "source" "IntegrationResourceSource",
    "isOwnerLocked" BOOLEAN NOT NULL DEFAULT false,
    "isOwnerOnlyVisible" BOOLEAN NOT NULL DEFAULT false,
    "isSystemOwned" BOOLEAN NOT NULL DEFAULT false,
    "ownerActorOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationInstanceGroup_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "IntegrationInstanceGroupSource" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "IntegrationInstanceGroupSourceStatus" NOT NULL,
    "isParentDeleted" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "integrationInstanceGroupOid" BIGINT NOT NULL,
    "integrationInstanceOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "solutionOid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationInstanceGroupSource_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "IntegrationInstanceGroupProvider" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "IntegrationInstanceGroupProviderStatus" NOT NULL,
    "isParentDeleted" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "privateMetadata" JSONB,
    "integrationInstanceGroupOid" BIGINT NOT NULL,
    "integrationInstanceGroupSourceOid" BIGINT NOT NULL,
    "integrationOid" BIGINT NOT NULL,
    "integrationInstanceOid" BIGINT NOT NULL,
    "integrationInstanceProviderOid" BIGINT NOT NULL,
    "integrationProviderOid" BIGINT NOT NULL,
    "toolFilter" JSONB,
    "isOverrideToolFilter" BOOLEAN NOT NULL DEFAULT false,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "solutionOid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationInstanceGroupProvider_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Integration" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "IntegrationStatus" NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "isMagicMcpBacking" BOOLEAN NOT NULL DEFAULT false,
    "isAdapterBacking" BOOLEAN NOT NULL DEFAULT false,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "privateMetadata" JSONB,
    "canAttachCustomToolFilters" BOOLEAN NOT NULL,
    "canAttachCustomProviderConfig" BOOLEAN NOT NULL,
    "canOverrideToolFilters" BOOLEAN NOT NULL,
    "enableCallbackTools" BOOLEAN NOT NULL DEFAULT false,
    "useIntegrationNameForSessionProviderNameTemplatesOverride" BOOLEAN,
    "currentVersionIndex" INTEGER NOT NULL,
    "currentVersionOid" BIGINT,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "solutionOid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "IntegrationProvider" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "IntegrationProviderStatus" NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "areCallbacksEnabled" BOOLEAN NOT NULL DEFAULT false,
    "currentVersionIndex" INTEGER NOT NULL,
    "toolFilter" JSONB NOT NULL,
    "currentVersionOid" BIGINT,
    "integrationOid" BIGINT NOT NULL,
    "providerOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "solutionOid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationProvider_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "IntegrationProviderVersion" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "IntegrationProviderStatus" NOT NULL,
    "index" INTEGER NOT NULL,
    "toolFilter" JSONB NOT NULL,
    "integrationProviderOid" BIGINT NOT NULL,
    "deploymentOid" BIGINT NOT NULL,
    "authMethodOid" BIGINT,
    "authCredentialsOid" BIGINT,
    "configOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationProviderVersion_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "IntegrationVersion" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "IntegrationProviderStatus" NOT NULL,
    "index" INTEGER NOT NULL,
    "integrationOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationVersion_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "IntegrationVersionProvider" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "integrationVersionOid" BIGINT NOT NULL,
    "integrationProviderVersionOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationVersionProvider_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderListingCollection" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderListingCollection_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderListingCategory" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderListingCategory_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderListingGroup" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "solutionOid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderListingGroup_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderListing" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "ProviderListingStatus" NOT NULL,
    "isDeprecated" BOOLEAN NOT NULL DEFAULT false,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "isCustomized" BOOLEAN NOT NULL DEFAULT false,
    "isMetorial" BOOLEAN NOT NULL DEFAULT false,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isOfficial" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "prettySlug" TEXT,
    "aliases" TEXT[],
    "image" JSONB,
    "description" TEXT,
    "readme" TEXT,
    "docs" JSONB,
    "rank" INTEGER NOT NULL DEFAULT 0,
    "skills" TEXT[],
    "deploymentsCount" INTEGER NOT NULL DEFAULT 0,
    "providerSessionsCount" INTEGER NOT NULL DEFAULT 0,
    "providerMessagesCount" INTEGER NOT NULL DEFAULT 0,
    "ownerTenantOid" BIGINT,
    "ownerSolutionOid" INTEGER,
    "publisherOid" BIGINT NOT NULL,
    "providerOid" BIGINT NOT NULL,
    "typeOid" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rankUpdatedAt" TIMESTAMP(3),

    CONSTRAINT "ProviderListing_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderListingUpdate" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "providerListingOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderListingUpdate_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "MonitorAlert" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "MonitorAlertStatus" NOT NULL,
    "monitorOid" BIGINT NOT NULL,
    "protoGuardAlertOid" BIGINT,
    "specificationChangeNotificationOid" BIGINT,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "solutionOid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "MonitorAlert_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "MonitorAlertEvent" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "MonitorAlertEventType" NOT NULL,
    "monitorAlertOid" BIGINT NOT NULL,
    "actorOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonitorAlertEvent_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "MonitorAlertRecipient" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "monitorAlertOid" BIGINT NOT NULL,
    "recipientOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "viewedAt" TIMESTAMP(3),

    CONSTRAINT "MonitorAlertRecipient_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Monitor" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "target" "MonitorTarget" NOT NULL,
    "status" "MonitorStatus" NOT NULL,
    "owner" "MonitorOwner" NOT NULL,
    "protoGuardFilterOid" BIGINT,
    "providerOid" BIGINT,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "solutionOid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstAlertAt" TIMESTAMP(3),
    "lastAlertAt" TIMESTAMP(3),

    CONSTRAINT "Monitor_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderAdapterGlobal" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderAdapterGlobal_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderAdapter" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "globalOid" BIGINT NOT NULL,
    "providerOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderAdapter_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderAdapterCapability" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "adapterOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderAdapterCapability_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderVersionAdapter" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "capabilities" JSONB NOT NULL DEFAULT '[]',
    "providerVersionOid" BIGINT NOT NULL,
    "adapterOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderVersionAdapter_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderVersionAdapterCapability" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "providerVersionAdapterOid" BIGINT NOT NULL,
    "adapterCapabilityOid" BIGINT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderVersionAdapterCapability_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderEnvironment" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "solutionOid" INTEGER NOT NULL,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "providerOid" BIGINT NOT NULL,
    "providerVariantOid" BIGINT NOT NULL,
    "currentVersionOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderEnvironment_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderEnvironmentVersion" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "providerEnvironmentOid" BIGINT NOT NULL,
    "providerVersionOid" BIGINT NOT NULL,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderEnvironmentVersion_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderEntry" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "publisherOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderEntry_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Provider" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "access" "ProviderAccess" NOT NULL,
    "status" "ProviderStatus" NOT NULL,
    "isDeprecated" BOOLEAN NOT NULL DEFAULT false,
    "hasEnvironments" BOOLEAN NOT NULL DEFAULT false,
    "identifier" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "globalIdentifier" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "prettySlug" TEXT,
    "metadata" JSONB,
    "tag" TEXT NOT NULL,
    "entryOid" BIGINT NOT NULL,
    "publisherOid" BIGINT NOT NULL,
    "ownerTenantOid" BIGINT,
    "ownerSolutionOid" INTEGER,
    "defaultVariantOid" BIGINT,
    "typeOid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Provider_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderToolGlobal" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "providerOid" BIGINT NOT NULL,
    "currentInstanceOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderToolGlobal_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderTool" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "specId" TEXT NOT NULL,
    "specUniqueIdentifier" TEXT NOT NULL,
    "callableId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "value" JSONB NOT NULL,
    "hash" TEXT NOT NULL,
    "providerOid" BIGINT NOT NULL,
    "specificationOid" BIGINT NOT NULL,
    "globalOid" BIGINT NOT NULL,
    "adapterOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderTool_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderAuthMethodGlobal" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "providerOid" BIGINT NOT NULL,
    "currentInstanceOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderAuthMethodGlobal_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderAuthMethod" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "specId" TEXT NOT NULL,
    "specUniqueIdentifier" TEXT NOT NULL,
    "callableId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "type" "ProviderAuthMethodType" NOT NULL,
    "isDefault" BOOLEAN NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "value" JSONB NOT NULL,
    "hash" TEXT NOT NULL,
    "providerOid" BIGINT NOT NULL,
    "specificationOid" BIGINT NOT NULL,
    "globalOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderAuthMethod_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderSpecification" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "ProviderSpecificationType" NOT NULL,
    "specId" TEXT NOT NULL,
    "specUniqueIdentifier" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "value" JSONB NOT NULL,
    "hash" TEXT NOT NULL,
    "supportsAuthMethod" BOOLEAN NOT NULL,
    "configContainsAuth" BOOLEAN NOT NULL,
    "providerOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderSpecification_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderTriggerGlobal" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "providerOid" BIGINT NOT NULL,
    "currentInstanceOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderTriggerGlobal_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderTriggerGroupGlobal" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "providerOid" BIGINT NOT NULL,
    "currentInstanceOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderTriggerGroupGlobal_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderTriggerGroup" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "specId" TEXT NOT NULL,
    "specUniqueIdentifier" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "value" JSONB NOT NULL,
    "hash" TEXT NOT NULL,
    "providerOid" BIGINT NOT NULL,
    "specificationOid" BIGINT NOT NULL,
    "globalOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderTriggerGroup_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderTrigger" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "specId" TEXT NOT NULL,
    "specUniqueIdentifier" TEXT NOT NULL,
    "callableId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "value" JSONB NOT NULL,
    "hash" TEXT NOT NULL,
    "providerOid" BIGINT NOT NULL,
    "specificationOid" BIGINT NOT NULL,
    "globalOid" BIGINT NOT NULL,
    "adapterOid" BIGINT,
    "triggerGroupOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderTrigger_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderVersionSpecificationChange" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "fromSpecificationOid" BIGINT NOT NULL,
    "toSpecificationOid" BIGINT NOT NULL,
    "fromVersionOid" BIGINT NOT NULL,
    "toVersionOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderVersionSpecificationChange_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderSpecificationChangeNotification" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "target" "ProviderSpecificationChangeNotificationTarget" NOT NULL,
    "versionOid" BIGINT NOT NULL,
    "tenantOid" BIGINT,
    "projectOid" BIGINT,
    "environmentOid" BIGINT,
    "instanceOid" BIGINT,
    "solutionOid" INTEGER,
    "versionSpecificationChangeOid" BIGINT,
    "deploymentConfigPairOid" BIGINT,
    "pairSpecificationChangeOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderSpecificationChangeNotification_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderTag" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderTag_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderType" (
    "oid" INTEGER NOT NULL,
    "id" TEXT NOT NULL,
    "shortKey" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "attributes" JSONB NOT NULL,
    "supportsConfig" BOOLEAN NOT NULL DEFAULT false,
    "supportsAuth" BOOLEAN NOT NULL DEFAULT false,
    "supportsOAuth" BOOLEAN NOT NULL DEFAULT false,
    "supportsCallbacks" BOOLEAN NOT NULL DEFAULT false,
    "supportsWebhookRegistration" BOOLEAN NOT NULL DEFAULT false,
    "supportsOAuthAutoRegistration" BOOLEAN NOT NULL DEFAULT false,
    "supportsAuthExport" BOOLEAN NOT NULL DEFAULT false,
    "supportsAuthImport" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderType_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderUse" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "solutionOid" INTEGER NOT NULL,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "providerOid" BIGINT NOT NULL,
    "deployments" INTEGER NOT NULL DEFAULT 0,
    "configs" INTEGER NOT NULL DEFAULT 0,
    "authConfigs" INTEGER NOT NULL DEFAULT 0,
    "credentials" INTEGER NOT NULL DEFAULT 0,
    "sessions" INTEGER NOT NULL DEFAULT 0,
    "sessionTemplates" INTEGER NOT NULL DEFAULT 0,
    "firstDeploymentAt" TIMESTAMP(3),
    "firstConfigAt" TIMESTAMP(3),
    "firstAuthConfigAt" TIMESTAMP(3),
    "firstCredentialAt" TIMESTAMP(3),
    "firstSessionAt" TIMESTAMP(3),
    "firstSessionTemplateAt" TIMESTAMP(3),
    "lastDeploymentAt" TIMESTAMP(3),
    "lastConfigAt" TIMESTAMP(3),
    "lastAuthConfigAt" TIMESTAMP(3),
    "lastCredentialAt" TIMESTAMP(3),
    "lastSessionAt" TIMESTAMP(3),
    "lastSessionTemplateAt" TIMESTAMP(3),
    "lastUseAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderUse_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderVariant" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "backendOid" BIGINT NOT NULL,
    "providerOid" BIGINT NOT NULL,
    "publisherOid" BIGINT NOT NULL,
    "slateOid" BIGINT,
    "shuttleServerOid" BIGINT,
    "currentVersionOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderVariant_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderVersion" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "isEnvironmentLocked" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "specificationDiscoveryStatus" "ProviderVersionSpecificationDiscoveryStatus" NOT NULL,
    "backendOid" BIGINT NOT NULL,
    "providerOid" BIGINT NOT NULL,
    "providerVariantOid" BIGINT NOT NULL,
    "typeOid" INTEGER NOT NULL,
    "previousVersionOid" BIGINT,
    "slateOid" BIGINT,
    "slateVersionOid" BIGINT,
    "shuttleServerOid" BIGINT,
    "shuttleServerVersionOid" BIGINT,
    "specificationOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderVersion_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "PublicMcpServerAuthorization" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "PublicMcpServerAuthorizationStatus" NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "state" TEXT,
    "codeChallenge" TEXT NOT NULL,
    "resource" TEXT,
    "scope" TEXT,
    "baseUrl" TEXT NOT NULL,
    "browserBindingHash" TEXT NOT NULL,
    "authorizationCodeHash" TEXT,
    "codeExpiresAt" TIMESTAMP(3),
    "codeUsedAt" TIMESTAMP(3),
    "ip" TEXT NOT NULL,
    "ua" TEXT,
    "publicMcpServerOid" BIGINT NOT NULL,
    "clientOid" BIGINT NOT NULL,
    "setupSessionOid" BIGINT,
    "projectOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicMcpServerAuthorization_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "PublicMcpServerClient" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientSecretHash" TEXT,
    "registrationAccessTokenHash" TEXT NOT NULL,
    "tokenEndpointAuthMethod" "PublicMcpServerClientAuthMethod" NOT NULL,
    "clientName" TEXT NOT NULL,
    "clientUri" TEXT,
    "logoUri" TEXT,
    "redirectUris" TEXT[],
    "registrationIp" TEXT NOT NULL,
    "registrationUa" TEXT,
    "publicMcpServerOid" BIGINT NOT NULL,
    "projectOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicMcpServerClient_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "PublicMcpServerGrant" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "PublicMcpServerGrantStatus" NOT NULL,
    "revokedReason" "PublicMcpServerGrantRevocationReason",
    "isCleanedUp" BOOLEAN NOT NULL DEFAULT false,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT NOT NULL,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "solutionOid" INTEGER NOT NULL,
    "publicMcpServerOid" BIGINT NOT NULL,
    "clientOid" BIGINT NOT NULL,
    "authorizationOid" BIGINT NOT NULL,
    "deploymentOid" BIGINT NOT NULL,
    "configOid" BIGINT,
    "authConfigOid" BIGINT,
    "currentSessionOid" BIGINT,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicMcpServerGrant_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "PublicMcpServerGrantUse" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "ua" TEXT,
    "hourBucket" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "grantOid" BIGINT NOT NULL,
    "projectOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicMcpServerGrantUse_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "PublicMcpServer" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "PublicMcpServerStatus" NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "toolFilter" JSONB NOT NULL DEFAULT '{"type":"v1.allow_all"}',
    "redirectUriFilters" TEXT[],
    "maxActiveGrants" INTEGER,
    "accessTokenTtlSeconds" INTEGER NOT NULL DEFAULT 3600,
    "refreshTokenTtlSeconds" INTEGER NOT NULL DEFAULT 2592000,
    "grantIdleExpirySeconds" INTEGER NOT NULL DEFAULT 7776000,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT NOT NULL,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "solutionOid" INTEGER NOT NULL,
    "providerOid" BIGINT NOT NULL,
    "deploymentOid" BIGINT NOT NULL,
    "isOwnerLocked" BOOLEAN NOT NULL DEFAULT false,
    "isOwnerOnlyVisible" BOOLEAN NOT NULL DEFAULT false,
    "isSystemOwned" BOOLEAN NOT NULL DEFAULT false,
    "ownerActorOid" BIGINT,
    "disabledAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicMcpServer_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "PublicMcpServerToken" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "PublicMcpServerTokenType" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "grantOid" BIGINT NOT NULL,
    "replacedByOid" BIGINT,
    "projectOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicMcpServerToken_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Publisher" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "PublisherType" NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tag" TEXT NOT NULL,
    "image" JSONB,
    "source" JSONB,
    "tenantOid" BIGINT,
    "projectOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Publisher_pkey" PRIMARY KEY ("oid")
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
CREATE TABLE "CodeBucket" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "isImmutable" BOOLEAN NOT NULL,
    "isReadOnly" BOOLEAN NOT NULL,
    "isSynced" BOOLEAN NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "solutionOid" INTEGER NOT NULL,
    "scmRepoOid" BIGINT,
    "scmRepoPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CodeBucket_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ScmRepo" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "provider" "ScmProvider" NOT NULL,
    "fromRepoUrl" TEXT,
    "name" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "externalName" TEXT NOT NULL,
    "externalOwner" TEXT NOT NULL,
    "externalUrl" TEXT NOT NULL,
    "externalIsPrivate" BOOLEAN NOT NULL,
    "defaultBranch" TEXT NOT NULL DEFAULT 'main',
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "solutionOid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScmRepo_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ScmRepoPush" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "pusherName" TEXT,
    "pusherEmail" TEXT,
    "senderIdentifier" TEXT,
    "commitMessage" TEXT,
    "branchName" TEXT NOT NULL,
    "sha" TEXT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "solutionOid" INTEGER NOT NULL,
    "repoOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScmRepoPush_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "OriginSyncChangeNotificationCursor" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "cursor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OriginSyncChangeNotificationCursor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionConnection" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "systemIdentifier" TEXT,
    "isEphemeral" BOOLEAN NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "adapterGlobalOid" BIGINT,
    "status" "SessionConnectionStatus" NOT NULL,
    "transport" "SessionConnectionTransport" NOT NULL,
    "isParentDeleted" BOOLEAN NOT NULL DEFAULT false,
    "hasErrors" BOOLEAN NOT NULL DEFAULT false,
    "hasWarnings" BOOLEAN NOT NULL DEFAULT false,
    "state" "SessionConnectionState" NOT NULL,
    "initState" "SessionConnectionInitState" NOT NULL,
    "isManuallyDisabled" BOOLEAN NOT NULL,
    "isReplaced" BOOLEAN NOT NULL,
    "isForManualToolCalls" BOOLEAN NOT NULL DEFAULT false,
    "totalProductiveClientMessageCount" INTEGER NOT NULL DEFAULT 0,
    "totalProductiveProviderMessageCount" INTEGER NOT NULL DEFAULT 0,
    "sessionOid" BIGINT NOT NULL,
    "participantOid" BIGINT,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "solutionOid" INTEGER NOT NULL,
    "ownerPublicMcpServerOid" BIGINT,
    "mcpData" JSONB NOT NULL,
    "mcpTransport" "SessionConnectionMcpConnectionTransport" NOT NULL,
    "mcpProtocolVersion" TEXT,
    "mcpClientKey" TEXT,
    "privateMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastPingAt" TIMESTAMP(3),
    "lastMessageAt" TIMESTAMP(3),
    "lastActiveAt" TIMESTAMP(3),
    "lastConnectedAt" TIMESTAMP(3),
    "disconnectedAt" TIMESTAMP(3),

    CONSTRAINT "SessionConnection_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SessionConnectionProviderSpecification" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SessionConnectionProviderSpecificationStatus" NOT NULL,
    "error" JSONB,
    "connectionOid" BIGINT NOT NULL,
    "sessionProviderOid" BIGINT NOT NULL,
    "providerVersionOid" BIGINT NOT NULL,
    "specificationOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "discoveredAt" TIMESTAMP(3),

    CONSTRAINT "SessionConnectionProviderSpecification_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "EphemeralManagedSession" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "EphemeralManagedSessionStatus" NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "maxSessionDurationInMinutes" INTEGER NOT NULL,
    "templateHash" TEXT,
    "willRotateAt" TIMESTAMP(3),
    "isReconciling" BOOLEAN NOT NULL DEFAULT false,
    "markSessionsAsInternal" BOOLEAN NOT NULL DEFAULT false,
    "adapterGlobalOid" BIGINT,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "solutionOid" INTEGER NOT NULL,
    "sessionTemplateOid" BIGINT NOT NULL,
    "currentSessionOid" BIGINT,
    "actorOid" BIGINT,
    "identityOid" BIGINT,
    "isOwnerLocked" BOOLEAN NOT NULL DEFAULT false,
    "isOwnerOnlyVisible" BOOLEAN NOT NULL DEFAULT false,
    "isSystemOwned" BOOLEAN NOT NULL DEFAULT false,
    "ownerActorOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EphemeralManagedSession_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SessionErrorGroup" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "SessionErrorType" NOT NULL,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "firstOccurrenceOid" BIGINT,
    "providerOid" BIGINT,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "occurrenceCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SessionErrorGroup_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SessionErrorGroupOccurrencePeriod" (
    "oid" BIGINT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "occurrenceCount" INTEGER NOT NULL DEFAULT 0,
    "groupOid" BIGINT NOT NULL,

    CONSTRAINT "SessionErrorGroupOccurrencePeriod_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SessionError" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "SessionErrorType" NOT NULL,
    "isParentDeleted" BOOLEAN NOT NULL DEFAULT false,
    "isProcessing" BOOLEAN NOT NULL,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "payload" JSONB,
    "groupOid" BIGINT,
    "connectionOid" BIGINT,
    "sessionOid" BIGINT NOT NULL,
    "providerRunOid" BIGINT,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "solutionOid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionError_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SessionEvent" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "SessionEventType" NOT NULL,
    "isParentDeleted" BOOLEAN NOT NULL DEFAULT false,
    "sessionOid" BIGINT NOT NULL,
    "providerRunOid" BIGINT,
    "messageOid" BIGINT,
    "connectionOid" BIGINT,
    "errorOid" BIGINT,
    "warningOid" BIGINT,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "solutionOid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionEvent_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SessionMessage" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SessionMessageStatus" NOT NULL,
    "type" "SessionMessageType" NOT NULL,
    "source" "SessionMessageSource" NOT NULL,
    "transport" "SessionConnectionTransport" NOT NULL,
    "failureReason" "SessionMessageFailureReason" NOT NULL,
    "isParentDeleted" BOOLEAN NOT NULL DEFAULT false,
    "methodOrToolKey" TEXT,
    "clientMcpId" JSONB NOT NULL,
    "providerMcpId" TEXT,
    "input" JSONB,
    "output" JSONB,
    "inputSize" INTEGER,
    "outputSize" INTEGER,
    "isProductive" BOOLEAN NOT NULL DEFAULT true,
    "retentionLevel" "SessionDataRetentionLevel" NOT NULL DEFAULT 'full',
    "hasOutput" BOOLEAN NOT NULL DEFAULT false,
    "parentMessageOid" BIGINT,
    "isOffloadedToStorage" BOOLEAN NOT NULL DEFAULT false,
    "bucketOid" INTEGER NOT NULL,
    "sessionOid" BIGINT NOT NULL,
    "senderParticipantOid" BIGINT NOT NULL,
    "responderParticipantOid" BIGINT,
    "sessionProviderOid" BIGINT,
    "connectionOid" BIGINT,
    "providerRunOid" BIGINT,
    "slateToolCallOid" BIGINT,
    "errorOid" BIGINT,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "solutionOid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "activityCountedAt" TIMESTAMP(3),
    "finalizedAt" TIMESTAMP(3),
    "providerToolOid" BIGINT,

    CONSTRAINT "SessionMessage_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SessionMessageStorageBucket" (
    "oid" INTEGER NOT NULL,
    "bucket" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionMessageStorageBucket_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ToolCall" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "toolKey" TEXT NOT NULL,
    "metadata" JSONB,
    "rationale" TEXT,
    "operation" TEXT,
    "messageOid" BIGINT NOT NULL,
    "sessionOid" BIGINT NOT NULL,
    "sessionProviderOid" BIGINT,
    "providerRunOid" BIGINT,
    "toolOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "solutionOid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToolCall_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ToolCallAttachment" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "urlKey" TEXT NOT NULL,
    "url" TEXT,
    "slateAttachmentId" TEXT,
    "mimeType" TEXT,
    "expiresAt" TIMESTAMP(3),
    "toolCallOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToolCallAttachment_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SessionParticipant" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "SessionParticipantType" NOT NULL,
    "hash" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "connectionType" "SessionParticipantConnectionType",
    "payload" JSONB NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "providerOid" BIGINT,
    "agentInstanceOid" BIGINT,
    "identityActorOid" BIGINT,
    "identityOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionParticipant_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProtoGuardFilter" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "issueType" "ProtoGuardIssueType" NOT NULL,
    "severity" "ProtoGuardSeverity" NOT NULL,
    "scoreWeight" DOUBLE PRECISION NOT NULL,
    "defaultEnabled" BOOLEAN NOT NULL DEFAULT true,
    "alertConfidenceThreshold" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProtoGuardFilter_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProtoGuardTenantSetting" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "alertFilterCountThreshold" INTEGER NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProtoGuardTenantSetting_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProtoGuardTenantFilterSetting" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "alertConfidenceThreshold" DOUBLE PRECISION,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "filterOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProtoGuardTenantFilterSetting_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProtoGuardRun" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "ProtoGuardRunStatus" NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "maxScore" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "triggeredFilterCount" INTEGER NOT NULL,
    "matchedInstanceCount" INTEGER NOT NULL,
    "alertFilterCountThreshold" INTEGER NOT NULL,
    "error" JSONB,
    "messageOid" BIGINT NOT NULL,
    "sessionOid" BIGINT NOT NULL,
    "connectionOid" BIGINT,
    "providerRunOid" BIGINT,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "solutionOid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProtoGuardRun_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProtoGuardAlert" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "sampleMarkdown" TEXT NOT NULL,
    "issueTypes" JSONB NOT NULL,
    "runOid" BIGINT NOT NULL,
    "messageOid" BIGINT NOT NULL,
    "sessionOid" BIGINT NOT NULL,
    "connectionOid" BIGINT,
    "providerRunOid" BIGINT,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "solutionOid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProtoGuardAlert_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProtoGuardAlertInstance" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "issueType" "ProtoGuardIssueType" NOT NULL,
    "severity" "ProtoGuardSeverity" NOT NULL,
    "path" TEXT NOT NULL,
    "startOffset" INTEGER NOT NULL,
    "endOffset" INTEGER NOT NULL,
    "matchedText" TEXT NOT NULL,
    "sampleMarkdown" TEXT NOT NULL,
    "description" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL,
    "confidenceThreshold" DOUBLE PRECISION NOT NULL,
    "metadata" JSONB,
    "alertOid" BIGINT NOT NULL,
    "filterOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProtoGuardAlertInstance_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SessionProvider" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SessionProviderStatus" NOT NULL,
    "isEphemeral" BOOLEAN NOT NULL,
    "isParentDeleted" BOOLEAN NOT NULL DEFAULT false,
    "totalProductiveClientMessageCount" INTEGER NOT NULL DEFAULT 0,
    "totalProductiveProviderMessageCount" INTEGER NOT NULL DEFAULT 0,
    "tag" TEXT NOT NULL,
    "nameTemplate" TEXT,
    "toolFilter" JSONB NOT NULL,
    "sessionOid" BIGINT NOT NULL,
    "providerOid" BIGINT NOT NULL,
    "deploymentOid" BIGINT NOT NULL,
    "configOid" BIGINT NOT NULL,
    "authConfigOid" BIGINT,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "solutionOid" INTEGER NOT NULL,
    "fromTemplateOid" BIGINT,
    "fromTemplateProviderOid" BIGINT,
    "ownerPublicMcpServerOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessageAt" TIMESTAMP(3),

    CONSTRAINT "SessionProvider_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderRun" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "ProviderRunStatus" NOT NULL DEFAULT 'running',
    "isParentDeleted" BOOLEAN NOT NULL DEFAULT false,
    "providerOid" BIGINT NOT NULL,
    "sessionProviderOid" BIGINT NOT NULL,
    "providerVersionOid" BIGINT NOT NULL,
    "sessionOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "connectionOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "environmentOid" BIGINT NOT NULL,
    "metorialInstanceOid" BIGINT,
    "solutionOid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "lastPingAt" TIMESTAMP(3),

    CONSTRAINT "ProviderRun_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SessionProviderInstance" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "totalProductiveClientMessageCount" INTEGER NOT NULL DEFAULT 0,
    "totalProductiveProviderMessageCount" INTEGER NOT NULL DEFAULT 0,
    "sessionOid" BIGINT NOT NULL,
    "sessionProviderOid" BIGINT NOT NULL,
    "pairOid" BIGINT NOT NULL,
    "pairVersionOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastRenewedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionProviderInstance_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Session" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SessionStatus" NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "isEphemeral" BOOLEAN NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "adapterGlobalOid" BIGINT,
    "connectionState" "SessionConnectionState" NOT NULL DEFAULT 'disconnected',
    "isStarted" BOOLEAN NOT NULL DEFAULT false,
    "hasErrors" BOOLEAN NOT NULL DEFAULT false,
    "hasWarnings" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "privateMetadata" JSONB,
    "sharedProviderName" TEXT,
    "sharedProviderDescription" TEXT,
    "dataRetentionLevel" "SessionDataRetentionLevel" NOT NULL DEFAULT 'full',
    "storeToolCallAttachments" BOOLEAN NOT NULL DEFAULT true,
    "collectErrors" BOOLEAN NOT NULL DEFAULT true,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "solutionOid" INTEGER NOT NULL,
    "identityActorOid" BIGINT,
    "identityOid" BIGINT,
    "source" "IntegrationResourceSource",
    "isOwnerLocked" BOOLEAN NOT NULL DEFAULT false,
    "isOwnerOnlyVisible" BOOLEAN NOT NULL DEFAULT false,
    "isSystemOwned" BOOLEAN NOT NULL DEFAULT false,
    "ownerActorOid" BIGINT,
    "ephemeralManagedSessionOid" BIGINT,
    "ownerPublicMcpServerOid" BIGINT,
    "totalProductiveClientMessageCount" INTEGER NOT NULL DEFAULT 0,
    "totalProductiveProviderMessageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastConnectionCreatedAt" TIMESTAMP(3),
    "lastMessageAt" TIMESTAMP(3),
    "lastActiveAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SessionTemplate" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SessionTemplateStatus" NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT,
    "description" TEXT,
    "hash" TEXT,
    "metadata" JSONB,
    "privateMetadata" JSONB,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "solutionOid" INTEGER NOT NULL,
    "identityActorOid" BIGINT,
    "identityOid" BIGINT,
    "source" "IntegrationResourceSource",
    "isOwnerLocked" BOOLEAN NOT NULL DEFAULT false,
    "isOwnerOnlyVisible" BOOLEAN NOT NULL DEFAULT false,
    "isSystemOwned" BOOLEAN NOT NULL DEFAULT false,
    "ownerActorOid" BIGINT,
    "integrationInstanceOid" BIGINT,
    "integrationInstanceGroupOid" BIGINT,
    "defaultSessionTemplateForIntegrationInstanceOid" BIGINT,
    "defaultSessionTemplateForIntegrationInstanceGroupOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionTemplate_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SessionTemplateProvider" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SessionTemplateProviderStatus" NOT NULL,
    "toolFilter" JSONB NOT NULL,
    "sessionTemplateOid" BIGINT NOT NULL,
    "providerOid" BIGINT NOT NULL,
    "deploymentOid" BIGINT NOT NULL,
    "configOid" BIGINT NOT NULL,
    "authConfigOid" BIGINT,
    "integrationInstanceProviderOid" BIGINT,
    "integrationInstanceGroupProviderOid" BIGINT,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "solutionOid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionTemplateProvider_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SessionUsageRecord" (
    "id" TEXT NOT NULL,
    "clientMessageIncrement" INTEGER NOT NULL,
    "providerMessageIncrement" INTEGER NOT NULL,
    "sessionOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "solutionOid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionUsageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderRunUsageRecord" (
    "id" TEXT NOT NULL,
    "providerRunOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "solutionOid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderRunUsageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionWarning" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "isParentDeleted" BOOLEAN NOT NULL DEFAULT false,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "payload" JSONB,
    "sessionOid" BIGINT NOT NULL,
    "connectionOid" BIGINT,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "solutionOid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionWarning_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SkillEntity" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "image" JSONB,
    "ownerSkillOid" BIGINT,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "solutionOid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillEntity_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Skill" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SkillStatus" NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "privateMetadata" JSONB,
    "image" JSONB,
    "clientName" TEXT NOT NULL,
    "clientDescription" TEXT,
    "clientMetadata" JSONB,
    "license" TEXT,
    "compatibility" TEXT,
    "storeId" TEXT NOT NULL,
    "skillEntityOid" BIGINT NOT NULL,
    "forkedFromSkillOid" BIGINT,
    "duplicatedFromSkillOid" BIGINT,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "solutionOid" INTEGER NOT NULL,
    "parentTemplateOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SkillIntegration" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SkillIntegrationStatus" NOT NULL,
    "skillOid" BIGINT NOT NULL,
    "integrationOid" BIGINT NOT NULL,
    "itemOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillIntegration_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SkillProvider" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SkillProviderStatus" NOT NULL,
    "skillOid" BIGINT NOT NULL,
    "providerOid" BIGINT NOT NULL,
    "itemOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillProvider_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SkillProviderLink" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "skillOid" BIGINT NOT NULL,
    "providerOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillProviderLink_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SkillItem" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SkillItemStatus" NOT NULL,
    "type" "SkillItemType" NOT NULL,
    "skillOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillItem_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SkillTemplate" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SkillTemplateStatus" NOT NULL,
    "owner" "SkillTemplateOwner" NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "privateMetadata" JSONB,
    "systemIdentifier" TEXT,
    "storeId" TEXT,
    "storeTemplateId" TEXT NOT NULL,
    "tenantOid" BIGINT,
    "projectOid" BIGINT,
    "environmentOid" BIGINT,
    "instanceOid" BIGINT,
    "solutionOid" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillTemplate_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SkillTemplateItem" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "skillTemplateOid" BIGINT NOT NULL,
    "providerOid" BIGINT,
    "integrationOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillTemplateItem_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Solution" (
    "oid" INTEGER NOT NULL,
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Solution_pkey" PRIMARY KEY ("oid")
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
    "isOrganizationMember" BOOLEAN NOT NULL DEFAULT false,
    "isPortalConsumer" BOOLEAN NOT NULL DEFAULT false,
    "isManuallyCreated" BOOLEAN NOT NULL DEFAULT false,
    "isPending" BOOLEAN NOT NULL DEFAULT false,
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
    "inviteStatus" "ConsumerProfileInviteStatus" NOT NULL DEFAULT 'unset',
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "organizationOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "consumerOid" BIGINT NOT NULL,
    "organizationMemberOid" BIGINT,
    "organizationActorOid" BIGINT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsumerProfile_pkey" PRIMARY KEY ("oid")
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
    "environmentOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Instance_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Tenant" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "urlKey" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slateTenantId" TEXT,
    "slateTenantIdentifier" TEXT,
    "shuttleTenantId" TEXT,
    "shuttleTenantIdentifier" TEXT,
    "originTenantId" TEXT,
    "originTenantIdentifier" TEXT,
    "functionBayTenantId" TEXT,
    "functionBayTenantIdentifier" TEXT,
    "resourceTenantId" TEXT,
    "resourceTenantIdentifier" TEXT,
    "projectOid" BIGINT,
    "hidePublicRemoteProviders" BOOLEAN NOT NULL DEFAULT false,
    "onlyAllowTrustedProviders" BOOLEAN NOT NULL DEFAULT false,
    "isWhitelabel" BOOLEAN NOT NULL DEFAULT false,
    "useIntegrationNamesForSessionProviderNameTemplates" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "logRetentionInDays" INTEGER NOT NULL DEFAULT 30,
    "messageProcessingTimeoutMs" INTEGER NOT NULL DEFAULT 30000,
    "enforceSessionExpiry" BOOLEAN NOT NULL DEFAULT false,
    "allowAuthConfigExport" BOOLEAN NOT NULL DEFAULT false,
    "allowAuthConfigImport" BOOLEAN NOT NULL DEFAULT false,
    "onlyAllowOAuthAuthMethods" BOOLEAN NOT NULL DEFAULT false,
    "collectOperationDescriptionForToolCalls" BOOLEAN NOT NULL DEFAULT true,
    "sessionlessMcpEnabled" BOOLEAN,
    "dataRetentionLevel" "SessionDataRetentionLevel" NOT NULL DEFAULT 'full',
    "storeToolCallAttachments" BOOLEAN NOT NULL DEFAULT true,
    "collectErrors" BOOLEAN NOT NULL DEFAULT true,
    "disableCallbacks" BOOLEAN NOT NULL DEFAULT false,
    "reducedSubprocessors" BOOLEAN NOT NULL DEFAULT false,
    "allowApiAccessToConsumerOwnedResources" BOOLEAN NOT NULL DEFAULT true,
    "allowMemberAccessToConsumerOwnedResources" BOOLEAN NOT NULL DEFAULT true,
    "retiredAt" TIMESTAMP(3),

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Environment" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "EnvironmentType" NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "resourceGroupId" TEXT,
    "resourceGroupIdentifier" TEXT,
    "instanceOid" BIGINT,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Environment_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Actor" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "ActorType" NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organizationActorId" TEXT,
    "organizationActorOid" BIGINT,
    "resourceActorId" TEXT,
    "resourceActorIdentifier" TEXT,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Actor_pkey" PRIMARY KEY ("oid")
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
    "organizationOid" BIGINT NOT NULL,
    "actorOid" BIGINT NOT NULL,

    CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Project" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "ProjectStatus" NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organizationOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Brand" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "image" JSONB,
    "tenantOid" BIGINT,
    "projectOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderSetupSession" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "ProviderSetupSessionStatus" NOT NULL,
    "type" "ProviderSetupSessionType" NOT NULL,
    "typeConcrete" "ProviderSetupSessionTypeConcrete",
    "uiMode" "ProviderSetupSessionUiMode" NOT NULL DEFAULT 'metorial_elements',
    "isParentDeleted" BOOLEAN NOT NULL DEFAULT false,
    "skipConfirmation" BOOLEAN NOT NULL DEFAULT false,
    "clientSecret" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "privateMetadata" JSONB,
    "configuration" JSONB,
    "redirectUrl" TEXT,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "solutionOid" INTEGER NOT NULL,
    "providerOid" BIGINT,
    "authMethodOid" BIGINT,
    "deploymentOid" BIGINT,
    "identityOid" BIGINT,
    "source" "IntegrationResourceSource",
    "isOwnerLocked" BOOLEAN NOT NULL DEFAULT false,
    "isOwnerOnlyVisible" BOOLEAN NOT NULL DEFAULT false,
    "isSystemOwned" BOOLEAN NOT NULL DEFAULT false,
    "ownerActorOid" BIGINT,
    "authConfigOid" BIGINT,
    "configOid" BIGINT,
    "identityCredentialOid" BIGINT,
    "oauthSetupOid" BIGINT,
    "authCredentialsOid" BIGINT,
    "brandOid" BIGINT,
    "ownerPublicMcpServerOid" BIGINT,
    "integrationSetupSessionProviderOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderSetupSession_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderSetupSessionEvent" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "ProviderSetupSessionEventType" NOT NULL,
    "ip" TEXT,
    "ua" TEXT,
    "setupOid" BIGINT,
    "sessionOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderSetupSessionEvent_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderSetupSessionEmail" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "organizationMemberId" TEXT,
    "throttleBucket" INTEGER NOT NULL,
    "setupSessionOid" BIGINT NOT NULL,
    "senderActorOid" BIGINT,
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderSetupSessionEmail_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "IntegrationSetupSession" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "IntegrationSetupSessionStatus" NOT NULL,
    "skipConfirmation" BOOLEAN NOT NULL DEFAULT false,
    "clientSecret" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "privateMetadata" JSONB,
    "configuration" JSONB,
    "redirectUrl" TEXT,
    "tenantOid" BIGINT NOT NULL,
    "projectOid" BIGINT,
    "environmentOid" BIGINT NOT NULL,
    "instanceOid" BIGINT,
    "solutionOid" INTEGER NOT NULL,
    "integrationOid" BIGINT NOT NULL,
    "integrationInstanceOid" BIGINT NOT NULL,
    "isOwnerLocked" BOOLEAN NOT NULL DEFAULT false,
    "isOwnerOnlyVisible" BOOLEAN NOT NULL DEFAULT false,
    "isSystemOwned" BOOLEAN NOT NULL DEFAULT false,
    "ownerActorOid" BIGINT,
    "brandOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationSetupSession_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "IntegrationSetupSessionProvider" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "integrationSetupSessionOid" BIGINT NOT NULL,
    "integrationProviderOid" BIGINT NOT NULL,
    "providerSetupSessionOid" BIGINT,
    "integrationInstanceProviderOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationSetupSessionProvider_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "IntegrationSetupSessionStep" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "integrationSetupSessionOid" BIGINT NOT NULL,
    "integrationSetupSessionProviderOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationSetupSessionStep_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "IntegrationSetupSessionEvent" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "IntegrationSetupSessionEventType" NOT NULL,
    "ip" TEXT,
    "ua" TEXT,
    "integrationSetupSessionProviderOid" BIGINT,
    "integrationSetupSessionOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationSetupSessionEvent_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "_ProviderListingToProviderListingCategory" (
    "A" BIGINT NOT NULL,
    "B" BIGINT NOT NULL,

    CONSTRAINT "_ProviderListingToProviderListingCategory_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ProviderListingToProviderListingCollection" (
    "A" BIGINT NOT NULL,
    "B" BIGINT NOT NULL,

    CONSTRAINT "_ProviderListingToProviderListingCollection_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ProviderListingToProviderListingGroup" (
    "A" BIGINT NOT NULL,
    "B" BIGINT NOT NULL,

    CONSTRAINT "_ProviderListingToProviderListingGroup_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdapterIntegrationInstance_id_key" ON "AdapterIntegrationInstance"("id");

-- CreateIndex
CREATE INDEX "AdapterIntegrationInstance_tenantOid_solutionOid_environmen_idx" ON "AdapterIntegrationInstance"("tenantOid", "solutionOid", "environmentOid", "status");

-- CreateIndex
CREATE INDEX "AdapterIntegrationInstance_adapterIntegrationOid_status_idx" ON "AdapterIntegrationInstance"("adapterIntegrationOid", "status");

-- CreateIndex
CREATE INDEX "AdapterIntegrationInstance_integrationOid_status_idx" ON "AdapterIntegrationInstance"("integrationOid", "status");

-- CreateIndex
CREATE INDEX "AdapterIntegrationInstance_status_idx" ON "AdapterIntegrationInstance"("status");

-- CreateIndex
CREATE INDEX "AdapterIntegrationInstance_isStandalone_idx" ON "AdapterIntegrationInstance"("isStandalone");

-- CreateIndex
CREATE INDEX "AdapterIntegrationInstance_projectOid_idx" ON "AdapterIntegrationInstance"("projectOid");

-- CreateIndex
CREATE INDEX "AdapterIntegrationInstance_instanceOid_idx" ON "AdapterIntegrationInstance"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "AdapterIntegrationInstance_adapterIntegrationOid_integratio_key" ON "AdapterIntegrationInstance"("adapterIntegrationOid", "integrationInstanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "AdapterIntegrationInstanceProvider_id_key" ON "AdapterIntegrationInstanceProvider"("id");

-- CreateIndex
CREATE UNIQUE INDEX "AdapterIntegrationInstanceProvider_currentSessionOid_key" ON "AdapterIntegrationInstanceProvider"("currentSessionOid");

-- CreateIndex
CREATE INDEX "AdapterIntegrationInstanceProvider_tenantOid_solutionOid_en_idx" ON "AdapterIntegrationInstanceProvider"("tenantOid", "solutionOid", "environmentOid", "status");

-- CreateIndex
CREATE INDEX "aiip_aii_status_idx" ON "AdapterIntegrationInstanceProvider"("adapterIntegrationInstanceOid", "status");

-- CreateIndex
CREATE INDEX "aiip_aip_status_idx" ON "AdapterIntegrationInstanceProvider"("adapterIntegrationProviderOid", "status");

-- CreateIndex
CREATE INDEX "aiip_iip_status_idx" ON "AdapterIntegrationInstanceProvider"("integrationInstanceProviderOid", "status");

-- CreateIndex
CREATE INDEX "AdapterIntegrationInstanceProvider_integrationProviderOid_s_idx" ON "AdapterIntegrationInstanceProvider"("integrationProviderOid", "status");

-- CreateIndex
CREATE INDEX "AdapterIntegrationInstanceProvider_status_idx" ON "AdapterIntegrationInstanceProvider"("status");

-- CreateIndex
CREATE INDEX "aiip_rotate_idx" ON "AdapterIntegrationInstanceProvider"("willRotateSessionAt", "status");

-- CreateIndex
CREATE INDEX "aiip_current_session_idx" ON "AdapterIntegrationInstanceProvider"("currentSessionOid", "status");

-- CreateIndex
CREATE INDEX "AdapterIntegrationInstanceProvider_projectOid_idx" ON "AdapterIntegrationInstanceProvider"("projectOid");

-- CreateIndex
CREATE INDEX "AdapterIntegrationInstanceProvider_instanceOid_idx" ON "AdapterIntegrationInstanceProvider"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "aiip_instance_provider_key" ON "AdapterIntegrationInstanceProvider"("adapterIntegrationInstanceOid", "adapterIntegrationProviderOid");

-- CreateIndex
CREATE UNIQUE INDEX "AdapterIntegration_id_key" ON "AdapterIntegration"("id");

-- CreateIndex
CREATE INDEX "AdapterIntegration_createdAt_idx" ON "AdapterIntegration"("createdAt");

-- CreateIndex
CREATE INDEX "AdapterIntegration_type_idx" ON "AdapterIntegration"("type");

-- CreateIndex
CREATE INDEX "AdapterIntegration_status_idx" ON "AdapterIntegration"("status");

-- CreateIndex
CREATE INDEX "AdapterIntegration_isStandalone_idx" ON "AdapterIntegration"("isStandalone");

-- CreateIndex
CREATE INDEX "AdapterIntegration_adapterGlobalOid_idx" ON "AdapterIntegration"("adapterGlobalOid");

-- CreateIndex
CREATE INDEX "AdapterIntegration_integrationOid_type_idx" ON "AdapterIntegration"("integrationOid", "type");

-- CreateIndex
CREATE INDEX "AdapterIntegration_projectOid_idx" ON "AdapterIntegration"("projectOid");

-- CreateIndex
CREATE INDEX "AdapterIntegration_instanceOid_idx" ON "AdapterIntegration"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "AdapterIntegrationProvider_id_key" ON "AdapterIntegrationProvider"("id");

-- CreateIndex
CREATE INDEX "AdapterIntegrationProvider_createdAt_idx" ON "AdapterIntegrationProvider"("createdAt");

-- CreateIndex
CREATE INDEX "AdapterIntegrationProvider_status_idx" ON "AdapterIntegrationProvider"("status");

-- CreateIndex
CREATE INDEX "AdapterIntegrationProvider_adapterIntegrationOid_status_idx" ON "AdapterIntegrationProvider"("adapterIntegrationOid", "status");

-- CreateIndex
CREATE INDEX "AdapterIntegrationProvider_projectOid_idx" ON "AdapterIntegrationProvider"("projectOid");

-- CreateIndex
CREATE INDEX "AdapterIntegrationProvider_instanceOid_idx" ON "AdapterIntegrationProvider"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "AdapterIntegrationProvider_adapterIntegrationOid_integratio_key" ON "AdapterIntegrationProvider"("adapterIntegrationOid", "integrationProviderOid");

-- CreateIndex
CREATE UNIQUE INDEX "AdapterIntegrationInstanceProviderSession_id_key" ON "AdapterIntegrationInstanceProviderSession"("id");

-- CreateIndex
CREATE UNIQUE INDEX "AdapterIntegrationInstanceProviderSession_sessionOid_key" ON "AdapterIntegrationInstanceProviderSession"("sessionOid");

-- CreateIndex
CREATE INDEX "aiips_aiip_status_idx" ON "AdapterIntegrationInstanceProviderSession"("adapterIntegrationInstanceProviderOid", "status");

-- CreateIndex
CREATE INDEX "AdapterIntegrationInstanceProviderSession_status_idx" ON "AdapterIntegrationInstanceProviderSession"("status");

-- CreateIndex
CREATE INDEX "AdapterIntegrationInstanceProviderSession_createdAt_idx" ON "AdapterIntegrationInstanceProviderSession"("createdAt");

-- CreateIndex
CREATE INDEX "AdapterIntegrationInstanceProviderSession_projectOid_idx" ON "AdapterIntegrationInstanceProviderSession"("projectOid");

-- CreateIndex
CREATE INDEX "AdapterIntegrationInstanceProviderSession_instanceOid_idx" ON "AdapterIntegrationInstanceProviderSession"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_id_key" ON "Agent"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_actorOid_key" ON "Agent"("actorOid");

-- CreateIndex
CREATE INDEX "Agent_projectOid_idx" ON "Agent"("projectOid");

-- CreateIndex
CREATE INDEX "Agent_instanceOid_idx" ON "Agent"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_environmentOid_slug_key" ON "Agent"("environmentOid", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_environmentOid_hash_key" ON "Agent"("environmentOid", "hash");

-- CreateIndex
CREATE UNIQUE INDEX "AgentClient_id_key" ON "AgentClient"("id");

-- CreateIndex
CREATE UNIQUE INDEX "AgentClient_foreignId_key" ON "AgentClient"("foreignId");

-- CreateIndex
CREATE INDEX "AgentClient_projectOid_idx" ON "AgentClient"("projectOid");

-- CreateIndex
CREATE INDEX "AgentClient_instanceOid_idx" ON "AgentClient"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "AgentClientRegistration_id_key" ON "AgentClientRegistration"("id");

-- CreateIndex
CREATE UNIQUE INDEX "AgentClientRegistration_oauthRegistrationId_key" ON "AgentClientRegistration"("oauthRegistrationId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentInstance_id_key" ON "AgentInstance"("id");

-- CreateIndex
CREATE UNIQUE INDEX "AgentInstance_agentOid_hash_key" ON "AgentInstance"("agentOid", "hash");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderAuthConfig_id_key" ON "ProviderAuthConfig"("id");

-- CreateIndex
CREATE INDEX "ProviderAuthConfig_createdAt_idx" ON "ProviderAuthConfig"("createdAt");

-- CreateIndex
CREATE INDEX "ProviderAuthConfig_updatedAt_idx" ON "ProviderAuthConfig"("updatedAt");

-- CreateIndex
CREATE INDEX "ProviderAuthConfig_isDefault_idx" ON "ProviderAuthConfig"("isDefault");

-- CreateIndex
CREATE INDEX "ProviderAuthConfig_isEphemeral_idx" ON "ProviderAuthConfig"("isEphemeral");

-- CreateIndex
CREATE INDEX "ProviderAuthConfig_status_idx" ON "ProviderAuthConfig"("status");

-- CreateIndex
CREATE INDEX "ProviderAuthConfig_archivedAt_idx" ON "ProviderAuthConfig"("archivedAt");

-- CreateIndex
CREATE INDEX "ProviderAuthConfig_status_archivedAt_idx" ON "ProviderAuthConfig"("status", "archivedAt");

-- CreateIndex
CREATE INDEX "ProviderAuthConfig_type_idx" ON "ProviderAuthConfig"("type");

-- CreateIndex
CREATE INDEX "ProviderAuthConfig_source_idx" ON "ProviderAuthConfig"("source");

-- CreateIndex
CREATE INDEX "ProviderAuthConfig_needsScopeSync_idx" ON "ProviderAuthConfig"("needsScopeSync");

-- CreateIndex
CREATE INDEX "ProviderAuthConfig_projectOid_idx" ON "ProviderAuthConfig"("projectOid");

-- CreateIndex
CREATE INDEX "ProviderAuthConfig_instanceOid_idx" ON "ProviderAuthConfig"("instanceOid");

-- CreateIndex
CREATE INDEX "ProviderAuthConfig_ownerActorOid_idx" ON "ProviderAuthConfig"("ownerActorOid");

-- CreateIndex
CREATE INDEX "ProviderAuthConfig_ownerPublicMcpServerOid_idx" ON "ProviderAuthConfig"("ownerPublicMcpServerOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderAuthConfigVersion_id_key" ON "ProviderAuthConfigVersion"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderAuthConfigVersion_slateAuthConfigOid_key" ON "ProviderAuthConfigVersion"("slateAuthConfigOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderAuthConfigVersion_shuttleAuthConfigOid_key" ON "ProviderAuthConfigVersion"("shuttleAuthConfigOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderAuthConfigUpdate_id_key" ON "ProviderAuthConfigUpdate"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderAuthCredentials_id_key" ON "ProviderAuthCredentials"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderAuthCredentials_slateCredentialsOid_key" ON "ProviderAuthCredentials"("slateCredentialsOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderAuthCredentials_shuttleCredentialsOid_key" ON "ProviderAuthCredentials"("shuttleCredentialsOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderAuthCredentials_managedCredentialsOid_key" ON "ProviderAuthCredentials"("managedCredentialsOid");

-- CreateIndex
CREATE INDEX "ProviderAuthCredentials_createdAt_idx" ON "ProviderAuthCredentials"("createdAt");

-- CreateIndex
CREATE INDEX "ProviderAuthCredentials_updatedAt_idx" ON "ProviderAuthCredentials"("updatedAt");

-- CreateIndex
CREATE INDEX "ProviderAuthCredentials_isDefault_idx" ON "ProviderAuthCredentials"("isDefault");

-- CreateIndex
CREATE INDEX "ProviderAuthCredentials_isEphemeral_idx" ON "ProviderAuthCredentials"("isEphemeral");

-- CreateIndex
CREATE INDEX "ProviderAuthCredentials_origin_idx" ON "ProviderAuthCredentials"("origin");

-- CreateIndex
CREATE INDEX "ProviderAuthCredentials_status_idx" ON "ProviderAuthCredentials"("status");

-- CreateIndex
CREATE INDEX "ProviderAuthCredentials_archivedAt_idx" ON "ProviderAuthCredentials"("archivedAt");

-- CreateIndex
CREATE INDEX "ProviderAuthCredentials_status_archivedAt_idx" ON "ProviderAuthCredentials"("status", "archivedAt");

-- CreateIndex
CREATE INDEX "ProviderAuthCredentials_type_idx" ON "ProviderAuthCredentials"("type");

-- CreateIndex
CREATE INDEX "ProviderAuthCredentials_needsScopeSync_idx" ON "ProviderAuthCredentials"("needsScopeSync");

-- CreateIndex
CREATE INDEX "ProviderAuthCredentials_projectOid_idx" ON "ProviderAuthCredentials"("projectOid");

-- CreateIndex
CREATE INDEX "ProviderAuthCredentials_instanceOid_idx" ON "ProviderAuthCredentials"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "ManagedProviderAuthCredentials_id_key" ON "ManagedProviderAuthCredentials"("id");

-- CreateIndex
CREATE INDEX "ManagedProviderAuthCredentials_status_idx" ON "ManagedProviderAuthCredentials"("status");

-- CreateIndex
CREATE INDEX "ManagedProviderAuthCredentials_providerOid_idx" ON "ManagedProviderAuthCredentials"("providerOid");

-- CreateIndex
CREATE UNIQUE INDEX "ManagedProviderAuthCredentialsBacking_providerAuthCredentia_key" ON "ManagedProviderAuthCredentialsBacking"("providerAuthCredentialsOid");

-- CreateIndex
CREATE INDEX "ManagedProviderAuthCredentialsBacking_projectOid_idx" ON "ManagedProviderAuthCredentialsBacking"("projectOid");

-- CreateIndex
CREATE UNIQUE INDEX "ManagedProviderAuthCredentialsBacking_managedCredentialsOid_key" ON "ManagedProviderAuthCredentialsBacking"("managedCredentialsOid", "tenantOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderAuthConfigEvent_id_key" ON "ProviderAuthConfigEvent"("id");

-- CreateIndex
CREATE INDEX "ProviderAuthConfigEvent_createdAt_idx" ON "ProviderAuthConfigEvent"("createdAt");

-- CreateIndex
CREATE INDEX "ProviderAuthConfigEvent_updatedAt_idx" ON "ProviderAuthConfigEvent"("updatedAt");

-- CreateIndex
CREATE INDEX "ProviderAuthConfigEvent_type_idx" ON "ProviderAuthConfigEvent"("type");

-- CreateIndex
CREATE INDEX "ProviderAuthConfigEvent_status_idx" ON "ProviderAuthConfigEvent"("status");

-- CreateIndex
CREATE INDEX "ProviderAuthConfigEvent_authConfigOid_idx" ON "ProviderAuthConfigEvent"("authConfigOid");

-- CreateIndex
CREATE INDEX "ProviderAuthConfigEvent_authCredentialsOid_idx" ON "ProviderAuthConfigEvent"("authCredentialsOid");

-- CreateIndex
CREATE INDEX "ProviderAuthConfigEvent_oauthSetupOid_idx" ON "ProviderAuthConfigEvent"("oauthSetupOid");

-- CreateIndex
CREATE INDEX "ProviderAuthConfigEvent_providerInvocationId_idx" ON "ProviderAuthConfigEvent"("providerInvocationId");

-- CreateIndex
CREATE INDEX "ProviderAuthConfigEvent_providerOid_createdAt_idx" ON "ProviderAuthConfigEvent"("providerOid", "createdAt");

-- CreateIndex
CREATE INDEX "ProviderAuthConfigEvent_tenantOid_idx" ON "ProviderAuthConfigEvent"("tenantOid");

-- CreateIndex
CREATE INDEX "ProviderAuthConfigEvent_environmentOid_idx" ON "ProviderAuthConfigEvent"("environmentOid");

-- CreateIndex
CREATE INDEX "ProviderAuthConfigEvent_projectOid_idx" ON "ProviderAuthConfigEvent"("projectOid");

-- CreateIndex
CREATE INDEX "ProviderAuthConfigEvent_instanceOid_idx" ON "ProviderAuthConfigEvent"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderAuthConfigEvent_sourceType_sourceId_key" ON "ProviderAuthConfigEvent"("sourceType", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderAuthConfigErrorGlobal_id_key" ON "ProviderAuthConfigErrorGlobal"("id");

-- CreateIndex
CREATE INDEX "ProviderAuthConfigErrorGlobal_createdAt_idx" ON "ProviderAuthConfigErrorGlobal"("createdAt");

-- CreateIndex
CREATE INDEX "ProviderAuthConfigErrorGlobal_type_idx" ON "ProviderAuthConfigErrorGlobal"("type");

-- CreateIndex
CREATE INDEX "ProviderAuthConfigErrorGlobal_tenantOid_idx" ON "ProviderAuthConfigErrorGlobal"("tenantOid");

-- CreateIndex
CREATE INDEX "ProviderAuthConfigErrorGlobal_environmentOid_idx" ON "ProviderAuthConfigErrorGlobal"("environmentOid");

-- CreateIndex
CREATE INDEX "ProviderAuthConfigErrorGlobal_projectOid_idx" ON "ProviderAuthConfigErrorGlobal"("projectOid");

-- CreateIndex
CREATE INDEX "ProviderAuthConfigErrorGlobal_instanceOid_idx" ON "ProviderAuthConfigErrorGlobal"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderAuthConfigErrorGlobal_type_hash_tenantOid_key" ON "ProviderAuthConfigErrorGlobal"("type", "hash", "tenantOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderAuthConfigError_id_key" ON "ProviderAuthConfigError"("id");

-- CreateIndex
CREATE INDEX "ProviderAuthConfigError_createdAt_idx" ON "ProviderAuthConfigError"("createdAt");

-- CreateIndex
CREATE INDEX "ProviderAuthConfigError_type_idx" ON "ProviderAuthConfigError"("type");

-- CreateIndex
CREATE INDEX "ProviderAuthConfigError_groupOid_idx" ON "ProviderAuthConfigError"("groupOid");

-- CreateIndex
CREATE INDEX "ProviderAuthConfigError_authConfigEventOid_idx" ON "ProviderAuthConfigError"("authConfigEventOid");

-- CreateIndex
CREATE INDEX "ProviderAuthConfigError_authConfigOid_idx" ON "ProviderAuthConfigError"("authConfigOid");

-- CreateIndex
CREATE INDEX "ProviderAuthConfigError_authCredentialsOid_idx" ON "ProviderAuthConfigError"("authCredentialsOid");

-- CreateIndex
CREATE INDEX "ProviderAuthConfigError_oauthSetupOid_idx" ON "ProviderAuthConfigError"("oauthSetupOid");

-- CreateIndex
CREATE INDEX "ProviderAuthConfigError_providerInvocationId_idx" ON "ProviderAuthConfigError"("providerInvocationId");

-- CreateIndex
CREATE INDEX "ProviderAuthConfigError_tenantOid_idx" ON "ProviderAuthConfigError"("tenantOid");

-- CreateIndex
CREATE INDEX "ProviderAuthConfigError_environmentOid_idx" ON "ProviderAuthConfigError"("environmentOid");

-- CreateIndex
CREATE INDEX "ProviderAuthConfigError_projectOid_idx" ON "ProviderAuthConfigError"("projectOid");

-- CreateIndex
CREATE INDEX "ProviderAuthConfigError_instanceOid_idx" ON "ProviderAuthConfigError"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderAuthConfigError_sourceType_sourceId_key" ON "ProviderAuthConfigError"("sourceType", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderAuthExport_id_key" ON "ProviderAuthExport"("id");

-- CreateIndex
CREATE INDEX "ProviderAuthExport_createdAt_idx" ON "ProviderAuthExport"("createdAt");

-- CreateIndex
CREATE INDEX "ProviderAuthExport_projectOid_idx" ON "ProviderAuthExport"("projectOid");

-- CreateIndex
CREATE INDEX "ProviderAuthExport_instanceOid_idx" ON "ProviderAuthExport"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderAuthImport_id_key" ON "ProviderAuthImport"("id");

-- CreateIndex
CREATE INDEX "ProviderAuthImport_createdAt_idx" ON "ProviderAuthImport"("createdAt");

-- CreateIndex
CREATE INDEX "ProviderAuthImport_projectOid_idx" ON "ProviderAuthImport"("projectOid");

-- CreateIndex
CREATE INDEX "ProviderAuthImport_instanceOid_idx" ON "ProviderAuthImport"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderOAuthSetup_id_key" ON "ProviderOAuthSetup"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderOAuthSetup_slateOAuthSetupOid_key" ON "ProviderOAuthSetup"("slateOAuthSetupOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderOAuthSetup_shuttleOAuthSetupOid_key" ON "ProviderOAuthSetup"("shuttleOAuthSetupOid");

-- CreateIndex
CREATE INDEX "ProviderOAuthSetup_status_idx" ON "ProviderOAuthSetup"("status");

-- CreateIndex
CREATE INDEX "ProviderOAuthSetup_expiresAt_idx" ON "ProviderOAuthSetup"("expiresAt");

-- CreateIndex
CREATE INDEX "ProviderOAuthSetup_isEphemeral_idx" ON "ProviderOAuthSetup"("isEphemeral");

-- CreateIndex
CREATE INDEX "ProviderOAuthSetup_projectOid_idx" ON "ProviderOAuthSetup"("projectOid");

-- CreateIndex
CREATE INDEX "ProviderOAuthSetup_instanceOid_idx" ON "ProviderOAuthSetup"("instanceOid");

-- CreateIndex
CREATE INDEX "ProviderOAuthSetup_ownerPublicMcpServerOid_idx" ON "ProviderOAuthSetup"("ownerPublicMcpServerOid");

-- CreateIndex
CREATE UNIQUE INDEX "Backend_id_key" ON "Backend"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Backend_type_key" ON "Backend"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Backend_identifier_key" ON "Backend"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "ShuttleOAuthCredentials_id_key" ON "ShuttleOAuthCredentials"("id");

-- CreateIndex
CREATE INDEX "ShuttleOAuthCredentials_projectOid_idx" ON "ShuttleOAuthCredentials"("projectOid");

-- CreateIndex
CREATE UNIQUE INDEX "ShuttleOAuthSetup_id_key" ON "ShuttleOAuthSetup"("id");

-- CreateIndex
CREATE INDEX "ShuttleOAuthSetup_projectOid_idx" ON "ShuttleOAuthSetup"("projectOid");

-- CreateIndex
CREATE UNIQUE INDEX "ShuttleAuthConfig_id_key" ON "ShuttleAuthConfig"("id");

-- CreateIndex
CREATE INDEX "ShuttleAuthConfig_projectOid_idx" ON "ShuttleAuthConfig"("projectOid");

-- CreateIndex
CREATE UNIQUE INDEX "ShuttleServerConfig_id_key" ON "ShuttleServerConfig"("id");

-- CreateIndex
CREATE INDEX "ShuttleServerConfig_projectOid_idx" ON "ShuttleServerConfig"("projectOid");

-- CreateIndex
CREATE UNIQUE INDEX "ShuttleCustomServer_id_key" ON "ShuttleCustomServer"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ShuttleCustomServer_identifier_key" ON "ShuttleCustomServer"("identifier");

-- CreateIndex
CREATE INDEX "ShuttleCustomServer_projectOid_idx" ON "ShuttleCustomServer"("projectOid");

-- CreateIndex
CREATE UNIQUE INDEX "ShuttleCustomServerDeployment_id_key" ON "ShuttleCustomServerDeployment"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ShuttleCustomServerDeployment_identifier_key" ON "ShuttleCustomServerDeployment"("identifier");

-- CreateIndex
CREATE INDEX "ShuttleCustomServerDeployment_projectOid_idx" ON "ShuttleCustomServerDeployment"("projectOid");

-- CreateIndex
CREATE UNIQUE INDEX "ServerInstanceConfiguration_id_key" ON "ServerInstanceConfiguration"("id");

-- CreateIndex
CREATE INDEX "ServerInstanceConfiguration_projectOid_idx" ON "ServerInstanceConfiguration"("projectOid");

-- CreateIndex
CREATE INDEX "ServerInstanceConfiguration_instanceOid_idx" ON "ServerInstanceConfiguration"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "ShuttleConnection_id_key" ON "ShuttleConnection"("id");

-- CreateIndex
CREATE INDEX "ShuttleConnection_providerRunOid_idx" ON "ShuttleConnection"("providerRunOid");

-- CreateIndex
CREATE UNIQUE INDEX "ShuttleServer_id_key" ON "ShuttleServer"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ShuttleServer_identifier_key" ON "ShuttleServer"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "ShuttleServerVersion_id_key" ON "ShuttleServerVersion"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ShuttleServerVersion_identifier_key" ON "ShuttleServerVersion"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "SlateOAuthCredentials_id_key" ON "SlateOAuthCredentials"("id");

-- CreateIndex
CREATE INDEX "SlateOAuthCredentials_projectOid_idx" ON "SlateOAuthCredentials"("projectOid");

-- CreateIndex
CREATE UNIQUE INDEX "SlateOAuthSetup_id_key" ON "SlateOAuthSetup"("id");

-- CreateIndex
CREATE INDEX "SlateOAuthSetup_projectOid_idx" ON "SlateOAuthSetup"("projectOid");

-- CreateIndex
CREATE UNIQUE INDEX "SlateAuthConfig_id_key" ON "SlateAuthConfig"("id");

-- CreateIndex
CREATE INDEX "SlateAuthConfig_projectOid_idx" ON "SlateAuthConfig"("projectOid");

-- CreateIndex
CREATE UNIQUE INDEX "SlateCallback_id_key" ON "SlateCallback"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SlateCallback_callbackOid_key" ON "SlateCallback"("callbackOid");

-- CreateIndex
CREATE INDEX "SlateCallback_projectOid_idx" ON "SlateCallback"("projectOid");

-- CreateIndex
CREATE UNIQUE INDEX "SlateCallbackInstance_id_key" ON "SlateCallbackInstance"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SlateCallbackInstance_callbackInstanceOid_key" ON "SlateCallbackInstance"("callbackInstanceOid");

-- CreateIndex
CREATE INDEX "SlateCallbackInstance_triggerRegistrationId_idx" ON "SlateCallbackInstance"("triggerRegistrationId");

-- CreateIndex
CREATE INDEX "SlateCallbackInstance_projectOid_idx" ON "SlateCallbackInstance"("projectOid");

-- CreateIndex
CREATE UNIQUE INDEX "SlateWebhookRegistration_id_key" ON "SlateWebhookRegistration"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SlateWebhookRegistration_webhookRegistrationOid_key" ON "SlateWebhookRegistration"("webhookRegistrationOid");

-- CreateIndex
CREATE INDEX "SlateWebhookRegistration_projectOid_idx" ON "SlateWebhookRegistration"("projectOid");

-- CreateIndex
CREATE UNIQUE INDEX "SlateTriggerEvent_id_key" ON "SlateTriggerEvent"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SlateTriggerEvent_callbackEventOid_key" ON "SlateTriggerEvent"("callbackEventOid");

-- CreateIndex
CREATE INDEX "SlateTriggerEvent_slateCallbackInstanceOid_createdAt_idx" ON "SlateTriggerEvent"("slateCallbackInstanceOid", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SlateInstance_id_key" ON "SlateInstance"("id");

-- CreateIndex
CREATE INDEX "SlateInstance_projectOid_idx" ON "SlateInstance"("projectOid");

-- CreateIndex
CREATE UNIQUE INDEX "SlateInstanceConfiguration_id_key" ON "SlateInstanceConfiguration"("id");

-- CreateIndex
CREATE INDEX "SlateInstanceConfiguration_projectOid_idx" ON "SlateInstanceConfiguration"("projectOid");

-- CreateIndex
CREATE INDEX "SlateInstanceConfiguration_instanceOid_idx" ON "SlateInstanceConfiguration"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "SlateToolCall_id_key" ON "SlateToolCall"("id");

-- CreateIndex
CREATE INDEX "SlateToolCall_sessionOid_idx" ON "SlateToolCall"("sessionOid");

-- CreateIndex
CREATE UNIQUE INDEX "SlateSession_id_key" ON "SlateSession"("id");

-- CreateIndex
CREATE INDEX "SlateSession_providerRunOid_idx" ON "SlateSession"("providerRunOid");

-- CreateIndex
CREATE UNIQUE INDEX "Slate_id_key" ON "Slate"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Slate_identifier_key" ON "Slate"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "SlateVersion_id_key" ON "SlateVersion"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SlateVersion_identifier_key" ON "SlateVersion"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "CallbackV2_id_key" ON "CallbackV2"("id");

-- CreateIndex
CREATE INDEX "CallbackV2_tenantOid_solutionOid_environmentOid_status_idx" ON "CallbackV2"("tenantOid", "solutionOid", "environmentOid", "status");

-- CreateIndex
CREATE INDEX "CallbackV2_integrationProviderOid_status_idx" ON "CallbackV2"("integrationProviderOid", "status");

-- CreateIndex
CREATE INDEX "CallbackV2_integrationProviderOid_ownership_managedAdapterG_idx" ON "CallbackV2"("integrationProviderOid", "ownership", "managedAdapterGlobalOid", "status");

-- CreateIndex
CREATE INDEX "CallbackV2_syncStatus_idx" ON "CallbackV2"("syncStatus");

-- CreateIndex
CREATE INDEX "CallbackV2_status_archivedAt_idx" ON "CallbackV2"("status", "archivedAt");

-- CreateIndex
CREATE INDEX "CallbackV2_integrationOid_status_idx" ON "CallbackV2"("integrationOid", "status");

-- CreateIndex
CREATE INDEX "CallbackV2_providerVariantOid_idx" ON "CallbackV2"("providerVariantOid");

-- CreateIndex
CREATE INDEX "CallbackV2_projectOid_idx" ON "CallbackV2"("projectOid");

-- CreateIndex
CREATE INDEX "CallbackV2_instanceOid_idx" ON "CallbackV2"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "CallbackEventV2_id_key" ON "CallbackEventV2"("id");

-- CreateIndex
CREATE INDEX "CallbackEventV2_callbackOid_createdAt_idx" ON "CallbackEventV2"("callbackOid", "createdAt");

-- CreateIndex
CREATE INDEX "CallbackEventV2_callbackInstanceOid_createdAt_idx" ON "CallbackEventV2"("callbackInstanceOid", "createdAt");

-- CreateIndex
CREATE INDEX "CallbackEventV2_createdAt_id_idx" ON "CallbackEventV2"("createdAt", "id");

-- CreateIndex
CREATE INDEX "CallbackEventV2_tenantOid_solutionOid_environmentOid_create_idx" ON "CallbackEventV2"("tenantOid", "solutionOid", "environmentOid", "createdAt");

-- CreateIndex
CREATE INDEX "CallbackEventV2_status_idx" ON "CallbackEventV2"("status");

-- CreateIndex
CREATE INDEX "CallbackEventV2_projectOid_idx" ON "CallbackEventV2"("projectOid");

-- CreateIndex
CREATE INDEX "CallbackEventV2_instanceOid_idx" ON "CallbackEventV2"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "CallbackInstanceV2_id_key" ON "CallbackInstanceV2"("id");

-- CreateIndex
CREATE INDEX "CallbackInstanceV2_callbackOid_integrationInstanceProviderO_idx" ON "CallbackInstanceV2"("callbackOid", "integrationInstanceProviderOid", "status");

-- CreateIndex
CREATE INDEX "CallbackInstanceV2_callbackOid_status_idx" ON "CallbackInstanceV2"("callbackOid", "status");

-- CreateIndex
CREATE INDEX "CallbackInstanceV2_integrationInstanceOid_status_idx" ON "CallbackInstanceV2"("integrationInstanceOid", "status");

-- CreateIndex
CREATE INDEX "CallbackInstanceV2_integrationInstanceProviderOid_status_idx" ON "CallbackInstanceV2"("integrationInstanceProviderOid", "status");

-- CreateIndex
CREATE INDEX "CallbackInstanceV2_integrationInstanceProviderOid_status_ge_idx" ON "CallbackInstanceV2"("integrationInstanceProviderOid", "status", "generationStatus");

-- CreateIndex
CREATE INDEX "CallbackInstanceV2_providerConfigVersionOid_idx" ON "CallbackInstanceV2"("providerConfigVersionOid");

-- CreateIndex
CREATE INDEX "CallbackInstanceV2_providerAuthConfigVersionOid_idx" ON "CallbackInstanceV2"("providerAuthConfigVersionOid");

-- CreateIndex
CREATE INDEX "CallbackInstanceV2_syncStatus_idx" ON "CallbackInstanceV2"("syncStatus");

-- CreateIndex
CREATE INDEX "CallbackInstanceV2_status_archivedAt_idx" ON "CallbackInstanceV2"("status", "archivedAt");

-- CreateIndex
CREATE INDEX "CallbackInstanceV2_projectOid_idx" ON "CallbackInstanceV2"("projectOid");

-- CreateIndex
CREATE INDEX "CallbackInstanceV2_instanceOid_idx" ON "CallbackInstanceV2"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookRegistrationV2_id_key" ON "WebhookRegistrationV2"("id");

-- CreateIndex
CREATE INDEX "WebhookRegistrationV2_tenantOid_solutionOid_environmentOid__idx" ON "WebhookRegistrationV2"("tenantOid", "solutionOid", "environmentOid", "status");

-- CreateIndex
CREATE INDEX "WebhookRegistrationV2_providerOid_status_idx" ON "WebhookRegistrationV2"("providerOid", "status");

-- CreateIndex
CREATE INDEX "WebhookRegistrationV2_status_archivedAt_idx" ON "WebhookRegistrationV2"("status", "archivedAt");

-- CreateIndex
CREATE INDEX "WebhookRegistrationV2_providerVariantOid_idx" ON "WebhookRegistrationV2"("providerVariantOid");

-- CreateIndex
CREATE INDEX "WebhookRegistrationV2_projectOid_idx" ON "WebhookRegistrationV2"("projectOid");

-- CreateIndex
CREATE INDEX "WebhookRegistrationV2_instanceOid_idx" ON "WebhookRegistrationV2"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "ChatAuthor_id_key" ON "ChatAuthor"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ChatAuthor_chatOid_userId_key" ON "ChatAuthor"("chatOid", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatWorkspace_id_key" ON "ChatWorkspace"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ChatWorkspace_chatOid_key" ON "ChatWorkspace"("chatOid");

-- CreateIndex
CREATE UNIQUE INDEX "cws_ciip_workspace_key" ON "ChatWorkspace"("chatInstanceProviderOid", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatChannel_id_key" ON "ChatChannel"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ChatChannel_chatOid_channelId_key" ON "ChatChannel"("chatOid", "channelId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatThread_id_key" ON "ChatThread"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ChatThread_channelOid_threadId_key" ON "ChatThread"("channelOid", "threadId");

-- CreateIndex
CREATE UNIQUE INDEX "Chat_id_key" ON "Chat"("id");

-- CreateIndex
CREATE INDEX "Chat_chatConnectionOid_status_idx" ON "Chat"("chatConnectionOid", "status");

-- CreateIndex
CREATE INDEX "Chat_chatInstanceOid_status_idx" ON "Chat"("chatInstanceOid", "status");

-- CreateIndex
CREATE INDEX "Chat_chatInstanceProviderOid_status_idx" ON "Chat"("chatInstanceProviderOid", "status");

-- CreateIndex
CREATE INDEX "Chat_status_archivedAt_idx" ON "Chat"("status", "archivedAt");

-- CreateIndex
CREATE INDEX "Chat_createdAt_idx" ON "Chat"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChatConnection_id_key" ON "ChatConnection"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ChatConnection_slug_key" ON "ChatConnection"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ChatConnection_adapterIntegrationOid_key" ON "ChatConnection"("adapterIntegrationOid");

-- CreateIndex
CREATE INDEX "ChatConnection_createdAt_idx" ON "ChatConnection"("createdAt");

-- CreateIndex
CREATE INDEX "ChatConnection_updatedAt_idx" ON "ChatConnection"("updatedAt");

-- CreateIndex
CREATE INDEX "ChatConnection_status_idx" ON "ChatConnection"("status");

-- CreateIndex
CREATE INDEX "ChatConnection_status_archivedAt_idx" ON "ChatConnection"("status", "archivedAt");

-- CreateIndex
CREATE INDEX "ChatConnection_projectOid_idx" ON "ChatConnection"("projectOid");

-- CreateIndex
CREATE INDEX "ChatConnection_instanceOid_idx" ON "ChatConnection"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "ChatConnectionProvider_id_key" ON "ChatConnectionProvider"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ChatConnectionProvider_adapterIntegrationProviderOid_key" ON "ChatConnectionProvider"("adapterIntegrationProviderOid");

-- CreateIndex
CREATE INDEX "ChatConnectionProvider_createdAt_idx" ON "ChatConnectionProvider"("createdAt");

-- CreateIndex
CREATE INDEX "ChatConnectionProvider_updatedAt_idx" ON "ChatConnectionProvider"("updatedAt");

-- CreateIndex
CREATE INDEX "ChatConnectionProvider_status_idx" ON "ChatConnectionProvider"("status");

-- CreateIndex
CREATE INDEX "ChatConnectionProvider_chatConnectionOid_status_idx" ON "ChatConnectionProvider"("chatConnectionOid", "status");

-- CreateIndex
CREATE INDEX "ChatConnectionProvider_adapterIntegrationOid_status_idx" ON "ChatConnectionProvider"("adapterIntegrationOid", "status");

-- CreateIndex
CREATE INDEX "ChatConnectionProvider_projectOid_idx" ON "ChatConnectionProvider"("projectOid");

-- CreateIndex
CREATE INDEX "ChatConnectionProvider_instanceOid_idx" ON "ChatConnectionProvider"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "ChatEvent_id_key" ON "ChatEvent"("id");

-- CreateIndex
CREATE INDEX "ChatEvent_chatOid_occurredAt_idx" ON "ChatEvent"("chatOid", "occurredAt");

-- CreateIndex
CREATE INDEX "chevt_ciip_occurred_idx" ON "ChatEvent"("chatInstanceProviderOid", "occurredAt");

-- CreateIndex
CREATE INDEX "ChatEvent_chatConnectionOid_occurredAt_idx" ON "ChatEvent"("chatConnectionOid", "occurredAt");

-- CreateIndex
CREATE INDEX "ChatEvent_type_occurredAt_idx" ON "ChatEvent"("type", "occurredAt");

-- CreateIndex
CREATE INDEX "ChatEvent_sessionMessageOid_idx" ON "ChatEvent"("sessionMessageOid");

-- CreateIndex
CREATE INDEX "chevt_scope_occurred_idx" ON "ChatEvent"("tenantOid", "solutionOid", "environmentOid", "occurredAt");

-- CreateIndex
CREATE INDEX "ChatEvent_createdAt_id_idx" ON "ChatEvent"("createdAt", "id");

-- CreateIndex
CREATE INDEX "ChatEvent_projectOid_idx" ON "ChatEvent"("projectOid");

-- CreateIndex
CREATE INDEX "ChatEvent_instanceOid_idx" ON "ChatEvent"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "chevt_callback_event_chat_key" ON "ChatEvent"("callbackEventOid", "chatOid");

-- CreateIndex
CREATE UNIQUE INDEX "chevt_chat_type_provider_event_key" ON "ChatEvent"("chatOid", "type", "providerEventId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatInstance_id_key" ON "ChatInstance"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ChatInstance_adapterIntegrationInstanceOid_key" ON "ChatInstance"("adapterIntegrationInstanceOid");

-- CreateIndex
CREATE INDEX "ChatInstance_tenantOid_solutionOid_environmentOid_status_idx" ON "ChatInstance"("tenantOid", "solutionOid", "environmentOid", "status");

-- CreateIndex
CREATE INDEX "ChatInstance_chatConnectionOid_status_idx" ON "ChatInstance"("chatConnectionOid", "status");

-- CreateIndex
CREATE INDEX "ChatInstance_adapterIntegrationOid_status_idx" ON "ChatInstance"("adapterIntegrationOid", "status");

-- CreateIndex
CREATE INDEX "ChatInstance_status_archivedAt_idx" ON "ChatInstance"("status", "archivedAt");

-- CreateIndex
CREATE INDEX "ChatInstance_projectOid_idx" ON "ChatInstance"("projectOid");

-- CreateIndex
CREATE INDEX "ChatInstance_instanceOid_idx" ON "ChatInstance"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "ChatInstanceProvider_id_key" ON "ChatInstanceProvider"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ChatInstanceProvider_adapterIntegrationInstanceProviderOid_key" ON "ChatInstanceProvider"("adapterIntegrationInstanceProviderOid");

-- CreateIndex
CREATE INDEX "ChatInstanceProvider_tenantOid_solutionOid_environmentOid_s_idx" ON "ChatInstanceProvider"("tenantOid", "solutionOid", "environmentOid", "status");

-- CreateIndex
CREATE INDEX "ciip_cii_status_idx" ON "ChatInstanceProvider"("chatInstanceOid", "status");

-- CreateIndex
CREATE INDEX "ciip_cip_status_idx" ON "ChatInstanceProvider"("chatConnectionProviderOid", "status");

-- CreateIndex
CREATE INDEX "ciip_aiip_status_idx" ON "ChatInstanceProvider"("adapterIntegrationInstanceProviderOid", "status");

-- CreateIndex
CREATE INDEX "ciip_aip_status_idx" ON "ChatInstanceProvider"("adapterIntegrationProviderOid", "status");

-- CreateIndex
CREATE INDEX "ChatInstanceProvider_status_archivedAt_idx" ON "ChatInstanceProvider"("status", "archivedAt");

-- CreateIndex
CREATE INDEX "ChatInstanceProvider_projectOid_idx" ON "ChatInstanceProvider"("projectOid");

-- CreateIndex
CREATE INDEX "ChatInstanceProvider_instanceOid_idx" ON "ChatInstanceProvider"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "ciip_instance_provider_key" ON "ChatInstanceProvider"("chatInstanceOid", "chatConnectionProviderOid");

-- CreateIndex
CREATE UNIQUE INDEX "ChatMessage_id_key" ON "ChatMessage"("id");

-- CreateIndex
CREATE INDEX "ChatMessage_channelOid_isChildMessage_idx" ON "ChatMessage"("channelOid", "isChildMessage");

-- CreateIndex
CREATE INDEX "ChatMessage_channelOid_deletedAt_idx" ON "ChatMessage"("channelOid", "deletedAt");

-- CreateIndex
CREATE INDEX "ChatMessage_deletedAt_idx" ON "ChatMessage"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChatMessage_channelOid_messageId_key" ON "ChatMessage"("channelOid", "messageId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatMessageGroup_id_key" ON "ChatMessageGroup"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ChatMessageGroup_primaryMessageOid_key" ON "ChatMessageGroup"("primaryMessageOid");

-- CreateIndex
CREATE UNIQUE INDEX "ChatMessageGroup_channelOid_providerGroupKey_key" ON "ChatMessageGroup"("channelOid", "providerGroupKey");

-- CreateIndex
CREATE UNIQUE INDEX "ChatMessageAttachment_id_key" ON "ChatMessageAttachment"("id");

-- CreateIndex
CREATE INDEX "ChatMessageAttachment_messageOid_idx" ON "ChatMessageAttachment"("messageOid");

-- CreateIndex
CREATE UNIQUE INDEX "ChatMessageAttachment_messageOid_attachmentId_key" ON "ChatMessageAttachment"("messageOid", "attachmentId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomProviderCommit_id_key" ON "CustomProviderCommit"("id");

-- CreateIndex
CREATE INDEX "CustomProviderCommit_createdAt_idx" ON "CustomProviderCommit"("createdAt");

-- CreateIndex
CREATE INDEX "CustomProviderCommit_status_idx" ON "CustomProviderCommit"("status");

-- CreateIndex
CREATE INDEX "CustomProviderCommit_trigger_idx" ON "CustomProviderCommit"("trigger");

-- CreateIndex
CREATE INDEX "CustomProviderCommit_type_idx" ON "CustomProviderCommit"("type");

-- CreateIndex
CREATE INDEX "CustomProviderCommit_projectOid_idx" ON "CustomProviderCommit"("projectOid");

-- CreateIndex
CREATE UNIQUE INDEX "CustomProviderDeployment_id_key" ON "CustomProviderDeployment"("id");

-- CreateIndex
CREATE UNIQUE INDEX "CustomProviderDeployment_commitOid_key" ON "CustomProviderDeployment"("commitOid");

-- CreateIndex
CREATE UNIQUE INDEX "CustomProviderDeployment_shuttleServerVersionOid_key" ON "CustomProviderDeployment"("shuttleServerVersionOid");

-- CreateIndex
CREATE UNIQUE INDEX "CustomProviderDeployment_shuttleCustomServerDeploymentOid_key" ON "CustomProviderDeployment"("shuttleCustomServerDeploymentOid");

-- CreateIndex
CREATE INDEX "CustomProviderDeployment_createdAt_idx" ON "CustomProviderDeployment"("createdAt");

-- CreateIndex
CREATE INDEX "CustomProviderDeployment_updatedAt_idx" ON "CustomProviderDeployment"("updatedAt");

-- CreateIndex
CREATE INDEX "CustomProviderDeployment_status_idx" ON "CustomProviderDeployment"("status");

-- CreateIndex
CREATE INDEX "CustomProviderDeployment_trigger_idx" ON "CustomProviderDeployment"("trigger");

-- CreateIndex
CREATE INDEX "CustomProviderDeployment_shuttleCustomServerOid_idx" ON "CustomProviderDeployment"("shuttleCustomServerOid");

-- CreateIndex
CREATE INDEX "CustomProviderDeployment_projectOid_idx" ON "CustomProviderDeployment"("projectOid");

-- CreateIndex
CREATE UNIQUE INDEX "CustomProviderEnvironment_id_key" ON "CustomProviderEnvironment"("id");

-- CreateIndex
CREATE UNIQUE INDEX "CustomProviderEnvironment_providerEnvironmentOid_key" ON "CustomProviderEnvironment"("providerEnvironmentOid");

-- CreateIndex
CREATE INDEX "CustomProviderEnvironment_createdAt_idx" ON "CustomProviderEnvironment"("createdAt");

-- CreateIndex
CREATE INDEX "CustomProviderEnvironment_updatedAt_idx" ON "CustomProviderEnvironment"("updatedAt");

-- CreateIndex
CREATE INDEX "CustomProviderEnvironment_projectOid_idx" ON "CustomProviderEnvironment"("projectOid");

-- CreateIndex
CREATE INDEX "CustomProviderEnvironment_instanceOid_idx" ON "CustomProviderEnvironment"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "CustomProviderEnvironment_environmentOid_customProviderOid_key" ON "CustomProviderEnvironment"("environmentOid", "customProviderOid");

-- CreateIndex
CREATE UNIQUE INDEX "CustomProviderEnvironmentVersion_id_key" ON "CustomProviderEnvironmentVersion"("id");

-- CreateIndex
CREATE INDEX "CustomProviderEnvironmentVersion_instanceOid_idx" ON "CustomProviderEnvironmentVersion"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "CustomProviderEnvironmentVersion_customProviderEnvironmentO_key" ON "CustomProviderEnvironmentVersion"("customProviderEnvironmentOid", "customProviderVersionOid");

-- CreateIndex
CREATE UNIQUE INDEX "CustomProvider_id_key" ON "CustomProvider"("id");

-- CreateIndex
CREATE UNIQUE INDEX "CustomProvider_providerOid_key" ON "CustomProvider"("providerOid");

-- CreateIndex
CREATE UNIQUE INDEX "CustomProvider_providerVariantOid_key" ON "CustomProvider"("providerVariantOid");

-- CreateIndex
CREATE UNIQUE INDEX "CustomProvider_shuttleCustomServerOid_key" ON "CustomProvider"("shuttleCustomServerOid");

-- CreateIndex
CREATE INDEX "CustomProvider_createdAt_idx" ON "CustomProvider"("createdAt");

-- CreateIndex
CREATE INDEX "CustomProvider_updatedAt_idx" ON "CustomProvider"("updatedAt");

-- CreateIndex
CREATE INDEX "CustomProvider_status_idx" ON "CustomProvider"("status");

-- CreateIndex
CREATE INDEX "CustomProvider_type_idx" ON "CustomProvider"("type");

-- CreateIndex
CREATE INDEX "CustomProvider_projectOid_idx" ON "CustomProvider"("projectOid");

-- CreateIndex
CREATE UNIQUE INDEX "UpcomingCustomProvider_id_key" ON "UpcomingCustomProvider"("id");

-- CreateIndex
CREATE INDEX "UpcomingCustomProvider_projectOid_idx" ON "UpcomingCustomProvider"("projectOid");

-- CreateIndex
CREATE INDEX "UpcomingCustomProvider_instanceOid_idx" ON "UpcomingCustomProvider"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "CustomProviderVersion_id_key" ON "CustomProviderVersion"("id");

-- CreateIndex
CREATE UNIQUE INDEX "CustomProviderVersion_providerVersionOid_key" ON "CustomProviderVersion"("providerVersionOid");

-- CreateIndex
CREATE UNIQUE INDEX "CustomProviderVersion_deploymentOid_key" ON "CustomProviderVersion"("deploymentOid");

-- CreateIndex
CREATE UNIQUE INDEX "CustomProviderVersion_shuttleServerVersionOid_key" ON "CustomProviderVersion"("shuttleServerVersionOid");

-- CreateIndex
CREATE UNIQUE INDEX "CustomProviderVersion_shuttleCustomServerDeploymentOid_key" ON "CustomProviderVersion"("shuttleCustomServerDeploymentOid");

-- CreateIndex
CREATE INDEX "CustomProviderVersion_createdAt_idx" ON "CustomProviderVersion"("createdAt");

-- CreateIndex
CREATE INDEX "CustomProviderVersion_updatedAt_idx" ON "CustomProviderVersion"("updatedAt");

-- CreateIndex
CREATE INDEX "CustomProviderVersion_status_idx" ON "CustomProviderVersion"("status");

-- CreateIndex
CREATE INDEX "CustomProviderVersion_shuttleCustomServerOid_idx" ON "CustomProviderVersion"("shuttleCustomServerOid");

-- CreateIndex
CREATE INDEX "CustomProviderVersion_projectOid_idx" ON "CustomProviderVersion"("projectOid");

-- CreateIndex
CREATE UNIQUE INDEX "CustomProviderVersion_customProviderOid_versionIndex_key" ON "CustomProviderVersion"("customProviderOid", "versionIndex");

-- CreateIndex
CREATE UNIQUE INDEX "CustomProviderVersion_customProviderOid_versionIdentifier_key" ON "CustomProviderVersion"("customProviderOid", "versionIdentifier");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderConfig_id_key" ON "ProviderConfig"("id");

-- CreateIndex
CREATE INDEX "ProviderConfig_createdAt_idx" ON "ProviderConfig"("createdAt");

-- CreateIndex
CREATE INDEX "ProviderConfig_updatedAt_idx" ON "ProviderConfig"("updatedAt");

-- CreateIndex
CREATE INDEX "ProviderConfig_isEphemeral_idx" ON "ProviderConfig"("isEphemeral");

-- CreateIndex
CREATE INDEX "ProviderConfig_isDefault_idx" ON "ProviderConfig"("isDefault");

-- CreateIndex
CREATE INDEX "ProviderConfig_status_idx" ON "ProviderConfig"("status");

-- CreateIndex
CREATE INDEX "ProviderConfig_archivedAt_idx" ON "ProviderConfig"("archivedAt");

-- CreateIndex
CREATE INDEX "ProviderConfig_status_archivedAt_idx" ON "ProviderConfig"("status", "archivedAt");

-- CreateIndex
CREATE INDEX "ProviderConfig_projectOid_idx" ON "ProviderConfig"("projectOid");

-- CreateIndex
CREATE INDEX "ProviderConfig_instanceOid_idx" ON "ProviderConfig"("instanceOid");

-- CreateIndex
CREATE INDEX "ProviderConfig_ownerActorOid_idx" ON "ProviderConfig"("ownerActorOid");

-- CreateIndex
CREATE INDEX "ProviderConfig_ownerPublicMcpServerOid_idx" ON "ProviderConfig"("ownerPublicMcpServerOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderConfigVersion_id_key" ON "ProviderConfigVersion"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderConfigUpdate_id_key" ON "ProviderConfigUpdate"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderDeployment_id_key" ON "ProviderDeployment"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderDeployment_defaultConfigOid_key" ON "ProviderDeployment"("defaultConfigOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderDeployment_defaultAuthConfigOid_key" ON "ProviderDeployment"("defaultAuthConfigOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderDeployment_slateInstanceConfigurationOid_key" ON "ProviderDeployment"("slateInstanceConfigurationOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderDeployment_serverInstanceConfigurationOid_key" ON "ProviderDeployment"("serverInstanceConfigurationOid");

-- CreateIndex
CREATE INDEX "ProviderDeployment_createdAt_idx" ON "ProviderDeployment"("createdAt");

-- CreateIndex
CREATE INDEX "ProviderDeployment_updatedAt_idx" ON "ProviderDeployment"("updatedAt");

-- CreateIndex
CREATE INDEX "ProviderDeployment_isEphemeral_idx" ON "ProviderDeployment"("isEphemeral");

-- CreateIndex
CREATE INDEX "ProviderDeployment_isDefault_idx" ON "ProviderDeployment"("isDefault");

-- CreateIndex
CREATE INDEX "ProviderDeployment_status_idx" ON "ProviderDeployment"("status");

-- CreateIndex
CREATE INDEX "ProviderDeployment_archivedAt_idx" ON "ProviderDeployment"("archivedAt");

-- CreateIndex
CREATE INDEX "ProviderDeployment_status_archivedAt_idx" ON "ProviderDeployment"("status", "archivedAt");

-- CreateIndex
CREATE INDEX "ProviderDeployment_isEnclaveReconciled_idx" ON "ProviderDeployment"("isEnclaveReconciled");

-- CreateIndex
CREATE INDEX "ProviderDeployment_isMonitorReconciled_idx" ON "ProviderDeployment"("isMonitorReconciled");

-- CreateIndex
CREATE INDEX "ProviderDeployment_projectOid_idx" ON "ProviderDeployment"("projectOid");

-- CreateIndex
CREATE INDEX "ProviderDeployment_instanceOid_idx" ON "ProviderDeployment"("instanceOid");

-- CreateIndex
CREATE INDEX "ProviderDeployment_providerOid_idx" ON "ProviderDeployment"("providerOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderDeploymentVersion_id_key" ON "ProviderDeploymentVersion"("id");

-- CreateIndex
CREATE UNIQUE INDEX "TenantOAuthCallbackUrl_id_key" ON "TenantOAuthCallbackUrl"("id");

-- CreateIndex
CREATE UNIQUE INDEX "TenantOAuthCallbackUrl_slug_key" ON "TenantOAuthCallbackUrl"("slug");

-- CreateIndex
CREATE INDEX "TenantOAuthCallbackUrl_projectOid_idx" ON "TenantOAuthCallbackUrl"("projectOid");

-- CreateIndex
CREATE UNIQUE INDEX "TenantOAuthCallbackUrl_tenantOid_providerOid_key" ON "TenantOAuthCallbackUrl"("tenantOid", "providerOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderDeploymentConfigPair_id_key" ON "ProviderDeploymentConfigPair"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderDeploymentConfigPair_identifier_key" ON "ProviderDeploymentConfigPair"("identifier");

-- CreateIndex
CREATE INDEX "ProviderDeploymentConfigPair_projectOid_idx" ON "ProviderDeploymentConfigPair"("projectOid");

-- CreateIndex
CREATE INDEX "ProviderDeploymentConfigPair_instanceOid_idx" ON "ProviderDeploymentConfigPair"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderDeploymentConfigPairProviderVersion_id_key" ON "ProviderDeploymentConfigPairProviderVersion"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderDeploymentConfigPairProviderVersion_pairOid_version_key" ON "ProviderDeploymentConfigPairProviderVersion"("pairOid", "versionOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderDeploymentConfigPairSpecificationChange_id_key" ON "ProviderDeploymentConfigPairSpecificationChange"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderDeploymentConfigPairSpecificationChange_fromPairVer_key" ON "ProviderDeploymentConfigPairSpecificationChange"("fromPairVersionOid", "toPairVersionOid", "fromSpecificationOid", "toSpecificationOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderDeploymentConfigPairDiscovery_id_key" ON "ProviderDeploymentConfigPairDiscovery"("id");

-- CreateIndex
CREATE UNIQUE INDEX "EnvironmentProvider_id_key" ON "EnvironmentProvider"("id");

-- CreateIndex
CREATE INDEX "EnvironmentProvider_projectOid_idx" ON "EnvironmentProvider"("projectOid");

-- CreateIndex
CREATE INDEX "EnvironmentProvider_instanceOid_idx" ON "EnvironmentProvider"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "EnvironmentProvider_tenantOid_providerOid_key" ON "EnvironmentProvider"("tenantOid", "providerOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderConfigVault_id_key" ON "ProviderConfigVault"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderConfigVault_configOid_key" ON "ProviderConfigVault"("configOid");

-- CreateIndex
CREATE INDEX "ProviderConfigVault_createdAt_idx" ON "ProviderConfigVault"("createdAt");

-- CreateIndex
CREATE INDEX "ProviderConfigVault_updatedAt_idx" ON "ProviderConfigVault"("updatedAt");

-- CreateIndex
CREATE INDEX "ProviderConfigVault_status_idx" ON "ProviderConfigVault"("status");

-- CreateIndex
CREATE INDEX "ProviderConfigVault_archivedAt_idx" ON "ProviderConfigVault"("archivedAt");

-- CreateIndex
CREATE INDEX "ProviderConfigVault_status_archivedAt_idx" ON "ProviderConfigVault"("status", "archivedAt");

-- CreateIndex
CREATE INDEX "ProviderConfigVault_projectOid_idx" ON "ProviderConfigVault"("projectOid");

-- CreateIndex
CREATE INDEX "ProviderConfigVault_instanceOid_idx" ON "ProviderConfigVault"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "EnclaveEnvironment_id_key" ON "EnclaveEnvironment"("id");

-- CreateIndex
CREATE UNIQUE INDEX "EnclaveEnvironment_systemIdentifier_key" ON "EnclaveEnvironment"("systemIdentifier");

-- CreateIndex
CREATE INDEX "EnclaveEnvironment_projectOid_idx" ON "EnclaveEnvironment"("projectOid");

-- CreateIndex
CREATE UNIQUE INDEX "Enclave_id_key" ON "Enclave"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Enclave_providerDeploymentOid_key" ON "Enclave"("providerDeploymentOid");

-- CreateIndex
CREATE INDEX "Enclave_needsEnclaveReconciliation_idx" ON "Enclave"("needsEnclaveReconciliation");

-- CreateIndex
CREATE INDEX "Enclave_projectOid_idx" ON "Enclave"("projectOid");

-- CreateIndex
CREATE INDEX "Enclave_instanceOid_idx" ON "Enclave"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "Enclave_environmentOid_slug_key" ON "Enclave"("environmentOid", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Network_id_key" ON "Network"("id");

-- CreateIndex
CREATE INDEX "Network_projectOid_idx" ON "Network"("projectOid");

-- CreateIndex
CREATE INDEX "Network_instanceOid_idx" ON "Network"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "Network_tenantOid_environmentOid_key" ON "Network"("tenantOid", "environmentOid");

-- CreateIndex
CREATE UNIQUE INDEX "Firewall_id_key" ON "Firewall"("id");

-- CreateIndex
CREATE INDEX "Firewall_status_idx" ON "Firewall"("status");

-- CreateIndex
CREATE INDEX "Firewall_projectOid_idx" ON "Firewall"("projectOid");

-- CreateIndex
CREATE INDEX "Firewall_instanceOid_idx" ON "Firewall"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "Firewall_tenantOid_environmentOid_slug_key" ON "Firewall"("tenantOid", "environmentOid", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "FirewallBinding_id_key" ON "FirewallBinding"("id");

-- CreateIndex
CREATE INDEX "FirewallBinding_projectOid_idx" ON "FirewallBinding"("projectOid");

-- CreateIndex
CREATE INDEX "FirewallBinding_instanceOid_idx" ON "FirewallBinding"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "FirewallBinding_firewallOid_enclaveOid_key" ON "FirewallBinding"("firewallOid", "enclaveOid");

-- CreateIndex
CREATE UNIQUE INDEX "FirewallBinding_firewallOid_providerOid_key" ON "FirewallBinding"("firewallOid", "providerOid");

-- CreateIndex
CREATE UNIQUE INDEX "FirewallBinding_firewallOid_networkOid_key" ON "FirewallBinding"("firewallOid", "networkOid");

-- CreateIndex
CREATE UNIQUE INDEX "NetworkPolicy_id_key" ON "NetworkPolicy"("id");

-- CreateIndex
CREATE INDEX "NetworkPolicy_status_idx" ON "NetworkPolicy"("status");

-- CreateIndex
CREATE INDEX "NetworkPolicy_projectOid_idx" ON "NetworkPolicy"("projectOid");

-- CreateIndex
CREATE INDEX "NetworkPolicy_instanceOid_idx" ON "NetworkPolicy"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "NetworkPolicyVersion_id_key" ON "NetworkPolicyVersion"("id");

-- CreateIndex
CREATE UNIQUE INDEX "NetworkPolicyVersion_networkPolicyOid_version_key" ON "NetworkPolicyVersion"("networkPolicyOid", "version");

-- CreateIndex
CREATE UNIQUE INDEX "FirewallNetworkPolicy_id_key" ON "FirewallNetworkPolicy"("id");

-- CreateIndex
CREATE UNIQUE INDEX "FirewallNetworkPolicy_firewallOid_networkPolicyOid_key" ON "FirewallNetworkPolicy"("firewallOid", "networkPolicyOid");

-- CreateIndex
CREATE UNIQUE INDEX "EnclaveIngressNetworkLog_id_key" ON "EnclaveIngressNetworkLog"("id");

-- CreateIndex
CREATE INDEX "EnclaveIngressNetworkLog_tenantOid_environmentOid_bucketSta_idx" ON "EnclaveIngressNetworkLog"("tenantOid", "environmentOid", "bucketStart");

-- CreateIndex
CREATE INDEX "EnclaveIngressNetworkLog_enclaveOid_bucketStart_idx" ON "EnclaveIngressNetworkLog"("enclaveOid", "bucketStart");

-- CreateIndex
CREATE INDEX "EnclaveIngressNetworkLog_sourceIp_idx" ON "EnclaveIngressNetworkLog"("sourceIp");

-- CreateIndex
CREATE INDEX "EnclaveIngressNetworkLog_result_idx" ON "EnclaveIngressNetworkLog"("result");

-- CreateIndex
CREATE INDEX "EnclaveIngressNetworkLog_environmentOid_idx" ON "EnclaveIngressNetworkLog"("environmentOid");

-- CreateIndex
CREATE INDEX "EnclaveIngressNetworkLog_projectOid_idx" ON "EnclaveIngressNetworkLog"("projectOid");

-- CreateIndex
CREATE INDEX "EnclaveIngressNetworkLog_instanceOid_idx" ON "EnclaveIngressNetworkLog"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityActor_id_key" ON "IdentityActor"("id");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityActor_defaultForInstanceConsumerOid_key" ON "IdentityActor"("defaultForInstanceConsumerOid");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityActor_defaultIdentityOid_key" ON "IdentityActor"("defaultIdentityOid");

-- CreateIndex
CREATE INDEX "IdentityActor_createdAt_idx" ON "IdentityActor"("createdAt");

-- CreateIndex
CREATE INDEX "IdentityActor_updatedAt_idx" ON "IdentityActor"("updatedAt");

-- CreateIndex
CREATE INDEX "IdentityActor_status_idx" ON "IdentityActor"("status");

-- CreateIndex
CREATE INDEX "IdentityActor_projectOid_idx" ON "IdentityActor"("projectOid");

-- CreateIndex
CREATE INDEX "IdentityActor_instanceOid_idx" ON "IdentityActor"("instanceOid");

-- CreateIndex
CREATE INDEX "IdentityActor_consumerOid_idx" ON "IdentityActor"("consumerOid");

-- CreateIndex
CREATE INDEX "IdentityActor_instanceConsumerOid_idx" ON "IdentityActor"("instanceConsumerOid");

-- CreateIndex
CREATE INDEX "IdentityActor_consumerProfileOid_idx" ON "IdentityActor"("consumerProfileOid");

-- CreateIndex
CREATE UNIQUE INDEX "DelegatedIdentity_id_key" ON "DelegatedIdentity"("id");

-- CreateIndex
CREATE UNIQUE INDEX "DelegatedIdentity_identityOid_actorOid_key" ON "DelegatedIdentity"("identityOid", "actorOid");

-- CreateIndex
CREATE UNIQUE INDEX "DelegatedIdentityCredential_id_key" ON "DelegatedIdentityCredential"("id");

-- CreateIndex
CREATE UNIQUE INDEX "DelegatedIdentityCredential_delegatedIdentityOid_credential_key" ON "DelegatedIdentityCredential"("delegatedIdentityOid", "credentialOid");

-- CreateIndex
CREATE UNIQUE INDEX "DelegatedIdentityUpdate_id_key" ON "DelegatedIdentityUpdate"("id");

-- CreateIndex
CREATE UNIQUE INDEX "DelegatedIdentityCredentialUpdate_id_key" ON "DelegatedIdentityCredentialUpdate"("id");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityDelegation_id_key" ON "IdentityDelegation"("id");

-- CreateIndex
CREATE INDEX "IdentityDelegation_createdAt_idx" ON "IdentityDelegation"("createdAt");

-- CreateIndex
CREATE INDEX "IdentityDelegation_status_idx" ON "IdentityDelegation"("status");

-- CreateIndex
CREATE INDEX "IdentityDelegation_expiresAt_idx" ON "IdentityDelegation"("expiresAt");

-- CreateIndex
CREATE INDEX "IdentityDelegation_projectOid_idx" ON "IdentityDelegation"("projectOid");

-- CreateIndex
CREATE INDEX "IdentityDelegation_instanceOid_idx" ON "IdentityDelegation"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityDelegationCredentialOverride_id_key" ON "IdentityDelegationCredentialOverride"("id");

-- CreateIndex
CREATE INDEX "IdentityDelegationCredentialOverride_expiresAt_idx" ON "IdentityDelegationCredentialOverride"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityDelegationParty_id_key" ON "IdentityDelegationParty"("id");

-- CreateIndex
CREATE INDEX "IdentityDelegationParty_roles_idx" ON "IdentityDelegationParty"("roles");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityDelegationAttestation_id_key" ON "IdentityDelegationAttestation"("id");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityDelegationConfig_id_key" ON "IdentityDelegationConfig"("id");

-- CreateIndex
CREATE INDEX "IdentityDelegationConfig_createdAt_idx" ON "IdentityDelegationConfig"("createdAt");

-- CreateIndex
CREATE INDEX "IdentityDelegationConfig_updatedAt_idx" ON "IdentityDelegationConfig"("updatedAt");

-- CreateIndex
CREATE INDEX "IdentityDelegationConfig_status_idx" ON "IdentityDelegationConfig"("status");

-- CreateIndex
CREATE INDEX "IdentityDelegationConfig_projectOid_idx" ON "IdentityDelegationConfig"("projectOid");

-- CreateIndex
CREATE INDEX "IdentityDelegationConfig_instanceOid_idx" ON "IdentityDelegationConfig"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityDelegationConfigVersion_id_key" ON "IdentityDelegationConfigVersion"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Identity_id_key" ON "Identity"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Identity_ownedByIntegrationInstanceOid_key" ON "Identity"("ownedByIntegrationInstanceOid");

-- CreateIndex
CREATE INDEX "Identity_createdAt_idx" ON "Identity"("createdAt");

-- CreateIndex
CREATE INDEX "Identity_updatedAt_idx" ON "Identity"("updatedAt");

-- CreateIndex
CREATE INDEX "Identity_status_idx" ON "Identity"("status");

-- CreateIndex
CREATE INDEX "Identity_projectOid_idx" ON "Identity"("projectOid");

-- CreateIndex
CREATE INDEX "Identity_instanceOid_idx" ON "Identity"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityCredential_id_key" ON "IdentityCredential"("id");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityCredential_integrationInstanceProviderOid_key" ON "IdentityCredential"("integrationInstanceProviderOid");

-- CreateIndex
CREATE INDEX "IdentityCredential_createdAt_idx" ON "IdentityCredential"("createdAt");

-- CreateIndex
CREATE INDEX "IdentityCredential_updatedAt_idx" ON "IdentityCredential"("updatedAt");

-- CreateIndex
CREATE INDEX "IdentityCredential_status_idx" ON "IdentityCredential"("status");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityDelegationRequest_id_key" ON "IdentityDelegationRequest"("id");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityDelegationRequest_delegationOid_key" ON "IdentityDelegationRequest"("delegationOid");

-- CreateIndex
CREATE INDEX "IdentityDelegationRequest_createdAt_idx" ON "IdentityDelegationRequest"("createdAt");

-- CreateIndex
CREATE INDEX "IdentityDelegationRequest_status_idx" ON "IdentityDelegationRequest"("status");

-- CreateIndex
CREATE INDEX "IdentityDelegationRequest_projectOid_idx" ON "IdentityDelegationRequest"("projectOid");

-- CreateIndex
CREATE INDEX "IdentityDelegationRequest_instanceOid_idx" ON "IdentityDelegationRequest"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "MagicMcpServerBacking_id_key" ON "MagicMcpServerBacking"("id");

-- CreateIndex
CREATE UNIQUE INDEX "MagicMcpServerBacking_integrationOid_key" ON "MagicMcpServerBacking"("integrationOid");

-- CreateIndex
CREATE INDEX "MagicMcpServerBacking_integrationInstanceOid_ownerType_idx" ON "MagicMcpServerBacking"("integrationInstanceOid", "ownerType");

-- CreateIndex
CREATE INDEX "MagicMcpServerBacking_ownerIntegrationOid_idx" ON "MagicMcpServerBacking"("ownerIntegrationOid");

-- CreateIndex
CREATE UNIQUE INDEX "MagicMcpServerProvider_id_key" ON "MagicMcpServerProvider"("id");

-- CreateIndex
CREATE INDEX "MagicMcpServerProvider_status_idx" ON "MagicMcpServerProvider"("status");

-- CreateIndex
CREATE INDEX "MagicMcpServerProvider_magicMcpServerBackingOid_status_idx" ON "MagicMcpServerProvider"("magicMcpServerBackingOid", "status");

-- CreateIndex
CREATE INDEX "MagicMcpServerProvider_integrationProviderOid_status_idx" ON "MagicMcpServerProvider"("integrationProviderOid", "status");

-- CreateIndex
CREATE INDEX "MagicMcpServerProvider_integrationInstanceProviderOid_idx" ON "MagicMcpServerProvider"("integrationInstanceProviderOid");

-- CreateIndex
CREATE UNIQUE INDEX "MagicMcpServerProvider_magicMcpServerBackingOid_integration_key" ON "MagicMcpServerProvider"("magicMcpServerBackingOid", "integrationProviderOid");

-- CreateIndex
CREATE UNIQUE INDEX "MagicMcpEndpointBacking_id_key" ON "MagicMcpEndpointBacking"("id");

-- CreateIndex
CREATE UNIQUE INDEX "MagicMcpEndpointBacking_integrationGroupOid_key" ON "MagicMcpEndpointBacking"("integrationGroupOid");

-- CreateIndex
CREATE UNIQUE INDEX "MagicMcpEndpointServerBacking_id_key" ON "MagicMcpEndpointServerBacking"("id");

-- CreateIndex
CREATE INDEX "MagicMcpEndpointServerBacking_magicMcpEndpointBackingOid_idx" ON "MagicMcpEndpointServerBacking"("magicMcpEndpointBackingOid");

-- CreateIndex
CREATE INDEX "MagicMcpEndpointServerBacking_magicMcpServerBackingOid_idx" ON "MagicMcpEndpointServerBacking"("magicMcpServerBackingOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderTemplateBacking_id_key" ON "ProviderTemplateBacking"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderTemplateBacking_integrationOid_key" ON "ProviderTemplateBacking"("integrationOid");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationInstance_id_key" ON "IntegrationInstance"("id");

-- CreateIndex
CREATE INDEX "IntegrationInstance_tenantOid_solutionOid_environmentOid_st_idx" ON "IntegrationInstance"("tenantOid", "solutionOid", "environmentOid", "status", "isHiddenDraft");

-- CreateIndex
CREATE INDEX "IntegrationInstance_integrationOid_status_idx" ON "IntegrationInstance"("integrationOid", "status");

-- CreateIndex
CREATE INDEX "IntegrationInstance_status_isHiddenDraft_archivedAt_idx" ON "IntegrationInstance"("status", "isHiddenDraft", "archivedAt");

-- CreateIndex
CREATE INDEX "IntegrationInstance_ownerActorOid_idx" ON "IntegrationInstance"("ownerActorOid");

-- CreateIndex
CREATE INDEX "IntegrationInstance_projectOid_idx" ON "IntegrationInstance"("projectOid");

-- CreateIndex
CREATE INDEX "IntegrationInstance_instanceOid_idx" ON "IntegrationInstance"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationInstanceProvider_id_key" ON "IntegrationInstanceProvider"("id");

-- CreateIndex
CREATE INDEX "IntegrationInstanceProvider_tenantOid_solutionOid_environme_idx" ON "IntegrationInstanceProvider"("tenantOid", "solutionOid", "environmentOid", "status");

-- CreateIndex
CREATE INDEX "IntegrationInstanceProvider_integrationInstanceOid_status_idx" ON "IntegrationInstanceProvider"("integrationInstanceOid", "status");

-- CreateIndex
CREATE INDEX "IntegrationInstanceProvider_integrationProviderOid_status_idx" ON "IntegrationInstanceProvider"("integrationProviderOid", "status");

-- CreateIndex
CREATE INDEX "IntegrationInstanceProvider_projectOid_idx" ON "IntegrationInstanceProvider"("projectOid");

-- CreateIndex
CREATE INDEX "IntegrationInstanceProvider_instanceOid_idx" ON "IntegrationInstanceProvider"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationInstanceProvider_integrationInstanceOid_integrat_key" ON "IntegrationInstanceProvider"("integrationInstanceOid", "integrationProviderOid");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationInstanceProviderVersion_id_key" ON "IntegrationInstanceProviderVersion"("id");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationInstanceGroup_id_key" ON "IntegrationInstanceGroup"("id");

-- CreateIndex
CREATE INDEX "IntegrationInstanceGroup_tenantOid_solutionOid_environmentO_idx" ON "IntegrationInstanceGroup"("tenantOid", "solutionOid", "environmentOid", "status");

-- CreateIndex
CREATE INDEX "IntegrationInstanceGroup_createdAt_idx" ON "IntegrationInstanceGroup"("createdAt");

-- CreateIndex
CREATE INDEX "IntegrationInstanceGroup_updatedAt_idx" ON "IntegrationInstanceGroup"("updatedAt");

-- CreateIndex
CREATE INDEX "IntegrationInstanceGroup_status_idx" ON "IntegrationInstanceGroup"("status");

-- CreateIndex
CREATE INDEX "IntegrationInstanceGroup_archivedAt_idx" ON "IntegrationInstanceGroup"("archivedAt");

-- CreateIndex
CREATE INDEX "IntegrationInstanceGroup_status_archivedAt_idx" ON "IntegrationInstanceGroup"("status", "archivedAt");

-- CreateIndex
CREATE INDEX "IntegrationInstanceGroup_identityActorOid_idx" ON "IntegrationInstanceGroup"("identityActorOid");

-- CreateIndex
CREATE INDEX "IntegrationInstanceGroup_identityOid_idx" ON "IntegrationInstanceGroup"("identityOid");

-- CreateIndex
CREATE INDEX "IntegrationInstanceGroup_ownerActorOid_idx" ON "IntegrationInstanceGroup"("ownerActorOid");

-- CreateIndex
CREATE INDEX "IntegrationInstanceGroup_projectOid_idx" ON "IntegrationInstanceGroup"("projectOid");

-- CreateIndex
CREATE INDEX "IntegrationInstanceGroup_instanceOid_idx" ON "IntegrationInstanceGroup"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationInstanceGroupSource_id_key" ON "IntegrationInstanceGroupSource"("id");

-- CreateIndex
CREATE INDEX "IntegrationInstanceGroupSource_tenantOid_solutionOid_enviro_idx" ON "IntegrationInstanceGroupSource"("tenantOid", "solutionOid", "environmentOid", "status");

-- CreateIndex
CREATE INDEX "IntegrationInstanceGroupSource_integrationInstanceGroupOid__idx" ON "IntegrationInstanceGroupSource"("integrationInstanceGroupOid", "status");

-- CreateIndex
CREATE INDEX "IntegrationInstanceGroupSource_integrationInstanceOid_statu_idx" ON "IntegrationInstanceGroupSource"("integrationInstanceOid", "status");

-- CreateIndex
CREATE INDEX "IntegrationInstanceGroupSource_status_archivedAt_idx" ON "IntegrationInstanceGroupSource"("status", "archivedAt");

-- CreateIndex
CREATE INDEX "IntegrationInstanceGroupSource_projectOid_idx" ON "IntegrationInstanceGroupSource"("projectOid");

-- CreateIndex
CREATE INDEX "IntegrationInstanceGroupSource_instanceOid_idx" ON "IntegrationInstanceGroupSource"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationInstanceGroupSource_integrationInstanceGroupOid__key" ON "IntegrationInstanceGroupSource"("integrationInstanceGroupOid", "integrationInstanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationInstanceGroupProvider_id_key" ON "IntegrationInstanceGroupProvider"("id");

-- CreateIndex
CREATE INDEX "IntegrationInstanceGroupProvider_tenantOid_solutionOid_envi_idx" ON "IntegrationInstanceGroupProvider"("tenantOid", "solutionOid", "environmentOid", "status");

-- CreateIndex
CREATE INDEX "dii_provider_dii_status_idx" ON "IntegrationInstanceGroupProvider"("integrationInstanceGroupOid", "status");

-- CreateIndex
CREATE INDEX "dii_provider_source_status_idx" ON "IntegrationInstanceGroupProvider"("integrationInstanceGroupSourceOid", "status");

-- CreateIndex
CREATE INDEX "IntegrationInstanceGroupProvider_integrationInstanceOid_sta_idx" ON "IntegrationInstanceGroupProvider"("integrationInstanceOid", "status");

-- CreateIndex
CREATE INDEX "IntegrationInstanceGroupProvider_integrationInstanceProvide_idx" ON "IntegrationInstanceGroupProvider"("integrationInstanceProviderOid", "status");

-- CreateIndex
CREATE INDEX "IntegrationInstanceGroupProvider_integrationProviderOid_sta_idx" ON "IntegrationInstanceGroupProvider"("integrationProviderOid", "status");

-- CreateIndex
CREATE INDEX "IntegrationInstanceGroupProvider_status_archivedAt_idx" ON "IntegrationInstanceGroupProvider"("status", "archivedAt");

-- CreateIndex
CREATE INDEX "IntegrationInstanceGroupProvider_projectOid_idx" ON "IntegrationInstanceGroupProvider"("projectOid");

-- CreateIndex
CREATE INDEX "IntegrationInstanceGroupProvider_instanceOid_idx" ON "IntegrationInstanceGroupProvider"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "dii_provider_integration_provider_key" ON "IntegrationInstanceGroupProvider"("integrationInstanceGroupOid", "integrationProviderOid");

-- CreateIndex
CREATE UNIQUE INDEX "dii_provider_source_provider_key" ON "IntegrationInstanceGroupProvider"("integrationInstanceGroupOid", "integrationInstanceProviderOid");

-- CreateIndex
CREATE UNIQUE INDEX "Integration_id_key" ON "Integration"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Integration_slug_key" ON "Integration"("slug");

-- CreateIndex
CREATE INDEX "Integration_createdAt_idx" ON "Integration"("createdAt");

-- CreateIndex
CREATE INDEX "Integration_updatedAt_idx" ON "Integration"("updatedAt");

-- CreateIndex
CREATE INDEX "Integration_status_idx" ON "Integration"("status");

-- CreateIndex
CREATE INDEX "Integration_status_archivedAt_idx" ON "Integration"("status", "archivedAt");

-- CreateIndex
CREATE INDEX "Integration_projectOid_idx" ON "Integration"("projectOid");

-- CreateIndex
CREATE INDEX "Integration_instanceOid_idx" ON "Integration"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationProvider_id_key" ON "IntegrationProvider"("id");

-- CreateIndex
CREATE INDEX "IntegrationProvider_createdAt_idx" ON "IntegrationProvider"("createdAt");

-- CreateIndex
CREATE INDEX "IntegrationProvider_updatedAt_idx" ON "IntegrationProvider"("updatedAt");

-- CreateIndex
CREATE INDEX "IntegrationProvider_status_idx" ON "IntegrationProvider"("status");

-- CreateIndex
CREATE INDEX "IntegrationProvider_projectOid_idx" ON "IntegrationProvider"("projectOid");

-- CreateIndex
CREATE INDEX "IntegrationProvider_instanceOid_idx" ON "IntegrationProvider"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationProvider_integrationOid_providerOid_key" ON "IntegrationProvider"("integrationOid", "providerOid");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationProviderVersion_id_key" ON "IntegrationProviderVersion"("id");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationVersion_id_key" ON "IntegrationVersion"("id");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationVersionProvider_id_key" ON "IntegrationVersionProvider"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderListingCollection_id_key" ON "ProviderListingCollection"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderListingCollection_slug_key" ON "ProviderListingCollection"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderListingCategory_id_key" ON "ProviderListingCategory"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderListingCategory_slug_key" ON "ProviderListingCategory"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderListingGroup_id_key" ON "ProviderListingGroup"("id");

-- CreateIndex
CREATE INDEX "ProviderListingGroup_createdAt_idx" ON "ProviderListingGroup"("createdAt");

-- CreateIndex
CREATE INDEX "ProviderListingGroup_updatedAt_idx" ON "ProviderListingGroup"("updatedAt");

-- CreateIndex
CREATE INDEX "ProviderListingGroup_projectOid_idx" ON "ProviderListingGroup"("projectOid");

-- CreateIndex
CREATE INDEX "ProviderListingGroup_instanceOid_idx" ON "ProviderListingGroup"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderListingGroup_tenantOid_slug_key" ON "ProviderListingGroup"("tenantOid", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderListing_id_key" ON "ProviderListing"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderListing_slug_key" ON "ProviderListing"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderListing_prettySlug_key" ON "ProviderListing"("prettySlug");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderListing_providerOid_key" ON "ProviderListing"("providerOid");

-- CreateIndex
CREATE INDEX "ProviderListing_createdAt_idx" ON "ProviderListing"("createdAt");

-- CreateIndex
CREATE INDEX "ProviderListing_updatedAt_idx" ON "ProviderListing"("updatedAt");

-- CreateIndex
CREATE INDEX "ProviderListing_isPublic_idx" ON "ProviderListing"("isPublic");

-- CreateIndex
CREATE INDEX "ProviderListing_rank_idx" ON "ProviderListing"("rank");

-- CreateIndex
CREATE INDEX "ProviderListing_status_idx" ON "ProviderListing"("status");

-- CreateIndex
CREATE INDEX "ProviderListing_isDeprecated_idx" ON "ProviderListing"("isDeprecated");

-- CreateIndex
CREATE INDEX "ProviderListing_aliases_idx" ON "ProviderListing" USING GIN ("aliases");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderListingUpdate_id_key" ON "ProviderListingUpdate"("id");

-- CreateIndex
CREATE UNIQUE INDEX "MonitorAlert_id_key" ON "MonitorAlert"("id");

-- CreateIndex
CREATE INDEX "MonitorAlert_status_idx" ON "MonitorAlert"("status");

-- CreateIndex
CREATE INDEX "MonitorAlert_tenantOid_createdAt_idx" ON "MonitorAlert"("tenantOid", "createdAt");

-- CreateIndex
CREATE INDEX "MonitorAlert_createdAt_idx" ON "MonitorAlert"("createdAt");

-- CreateIndex
CREATE INDEX "MonitorAlert_resolvedAt_idx" ON "MonitorAlert"("resolvedAt");

-- CreateIndex
CREATE INDEX "MonitorAlert_projectOid_idx" ON "MonitorAlert"("projectOid");

-- CreateIndex
CREATE INDEX "MonitorAlert_instanceOid_idx" ON "MonitorAlert"("instanceOid");

-- CreateIndex
CREATE INDEX "MonitorAlert_protoGuardAlertOid_idx" ON "MonitorAlert"("protoGuardAlertOid");

-- CreateIndex
CREATE UNIQUE INDEX "MonitorAlert_monitorOid_protoGuardAlertOid_key" ON "MonitorAlert"("monitorOid", "protoGuardAlertOid");

-- CreateIndex
CREATE UNIQUE INDEX "MonitorAlert_monitorOid_specificationChangeNotificationOid_key" ON "MonitorAlert"("monitorOid", "specificationChangeNotificationOid");

-- CreateIndex
CREATE UNIQUE INDEX "MonitorAlertEvent_id_key" ON "MonitorAlertEvent"("id");

-- CreateIndex
CREATE INDEX "MonitorAlertEvent_type_idx" ON "MonitorAlertEvent"("type");

-- CreateIndex
CREATE INDEX "MonitorAlertEvent_createdAt_idx" ON "MonitorAlertEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MonitorAlertRecipient_id_key" ON "MonitorAlertRecipient"("id");

-- CreateIndex
CREATE UNIQUE INDEX "MonitorAlertRecipient_monitorAlertOid_recipientOid_key" ON "MonitorAlertRecipient"("monitorAlertOid", "recipientOid");

-- CreateIndex
CREATE UNIQUE INDEX "Monitor_id_key" ON "Monitor"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Monitor_key_key" ON "Monitor"("key");

-- CreateIndex
CREATE INDEX "Monitor_target_idx" ON "Monitor"("target");

-- CreateIndex
CREATE INDEX "Monitor_status_idx" ON "Monitor"("status");

-- CreateIndex
CREATE INDEX "Monitor_owner_idx" ON "Monitor"("owner");

-- CreateIndex
CREATE INDEX "Monitor_tenantOid_environmentOid_solutionOid_idx" ON "Monitor"("tenantOid", "environmentOid", "solutionOid");

-- CreateIndex
CREATE INDEX "Monitor_protoGuardFilterOid_idx" ON "Monitor"("protoGuardFilterOid");

-- CreateIndex
CREATE INDEX "Monitor_providerOid_idx" ON "Monitor"("providerOid");

-- CreateIndex
CREATE INDEX "Monitor_projectOid_idx" ON "Monitor"("projectOid");

-- CreateIndex
CREATE INDEX "Monitor_instanceOid_idx" ON "Monitor"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderAdapterGlobal_id_key" ON "ProviderAdapterGlobal"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderAdapterGlobal_identifier_key" ON "ProviderAdapterGlobal"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderAdapter_id_key" ON "ProviderAdapter"("id");

-- CreateIndex
CREATE INDEX "ProviderAdapter_identifier_idx" ON "ProviderAdapter"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderAdapter_providerOid_identifier_key" ON "ProviderAdapter"("providerOid", "identifier");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderAdapter_providerOid_globalOid_key" ON "ProviderAdapter"("providerOid", "globalOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderAdapterCapability_id_key" ON "ProviderAdapterCapability"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderAdapterCapability_adapterOid_identifier_key" ON "ProviderAdapterCapability"("adapterOid", "identifier");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderVersionAdapter_id_key" ON "ProviderVersionAdapter"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderVersionAdapter_providerVersionOid_adapterOid_key" ON "ProviderVersionAdapter"("providerVersionOid", "adapterOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderVersionAdapterCapability_id_key" ON "ProviderVersionAdapterCapability"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderVersionAdapterCapability_providerVersionAdapterOid__key" ON "ProviderVersionAdapterCapability"("providerVersionAdapterOid", "adapterCapabilityOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderEnvironment_id_key" ON "ProviderEnvironment"("id");

-- CreateIndex
CREATE INDEX "ProviderEnvironment_projectOid_idx" ON "ProviderEnvironment"("projectOid");

-- CreateIndex
CREATE INDEX "ProviderEnvironment_instanceOid_idx" ON "ProviderEnvironment"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderEnvironment_environmentOid_providerOid_key" ON "ProviderEnvironment"("environmentOid", "providerOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderEnvironmentVersion_id_key" ON "ProviderEnvironmentVersion"("id");

-- CreateIndex
CREATE INDEX "ProviderEnvironmentVersion_instanceOid_idx" ON "ProviderEnvironmentVersion"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderEnvironmentVersion_providerEnvironmentOid_providerV_key" ON "ProviderEnvironmentVersion"("providerEnvironmentOid", "providerVersionOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderEntry_id_key" ON "ProviderEntry"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderEntry_identifier_key" ON "ProviderEntry"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "Provider_id_key" ON "Provider"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Provider_identifier_key" ON "Provider"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "Provider_slug_key" ON "Provider"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Provider_globalIdentifier_key" ON "Provider"("globalIdentifier");

-- CreateIndex
CREATE UNIQUE INDEX "Provider_prettySlug_key" ON "Provider"("prettySlug");

-- CreateIndex
CREATE UNIQUE INDEX "Provider_tag_key" ON "Provider"("tag");

-- CreateIndex
CREATE UNIQUE INDEX "Provider_entryOid_key" ON "Provider"("entryOid");

-- CreateIndex
CREATE INDEX "Provider_status_idx" ON "Provider"("status");

-- CreateIndex
CREATE INDEX "Provider_access_idx" ON "Provider"("access");

-- CreateIndex
CREATE INDEX "Provider_isDeprecated_idx" ON "Provider"("isDeprecated");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderToolGlobal_id_key" ON "ProviderToolGlobal"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderToolGlobal_providerOid_key_key" ON "ProviderToolGlobal"("providerOid", "key");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderTool_id_key" ON "ProviderTool"("id");

-- CreateIndex
CREATE INDEX "ProviderTool_specificationOid_adapterOid_idx" ON "ProviderTool"("specificationOid", "adapterOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderTool_providerOid_specificationOid_hash_key" ON "ProviderTool"("providerOid", "specificationOid", "hash");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderTool_specificationOid_key_key" ON "ProviderTool"("specificationOid", "key");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderAuthMethodGlobal_id_key" ON "ProviderAuthMethodGlobal"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderAuthMethodGlobal_providerOid_key_key" ON "ProviderAuthMethodGlobal"("providerOid", "key");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderAuthMethod_id_key" ON "ProviderAuthMethod"("id");

-- CreateIndex
CREATE INDEX "ProviderAuthMethod_isDefault_idx" ON "ProviderAuthMethod"("isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderAuthMethod_providerOid_specificationOid_hash_key" ON "ProviderAuthMethod"("providerOid", "specificationOid", "hash");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderAuthMethod_specificationOid_key_key" ON "ProviderAuthMethod"("specificationOid", "key");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderSpecification_id_key" ON "ProviderSpecification"("id");

-- CreateIndex
CREATE INDEX "ProviderSpecification_createdAt_idx" ON "ProviderSpecification"("createdAt");

-- CreateIndex
CREATE INDEX "ProviderSpecification_updatedAt_idx" ON "ProviderSpecification"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderSpecification_providerOid_hash_key" ON "ProviderSpecification"("providerOid", "hash");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderTriggerGlobal_id_key" ON "ProviderTriggerGlobal"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderTriggerGlobal_providerOid_key_key" ON "ProviderTriggerGlobal"("providerOid", "key");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderTriggerGroupGlobal_id_key" ON "ProviderTriggerGroupGlobal"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderTriggerGroupGlobal_providerOid_key_key" ON "ProviderTriggerGroupGlobal"("providerOid", "key");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderTriggerGroup_id_key" ON "ProviderTriggerGroup"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderTriggerGroup_providerOid_specificationOid_hash_key" ON "ProviderTriggerGroup"("providerOid", "specificationOid", "hash");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderTriggerGroup_specificationOid_key_key" ON "ProviderTriggerGroup"("specificationOid", "key");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderTrigger_id_key" ON "ProviderTrigger"("id");

-- CreateIndex
CREATE INDEX "ProviderTrigger_specificationOid_adapterOid_idx" ON "ProviderTrigger"("specificationOid", "adapterOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderTrigger_providerOid_specificationOid_hash_key" ON "ProviderTrigger"("providerOid", "specificationOid", "hash");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderTrigger_specificationOid_key_key" ON "ProviderTrigger"("specificationOid", "key");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderVersionSpecificationChange_id_key" ON "ProviderVersionSpecificationChange"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderVersionSpecificationChange_fromVersionOid_toVersion_key" ON "ProviderVersionSpecificationChange"("fromVersionOid", "toVersionOid", "fromSpecificationOid", "toSpecificationOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderSpecificationChangeNotification_id_key" ON "ProviderSpecificationChangeNotification"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderSpecificationChangeNotification_versionSpecificatio_key" ON "ProviderSpecificationChangeNotification"("versionSpecificationChangeOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderSpecificationChangeNotification_pairSpecificationCh_key" ON "ProviderSpecificationChangeNotification"("pairSpecificationChangeOid");

-- CreateIndex
CREATE INDEX "ProviderSpecificationChangeNotification_target_idx" ON "ProviderSpecificationChangeNotification"("target");

-- CreateIndex
CREATE INDEX "ProviderSpecificationChangeNotification_createdAt_idx" ON "ProviderSpecificationChangeNotification"("createdAt");

-- CreateIndex
CREATE INDEX "ProviderSpecificationChangeNotification_projectOid_idx" ON "ProviderSpecificationChangeNotification"("projectOid");

-- CreateIndex
CREATE INDEX "ProviderSpecificationChangeNotification_instanceOid_idx" ON "ProviderSpecificationChangeNotification"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderTag_id_key" ON "ProviderTag"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderTag_tag_key" ON "ProviderTag"("tag");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderType_id_key" ON "ProviderType"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderType_shortKey_key" ON "ProviderType"("shortKey");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderType_identifier_key" ON "ProviderType"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderUse_id_key" ON "ProviderUse"("id");

-- CreateIndex
CREATE INDEX "ProviderUse_projectOid_idx" ON "ProviderUse"("projectOid");

-- CreateIndex
CREATE INDEX "ProviderUse_instanceOid_idx" ON "ProviderUse"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderUse_tenantOid_solutionOid_environmentOid_providerOi_key" ON "ProviderUse"("tenantOid", "solutionOid", "environmentOid", "providerOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderVariant_id_key" ON "ProviderVariant"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderVariant_tag_key" ON "ProviderVariant"("tag");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderVariant_identifier_key" ON "ProviderVariant"("identifier");

-- CreateIndex
CREATE INDEX "ProviderVariant_isDefault_idx" ON "ProviderVariant"("isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderVersion_id_key" ON "ProviderVersion"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderVersion_tag_key" ON "ProviderVersion"("tag");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderVersion_identifier_key" ON "ProviderVersion"("identifier");

-- CreateIndex
CREATE INDEX "ProviderVersion_createdAt_idx" ON "ProviderVersion"("createdAt");

-- CreateIndex
CREATE INDEX "ProviderVersion_updatedAt_idx" ON "ProviderVersion"("updatedAt");

-- CreateIndex
CREATE INDEX "ProviderVersion_isCurrent_idx" ON "ProviderVersion"("isCurrent");

-- CreateIndex
CREATE INDEX "ProviderVersion_providerVariantOid_idx" ON "ProviderVersion"("providerVariantOid");

-- CreateIndex
CREATE UNIQUE INDEX "PublicMcpServerAuthorization_id_key" ON "PublicMcpServerAuthorization"("id");

-- CreateIndex
CREATE UNIQUE INDEX "PublicMcpServerAuthorization_authorizationCodeHash_key" ON "PublicMcpServerAuthorization"("authorizationCodeHash");

-- CreateIndex
CREATE UNIQUE INDEX "PublicMcpServerAuthorization_setupSessionOid_key" ON "PublicMcpServerAuthorization"("setupSessionOid");

-- CreateIndex
CREATE INDEX "PublicMcpServerAuthorization_status_expiresAt_idx" ON "PublicMcpServerAuthorization"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "PublicMcpServerAuthorization_publicMcpServerOid_createdAt_idx" ON "PublicMcpServerAuthorization"("publicMcpServerOid", "createdAt");

-- CreateIndex
CREATE INDEX "PublicMcpServerAuthorization_clientOid_idx" ON "PublicMcpServerAuthorization"("clientOid");

-- CreateIndex
CREATE INDEX "PublicMcpServerAuthorization_ip_createdAt_idx" ON "PublicMcpServerAuthorization"("ip", "createdAt");

-- CreateIndex
CREATE INDEX "PublicMcpServerAuthorization_projectOid_idx" ON "PublicMcpServerAuthorization"("projectOid");

-- CreateIndex
CREATE INDEX "PublicMcpServerAuthorization_instanceOid_idx" ON "PublicMcpServerAuthorization"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "PublicMcpServerClient_id_key" ON "PublicMcpServerClient"("id");

-- CreateIndex
CREATE UNIQUE INDEX "PublicMcpServerClient_clientId_key" ON "PublicMcpServerClient"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "PublicMcpServerClient_registrationAccessTokenHash_key" ON "PublicMcpServerClient"("registrationAccessTokenHash");

-- CreateIndex
CREATE INDEX "PublicMcpServerClient_publicMcpServerOid_createdAt_idx" ON "PublicMcpServerClient"("publicMcpServerOid", "createdAt");

-- CreateIndex
CREATE INDEX "PublicMcpServerClient_registrationIp_createdAt_idx" ON "PublicMcpServerClient"("registrationIp", "createdAt");

-- CreateIndex
CREATE INDEX "PublicMcpServerClient_expiresAt_idx" ON "PublicMcpServerClient"("expiresAt");

-- CreateIndex
CREATE INDEX "PublicMcpServerClient_projectOid_idx" ON "PublicMcpServerClient"("projectOid");

-- CreateIndex
CREATE INDEX "PublicMcpServerClient_instanceOid_idx" ON "PublicMcpServerClient"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "PublicMcpServerGrant_id_key" ON "PublicMcpServerGrant"("id");

-- CreateIndex
CREATE UNIQUE INDEX "PublicMcpServerGrant_authorizationOid_key" ON "PublicMcpServerGrant"("authorizationOid");

-- CreateIndex
CREATE UNIQUE INDEX "PublicMcpServerGrant_currentSessionOid_key" ON "PublicMcpServerGrant"("currentSessionOid");

-- CreateIndex
CREATE INDEX "PublicMcpServerGrant_publicMcpServerOid_status_idx" ON "PublicMcpServerGrant"("publicMcpServerOid", "status");

-- CreateIndex
CREATE INDEX "PublicMcpServerGrant_status_expiresAt_idx" ON "PublicMcpServerGrant"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "PublicMcpServerGrant_status_isCleanedUp_idx" ON "PublicMcpServerGrant"("status", "isCleanedUp");

-- CreateIndex
CREATE INDEX "PublicMcpServerGrant_clientOid_idx" ON "PublicMcpServerGrant"("clientOid");

-- CreateIndex
CREATE INDEX "PublicMcpServerGrant_tenantOid_environmentOid_createdAt_idx" ON "PublicMcpServerGrant"("tenantOid", "environmentOid", "createdAt");

-- CreateIndex
CREATE INDEX "PublicMcpServerGrant_projectOid_idx" ON "PublicMcpServerGrant"("projectOid");

-- CreateIndex
CREATE INDEX "PublicMcpServerGrant_instanceOid_idx" ON "PublicMcpServerGrant"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "PublicMcpServerGrantUse_id_key" ON "PublicMcpServerGrantUse"("id");

-- CreateIndex
CREATE INDEX "PublicMcpServerGrantUse_hourBucket_idx" ON "PublicMcpServerGrantUse"("hourBucket");

-- CreateIndex
CREATE INDEX "PublicMcpServerGrantUse_projectOid_idx" ON "PublicMcpServerGrantUse"("projectOid");

-- CreateIndex
CREATE INDEX "PublicMcpServerGrantUse_instanceOid_idx" ON "PublicMcpServerGrantUse"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "PublicMcpServerGrantUse_grantOid_hourBucket_ip_key" ON "PublicMcpServerGrantUse"("grantOid", "hourBucket", "ip");

-- CreateIndex
CREATE UNIQUE INDEX "PublicMcpServer_id_key" ON "PublicMcpServer"("id");

-- CreateIndex
CREATE UNIQUE INDEX "PublicMcpServer_slug_key" ON "PublicMcpServer"("slug");

-- CreateIndex
CREATE INDEX "PublicMcpServer_status_idx" ON "PublicMcpServer"("status");

-- CreateIndex
CREATE INDEX "PublicMcpServer_createdAt_idx" ON "PublicMcpServer"("createdAt");

-- CreateIndex
CREATE INDEX "PublicMcpServer_tenantOid_environmentOid_status_idx" ON "PublicMcpServer"("tenantOid", "environmentOid", "status");

-- CreateIndex
CREATE INDEX "PublicMcpServer_deploymentOid_idx" ON "PublicMcpServer"("deploymentOid");

-- CreateIndex
CREATE INDEX "PublicMcpServer_projectOid_idx" ON "PublicMcpServer"("projectOid");

-- CreateIndex
CREATE INDEX "PublicMcpServer_instanceOid_idx" ON "PublicMcpServer"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "PublicMcpServerToken_id_key" ON "PublicMcpServerToken"("id");

-- CreateIndex
CREATE UNIQUE INDEX "PublicMcpServerToken_tokenHash_key" ON "PublicMcpServerToken"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "PublicMcpServerToken_replacedByOid_key" ON "PublicMcpServerToken"("replacedByOid");

-- CreateIndex
CREATE INDEX "PublicMcpServerToken_grantOid_type_idx" ON "PublicMcpServerToken"("grantOid", "type");

-- CreateIndex
CREATE INDEX "PublicMcpServerToken_familyId_idx" ON "PublicMcpServerToken"("familyId");

-- CreateIndex
CREATE INDEX "PublicMcpServerToken_expiresAt_idx" ON "PublicMcpServerToken"("expiresAt");

-- CreateIndex
CREATE INDEX "PublicMcpServerToken_projectOid_idx" ON "PublicMcpServerToken"("projectOid");

-- CreateIndex
CREATE INDEX "PublicMcpServerToken_instanceOid_idx" ON "PublicMcpServerToken"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "Publisher_id_key" ON "Publisher"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Publisher_identifier_key" ON "Publisher"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "Publisher_tag_key" ON "Publisher"("tag");

-- CreateIndex
CREATE INDEX "Publisher_createdAt_idx" ON "Publisher"("createdAt");

-- CreateIndex
CREATE INDEX "Publisher_updatedAt_idx" ON "Publisher"("updatedAt");

-- CreateIndex
CREATE INDEX "Publisher_type_idx" ON "Publisher"("type");

-- CreateIndex
CREATE INDEX "Publisher_projectOid_idx" ON "Publisher"("projectOid");

-- CreateIndex
CREATE UNIQUE INDEX "CodeBucket_id_key" ON "CodeBucket"("id");

-- CreateIndex
CREATE INDEX "CodeBucket_createdAt_idx" ON "CodeBucket"("createdAt");

-- CreateIndex
CREATE INDEX "CodeBucket_tenantOid_idx" ON "CodeBucket"("tenantOid");

-- CreateIndex
CREATE INDEX "CodeBucket_projectOid_idx" ON "CodeBucket"("projectOid");

-- CreateIndex
CREATE UNIQUE INDEX "ScmRepo_id_key" ON "ScmRepo"("id");

-- CreateIndex
CREATE INDEX "ScmRepo_createdAt_idx" ON "ScmRepo"("createdAt");

-- CreateIndex
CREATE INDEX "ScmRepo_projectOid_idx" ON "ScmRepo"("projectOid");

-- CreateIndex
CREATE UNIQUE INDEX "ScmRepo_provider_tenantOid_externalId_key" ON "ScmRepo"("provider", "tenantOid", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "ScmRepoPush_id_key" ON "ScmRepoPush"("id");

-- CreateIndex
CREATE INDEX "ScmRepoPush_createdAt_idx" ON "ScmRepoPush"("createdAt");

-- CreateIndex
CREATE INDEX "ScmRepoPush_projectOid_idx" ON "ScmRepoPush"("projectOid");

-- CreateIndex
CREATE UNIQUE INDEX "SessionConnection_id_key" ON "SessionConnection"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SessionConnection_token_key" ON "SessionConnection"("token");

-- CreateIndex
CREATE UNIQUE INDEX "SessionConnection_systemIdentifier_key" ON "SessionConnection"("systemIdentifier");

-- CreateIndex
CREATE INDEX "SessionConnection_createdAt_idx" ON "SessionConnection"("createdAt");

-- CreateIndex
CREATE INDEX "SessionConnection_lastActiveAt_idx" ON "SessionConnection"("lastActiveAt");

-- CreateIndex
CREATE INDEX "SessionConnection_state_lastActiveAt_idx" ON "SessionConnection"("state", "lastActiveAt");

-- CreateIndex
CREATE INDEX "SessionConnection_status_idx" ON "SessionConnection"("status");

-- CreateIndex
CREATE INDEX "SessionConnection_isInternal_idx" ON "SessionConnection"("isInternal");

-- CreateIndex
CREATE INDEX "SessionConnection_adapterGlobalOid_idx" ON "SessionConnection"("adapterGlobalOid");

-- CreateIndex
CREATE INDEX "SessionConnection_tenantOid_environmentOid_isInternal_creat_idx" ON "SessionConnection"("tenantOid", "environmentOid", "isInternal", "createdAt");

-- CreateIndex
CREATE INDEX "SessionConnection_projectOid_idx" ON "SessionConnection"("projectOid");

-- CreateIndex
CREATE INDEX "SessionConnection_instanceOid_idx" ON "SessionConnection"("instanceOid");

-- CreateIndex
CREATE INDEX "SessionConnection_sessionOid_mcpClientKey_lastActiveAt_idx" ON "SessionConnection"("sessionOid", "mcpClientKey", "lastActiveAt");

-- CreateIndex
CREATE INDEX "SessionConnection_sessionOid_state_idx" ON "SessionConnection"("sessionOid", "state");

-- CreateIndex
CREATE INDEX "SessionConnection_tenantOid_createdAt_idx" ON "SessionConnection"("tenantOid", "createdAt");

-- CreateIndex
CREATE INDEX "SessionConnection_ownerPublicMcpServerOid_idx" ON "SessionConnection"("ownerPublicMcpServerOid");

-- CreateIndex
CREATE UNIQUE INDEX "SessionConnectionProviderSpecification_id_key" ON "SessionConnectionProviderSpecification"("id");

-- CreateIndex
CREATE INDEX "SessionConnectionProviderSpecification_createdAt_idx" ON "SessionConnectionProviderSpecification"("createdAt");

-- CreateIndex
CREATE INDEX "SessionConnectionProviderSpecification_status_idx" ON "SessionConnectionProviderSpecification"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SessionConnectionProviderSpecification_connectionOid_sessio_key" ON "SessionConnectionProviderSpecification"("connectionOid", "sessionProviderOid");

-- CreateIndex
CREATE UNIQUE INDEX "EphemeralManagedSession_id_key" ON "EphemeralManagedSession"("id");

-- CreateIndex
CREATE UNIQUE INDEX "EphemeralManagedSession_currentSessionOid_key" ON "EphemeralManagedSession"("currentSessionOid");

-- CreateIndex
CREATE INDEX "EphemeralManagedSession_createdAt_idx" ON "EphemeralManagedSession"("createdAt");

-- CreateIndex
CREATE INDEX "EphemeralManagedSession_updatedAt_idx" ON "EphemeralManagedSession"("updatedAt");

-- CreateIndex
CREATE INDEX "EphemeralManagedSession_status_idx" ON "EphemeralManagedSession"("status");

-- CreateIndex
CREATE INDEX "EphemeralManagedSession_archivedAt_idx" ON "EphemeralManagedSession"("archivedAt");

-- CreateIndex
CREATE INDEX "EphemeralManagedSession_status_archivedAt_idx" ON "EphemeralManagedSession"("status", "archivedAt");

-- CreateIndex
CREATE INDEX "EphemeralManagedSession_sessionTemplateOid_idx" ON "EphemeralManagedSession"("sessionTemplateOid");

-- CreateIndex
CREATE INDEX "EphemeralManagedSession_identityOid_idx" ON "EphemeralManagedSession"("identityOid");

-- CreateIndex
CREATE INDEX "EphemeralManagedSession_ownerActorOid_idx" ON "EphemeralManagedSession"("ownerActorOid");

-- CreateIndex
CREATE INDEX "EphemeralManagedSession_adapterGlobalOid_idx" ON "EphemeralManagedSession"("adapterGlobalOid");

-- CreateIndex
CREATE INDEX "EphemeralManagedSession_currentSessionOid_status_idx" ON "EphemeralManagedSession"("currentSessionOid", "status");

-- CreateIndex
CREATE INDEX "EphemeralManagedSession_projectOid_idx" ON "EphemeralManagedSession"("projectOid");

-- CreateIndex
CREATE INDEX "EphemeralManagedSession_instanceOid_idx" ON "EphemeralManagedSession"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "SessionErrorGroup_id_key" ON "SessionErrorGroup"("id");

-- CreateIndex
CREATE INDEX "SessionErrorGroup_createdAt_idx" ON "SessionErrorGroup"("createdAt");

-- CreateIndex
CREATE INDEX "SessionErrorGroup_type_idx" ON "SessionErrorGroup"("type");

-- CreateIndex
CREATE INDEX "SessionErrorGroup_projectOid_idx" ON "SessionErrorGroup"("projectOid");

-- CreateIndex
CREATE INDEX "SessionErrorGroup_instanceOid_idx" ON "SessionErrorGroup"("instanceOid");

-- CreateIndex
CREATE INDEX "SessionErrorGroup_firstOccurrenceOid_idx" ON "SessionErrorGroup"("firstOccurrenceOid");

-- CreateIndex
CREATE UNIQUE INDEX "SessionErrorGroup_type_hash_tenantOid_key" ON "SessionErrorGroup"("type", "hash", "tenantOid");

-- CreateIndex
CREATE UNIQUE INDEX "SessionErrorGroupOccurrencePeriod_groupOid_startsAt_key" ON "SessionErrorGroupOccurrencePeriod"("groupOid", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "SessionError_id_key" ON "SessionError"("id");

-- CreateIndex
CREATE INDEX "SessionError_createdAt_idx" ON "SessionError"("createdAt");

-- CreateIndex
CREATE INDEX "SessionError_type_idx" ON "SessionError"("type");

-- CreateIndex
CREATE INDEX "SessionError_projectOid_idx" ON "SessionError"("projectOid");

-- CreateIndex
CREATE INDEX "SessionError_instanceOid_idx" ON "SessionError"("instanceOid");

-- CreateIndex
CREATE INDEX "SessionError_connectionOid_idx" ON "SessionError"("connectionOid");

-- CreateIndex
CREATE INDEX "SessionError_providerRunOid_idx" ON "SessionError"("providerRunOid");

-- CreateIndex
CREATE INDEX "SessionError_tenantOid_createdAt_idx" ON "SessionError"("tenantOid", "createdAt");

-- CreateIndex
CREATE INDEX "SessionError_sessionOid_idx" ON "SessionError"("sessionOid");

-- CreateIndex
CREATE UNIQUE INDEX "SessionEvent_id_key" ON "SessionEvent"("id");

-- CreateIndex
CREATE INDEX "SessionEvent_createdAt_idx" ON "SessionEvent"("createdAt");

-- CreateIndex
CREATE INDEX "SessionEvent_type_idx" ON "SessionEvent"("type");

-- CreateIndex
CREATE INDEX "SessionEvent_projectOid_idx" ON "SessionEvent"("projectOid");

-- CreateIndex
CREATE INDEX "SessionEvent_instanceOid_idx" ON "SessionEvent"("instanceOid");

-- CreateIndex
CREATE INDEX "SessionEvent_messageOid_idx" ON "SessionEvent"("messageOid");

-- CreateIndex
CREATE INDEX "SessionEvent_connectionOid_idx" ON "SessionEvent"("connectionOid");

-- CreateIndex
CREATE INDEX "SessionEvent_providerRunOid_idx" ON "SessionEvent"("providerRunOid");

-- CreateIndex
CREATE INDEX "SessionEvent_sessionOid_idx" ON "SessionEvent"("sessionOid");

-- CreateIndex
CREATE INDEX "SessionEvent_tenantOid_createdAt_idx" ON "SessionEvent"("tenantOid", "createdAt");

-- CreateIndex
CREATE INDEX "SessionEvent_errorOid_idx" ON "SessionEvent"("errorOid");

-- CreateIndex
CREATE INDEX "SessionEvent_warningOid_idx" ON "SessionEvent"("warningOid");

-- CreateIndex
CREATE UNIQUE INDEX "SessionMessage_id_key" ON "SessionMessage"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SessionMessage_providerMcpId_key" ON "SessionMessage"("providerMcpId");

-- CreateIndex
CREATE INDEX "SessionMessage_createdAt_idx" ON "SessionMessage"("createdAt");

-- CreateIndex
CREATE INDEX "SessionMessage_isOffloadedToStorage_idx" ON "SessionMessage"("isOffloadedToStorage");

-- CreateIndex
CREATE INDEX "SessionMessage_status_idx" ON "SessionMessage"("status");

-- CreateIndex
CREATE INDEX "SessionMessage_type_idx" ON "SessionMessage"("type");

-- CreateIndex
CREATE INDEX "SessionMessage_source_idx" ON "SessionMessage"("source");

-- CreateIndex
CREATE INDEX "SessionMessage_methodOrToolKey_createdAt_idx" ON "SessionMessage"("methodOrToolKey", "createdAt");

-- CreateIndex
CREATE INDEX "SessionMessage_projectOid_idx" ON "SessionMessage"("projectOid");

-- CreateIndex
CREATE INDEX "SessionMessage_instanceOid_idx" ON "SessionMessage"("instanceOid");

-- CreateIndex
CREATE INDEX "SessionMessage_providerRunOid_idx" ON "SessionMessage"("providerRunOid");

-- CreateIndex
CREATE INDEX "SessionMessage_connectionOid_oid_idx" ON "SessionMessage"("connectionOid", "oid");

-- CreateIndex
CREATE INDEX "SessionMessage_sessionOid_idx" ON "SessionMessage"("sessionOid");

-- CreateIndex
CREATE INDEX "SessionMessage_parentMessageOid_idx" ON "SessionMessage"("parentMessageOid");

-- CreateIndex
CREATE INDEX "SessionMessage_tenantOid_createdAt_idx" ON "SessionMessage"("tenantOid", "createdAt");

-- CreateIndex
CREATE INDEX "SessionMessage_errorOid_idx" ON "SessionMessage"("errorOid");

-- CreateIndex
CREATE INDEX "SessionMessage_slateToolCallOid_idx" ON "SessionMessage"("slateToolCallOid");

-- CreateIndex
CREATE UNIQUE INDEX "SessionMessageStorageBucket_bucket_key" ON "SessionMessageStorageBucket"("bucket");

-- CreateIndex
CREATE UNIQUE INDEX "ToolCall_id_key" ON "ToolCall"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ToolCall_messageOid_key" ON "ToolCall"("messageOid");

-- CreateIndex
CREATE INDEX "ToolCall_createdAt_idx" ON "ToolCall"("createdAt");

-- CreateIndex
CREATE INDEX "ToolCall_projectOid_idx" ON "ToolCall"("projectOid");

-- CreateIndex
CREATE INDEX "ToolCall_instanceOid_idx" ON "ToolCall"("instanceOid");

-- CreateIndex
CREATE INDEX "ToolCall_sessionOid_idx" ON "ToolCall"("sessionOid");

-- CreateIndex
CREATE INDEX "ToolCall_providerRunOid_idx" ON "ToolCall"("providerRunOid");

-- CreateIndex
CREATE UNIQUE INDEX "ToolCallAttachment_id_key" ON "ToolCallAttachment"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ToolCallAttachment_urlKey_key" ON "ToolCallAttachment"("urlKey");

-- CreateIndex
CREATE INDEX "ToolCallAttachment_createdAt_idx" ON "ToolCallAttachment"("createdAt");

-- CreateIndex
CREATE INDEX "ToolCallAttachment_toolCallOid_idx" ON "ToolCallAttachment"("toolCallOid");

-- CreateIndex
CREATE UNIQUE INDEX "SessionParticipant_id_key" ON "SessionParticipant"("id");

-- CreateIndex
CREATE INDEX "SessionParticipant_createdAt_idx" ON "SessionParticipant"("createdAt");

-- CreateIndex
CREATE INDEX "SessionParticipant_type_idx" ON "SessionParticipant"("type");

-- CreateIndex
CREATE INDEX "SessionParticipant_identityActorOid_idx" ON "SessionParticipant"("identityActorOid");

-- CreateIndex
CREATE INDEX "SessionParticipant_identityOid_idx" ON "SessionParticipant"("identityOid");

-- CreateIndex
CREATE INDEX "SessionParticipant_projectOid_idx" ON "SessionParticipant"("projectOid");

-- CreateIndex
CREATE INDEX "SessionParticipant_instanceOid_idx" ON "SessionParticipant"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "SessionParticipant_tenantOid_type_hash_key" ON "SessionParticipant"("tenantOid", "type", "hash");

-- CreateIndex
CREATE UNIQUE INDEX "ProtoGuardFilter_id_key" ON "ProtoGuardFilter"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProtoGuardFilter_key_key" ON "ProtoGuardFilter"("key");

-- CreateIndex
CREATE INDEX "ProtoGuardFilter_issueType_idx" ON "ProtoGuardFilter"("issueType");

-- CreateIndex
CREATE INDEX "ProtoGuardFilter_severity_idx" ON "ProtoGuardFilter"("severity");

-- CreateIndex
CREATE INDEX "ProtoGuardFilter_defaultEnabled_idx" ON "ProtoGuardFilter"("defaultEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "ProtoGuardTenantSetting_id_key" ON "ProtoGuardTenantSetting"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProtoGuardTenantSetting_tenantOid_key" ON "ProtoGuardTenantSetting"("tenantOid");

-- CreateIndex
CREATE INDEX "ProtoGuardTenantSetting_projectOid_idx" ON "ProtoGuardTenantSetting"("projectOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProtoGuardTenantFilterSetting_id_key" ON "ProtoGuardTenantFilterSetting"("id");

-- CreateIndex
CREATE INDEX "ProtoGuardTenantFilterSetting_tenantOid_enabled_idx" ON "ProtoGuardTenantFilterSetting"("tenantOid", "enabled");

-- CreateIndex
CREATE INDEX "ProtoGuardTenantFilterSetting_projectOid_idx" ON "ProtoGuardTenantFilterSetting"("projectOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProtoGuardTenantFilterSetting_tenantOid_filterOid_key" ON "ProtoGuardTenantFilterSetting"("tenantOid", "filterOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProtoGuardRun_id_key" ON "ProtoGuardRun"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProtoGuardRun_messageOid_key" ON "ProtoGuardRun"("messageOid");

-- CreateIndex
CREATE INDEX "ProtoGuardRun_createdAt_idx" ON "ProtoGuardRun"("createdAt");

-- CreateIndex
CREATE INDEX "ProtoGuardRun_tenantOid_createdAt_idx" ON "ProtoGuardRun"("tenantOid", "createdAt");

-- CreateIndex
CREATE INDEX "ProtoGuardRun_sessionOid_createdAt_idx" ON "ProtoGuardRun"("sessionOid", "createdAt");

-- CreateIndex
CREATE INDEX "ProtoGuardRun_status_idx" ON "ProtoGuardRun"("status");

-- CreateIndex
CREATE INDEX "ProtoGuardRun_confidence_idx" ON "ProtoGuardRun"("confidence");

-- CreateIndex
CREATE INDEX "ProtoGuardRun_projectOid_idx" ON "ProtoGuardRun"("projectOid");

-- CreateIndex
CREATE INDEX "ProtoGuardRun_instanceOid_idx" ON "ProtoGuardRun"("instanceOid");

-- CreateIndex
CREATE INDEX "ProtoGuardRun_connectionOid_idx" ON "ProtoGuardRun"("connectionOid");

-- CreateIndex
CREATE INDEX "ProtoGuardRun_providerRunOid_idx" ON "ProtoGuardRun"("providerRunOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProtoGuardAlert_id_key" ON "ProtoGuardAlert"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProtoGuardAlert_runOid_key" ON "ProtoGuardAlert"("runOid");

-- CreateIndex
CREATE INDEX "ProtoGuardAlert_createdAt_idx" ON "ProtoGuardAlert"("createdAt");

-- CreateIndex
CREATE INDEX "ProtoGuardAlert_tenantOid_createdAt_idx" ON "ProtoGuardAlert"("tenantOid", "createdAt");

-- CreateIndex
CREATE INDEX "ProtoGuardAlert_sessionOid_createdAt_idx" ON "ProtoGuardAlert"("sessionOid", "createdAt");

-- CreateIndex
CREATE INDEX "ProtoGuardAlert_messageOid_idx" ON "ProtoGuardAlert"("messageOid");

-- CreateIndex
CREATE INDEX "ProtoGuardAlert_projectOid_idx" ON "ProtoGuardAlert"("projectOid");

-- CreateIndex
CREATE INDEX "ProtoGuardAlert_instanceOid_idx" ON "ProtoGuardAlert"("instanceOid");

-- CreateIndex
CREATE INDEX "ProtoGuardAlert_connectionOid_idx" ON "ProtoGuardAlert"("connectionOid");

-- CreateIndex
CREATE INDEX "ProtoGuardAlert_providerRunOid_idx" ON "ProtoGuardAlert"("providerRunOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProtoGuardAlertInstance_id_key" ON "ProtoGuardAlertInstance"("id");

-- CreateIndex
CREATE INDEX "ProtoGuardAlertInstance_filterOid_issueType_idx" ON "ProtoGuardAlertInstance"("filterOid", "issueType");

-- CreateIndex
CREATE INDEX "ProtoGuardAlertInstance_severity_idx" ON "ProtoGuardAlertInstance"("severity");

-- CreateIndex
CREATE INDEX "ProtoGuardAlertInstance_alertOid_idx" ON "ProtoGuardAlertInstance"("alertOid");

-- CreateIndex
CREATE UNIQUE INDEX "SessionProvider_id_key" ON "SessionProvider"("id");

-- CreateIndex
CREATE INDEX "SessionProvider_createdAt_idx" ON "SessionProvider"("createdAt");

-- CreateIndex
CREATE INDEX "SessionProvider_updatedAt_idx" ON "SessionProvider"("updatedAt");

-- CreateIndex
CREATE INDEX "SessionProvider_status_idx" ON "SessionProvider"("status");

-- CreateIndex
CREATE INDEX "SessionProvider_isEphemeral_idx" ON "SessionProvider"("isEphemeral");

-- CreateIndex
CREATE INDEX "SessionProvider_projectOid_idx" ON "SessionProvider"("projectOid");

-- CreateIndex
CREATE INDEX "SessionProvider_instanceOid_idx" ON "SessionProvider"("instanceOid");

-- CreateIndex
CREATE INDEX "SessionProvider_providerOid_idx" ON "SessionProvider"("providerOid");

-- CreateIndex
CREATE INDEX "SessionProvider_fromTemplateOid_idx" ON "SessionProvider"("fromTemplateOid");

-- CreateIndex
CREATE INDEX "SessionProvider_ownerPublicMcpServerOid_idx" ON "SessionProvider"("ownerPublicMcpServerOid");

-- CreateIndex
CREATE UNIQUE INDEX "SessionProvider_sessionOid_tag_key" ON "SessionProvider"("sessionOid", "tag");

-- CreateIndex
CREATE UNIQUE INDEX "SessionProvider_sessionOid_nameTemplate_key" ON "SessionProvider"("sessionOid", "nameTemplate");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderRun_id_key" ON "ProviderRun"("id");

-- CreateIndex
CREATE INDEX "ProviderRun_createdAt_idx" ON "ProviderRun"("createdAt");

-- CreateIndex
CREATE INDEX "ProviderRun_updatedAt_idx" ON "ProviderRun"("updatedAt");

-- CreateIndex
CREATE INDEX "ProviderRun_status_lastPingAt_idx" ON "ProviderRun"("status", "lastPingAt");

-- CreateIndex
CREATE INDEX "ProviderRun_lastPingAt_idx" ON "ProviderRun"("lastPingAt");

-- CreateIndex
CREATE INDEX "ProviderRun_projectOid_idx" ON "ProviderRun"("projectOid");

-- CreateIndex
CREATE INDEX "ProviderRun_metorialInstanceOid_idx" ON "ProviderRun"("metorialInstanceOid");

-- CreateIndex
CREATE INDEX "ProviderRun_connectionOid_idx" ON "ProviderRun"("connectionOid");

-- CreateIndex
CREATE INDEX "ProviderRun_tenantOid_createdAt_idx" ON "ProviderRun"("tenantOid", "createdAt");

-- CreateIndex
CREATE INDEX "ProviderRun_sessionOid_idx" ON "ProviderRun"("sessionOid");

-- CreateIndex
CREATE INDEX "ProviderRun_instanceOid_idx" ON "ProviderRun"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "SessionProviderInstance_id_key" ON "SessionProviderInstance"("id");

-- CreateIndex
CREATE INDEX "SessionProviderInstance_expiresAt_idx" ON "SessionProviderInstance"("expiresAt");

-- CreateIndex
CREATE INDEX "SessionProviderInstance_sessionProviderOid_expiresAt_idx" ON "SessionProviderInstance"("sessionProviderOid", "expiresAt");

-- CreateIndex
CREATE INDEX "SessionProviderInstance_sessionOid_idx" ON "SessionProviderInstance"("sessionOid");

-- CreateIndex
CREATE UNIQUE INDEX "Session_id_key" ON "Session"("id");

-- CreateIndex
CREATE INDEX "Session_createdAt_idx" ON "Session"("createdAt");

-- CreateIndex
CREATE INDEX "Session_updatedAt_idx" ON "Session"("updatedAt");

-- CreateIndex
CREATE INDEX "Session_lastActiveAt_idx" ON "Session"("lastActiveAt");

-- CreateIndex
CREATE INDEX "Session_connectionState_lastActiveAt_idx" ON "Session"("connectionState", "lastActiveAt");

-- CreateIndex
CREATE INDEX "Session_status_idx" ON "Session"("status");

-- CreateIndex
CREATE INDEX "Session_archivedAt_idx" ON "Session"("archivedAt");

-- CreateIndex
CREATE INDEX "Session_status_archivedAt_idx" ON "Session"("status", "archivedAt");

-- CreateIndex
CREATE INDEX "Session_identityActorOid_idx" ON "Session"("identityActorOid");

-- CreateIndex
CREATE INDEX "Session_identityOid_idx" ON "Session"("identityOid");

-- CreateIndex
CREATE INDEX "Session_ownerActorOid_idx" ON "Session"("ownerActorOid");

-- CreateIndex
CREATE INDEX "Session_isEphemeral_idx" ON "Session"("isEphemeral");

-- CreateIndex
CREATE INDEX "Session_isInternal_idx" ON "Session"("isInternal");

-- CreateIndex
CREATE INDEX "Session_adapterGlobalOid_idx" ON "Session"("adapterGlobalOid");

-- CreateIndex
CREATE INDEX "Session_tenantOid_environmentOid_isInternal_createdAt_idx" ON "Session"("tenantOid", "environmentOid", "isInternal", "createdAt");

-- CreateIndex
CREATE INDEX "Session_ephemeralManagedSessionOid_idx" ON "Session"("ephemeralManagedSessionOid");

-- CreateIndex
CREATE INDEX "Session_projectOid_idx" ON "Session"("projectOid");

-- CreateIndex
CREATE INDEX "Session_instanceOid_idx" ON "Session"("instanceOid");

-- CreateIndex
CREATE INDEX "Session_tenantOid_status_archivedAt_idx" ON "Session"("tenantOid", "status", "archivedAt");

-- CreateIndex
CREATE INDEX "Session_ownerPublicMcpServerOid_idx" ON "Session"("ownerPublicMcpServerOid");

-- CreateIndex
CREATE UNIQUE INDEX "SessionTemplate_id_key" ON "SessionTemplate"("id");

-- CreateIndex
CREATE UNIQUE INDEX "stm_default_for_instance_key" ON "SessionTemplate"("defaultSessionTemplateForIntegrationInstanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "stm_default_for_instance_group_key" ON "SessionTemplate"("defaultSessionTemplateForIntegrationInstanceGroupOid");

-- CreateIndex
CREATE INDEX "SessionTemplate_createdAt_idx" ON "SessionTemplate"("createdAt");

-- CreateIndex
CREATE INDEX "SessionTemplate_updatedAt_idx" ON "SessionTemplate"("updatedAt");

-- CreateIndex
CREATE INDEX "SessionTemplate_status_idx" ON "SessionTemplate"("status");

-- CreateIndex
CREATE INDEX "SessionTemplate_archivedAt_idx" ON "SessionTemplate"("archivedAt");

-- CreateIndex
CREATE INDEX "SessionTemplate_status_archivedAt_idx" ON "SessionTemplate"("status", "archivedAt");

-- CreateIndex
CREATE INDEX "SessionTemplate_identityActorOid_idx" ON "SessionTemplate"("identityActorOid");

-- CreateIndex
CREATE INDEX "SessionTemplate_identityOid_idx" ON "SessionTemplate"("identityOid");

-- CreateIndex
CREATE INDEX "SessionTemplate_ownerActorOid_idx" ON "SessionTemplate"("ownerActorOid");

-- CreateIndex
CREATE INDEX "SessionTemplate_integrationInstanceOid_status_idx" ON "SessionTemplate"("integrationInstanceOid", "status");

-- CreateIndex
CREATE INDEX "SessionTemplate_integrationInstanceGroupOid_status_idx" ON "SessionTemplate"("integrationInstanceGroupOid", "status");

-- CreateIndex
CREATE INDEX "stm_default_for_instance_status_idx" ON "SessionTemplate"("defaultSessionTemplateForIntegrationInstanceOid", "status");

-- CreateIndex
CREATE INDEX "stm_default_for_instance_group_status_idx" ON "SessionTemplate"("defaultSessionTemplateForIntegrationInstanceGroupOid", "status");

-- CreateIndex
CREATE INDEX "SessionTemplate_projectOid_idx" ON "SessionTemplate"("projectOid");

-- CreateIndex
CREATE INDEX "SessionTemplate_instanceOid_idx" ON "SessionTemplate"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "SessionTemplateProvider_id_key" ON "SessionTemplateProvider"("id");

-- CreateIndex
CREATE INDEX "SessionTemplateProvider_createdAt_idx" ON "SessionTemplateProvider"("createdAt");

-- CreateIndex
CREATE INDEX "SessionTemplateProvider_updatedAt_idx" ON "SessionTemplateProvider"("updatedAt");

-- CreateIndex
CREATE INDEX "SessionTemplateProvider_status_idx" ON "SessionTemplateProvider"("status");

-- CreateIndex
CREATE INDEX "SessionTemplateProvider_integrationInstanceProviderOid_stat_idx" ON "SessionTemplateProvider"("integrationInstanceProviderOid", "status");

-- CreateIndex
CREATE INDEX "SessionTemplateProvider_integrationInstanceGroupProviderOid_idx" ON "SessionTemplateProvider"("integrationInstanceGroupProviderOid", "status");

-- CreateIndex
CREATE INDEX "SessionTemplateProvider_projectOid_idx" ON "SessionTemplateProvider"("projectOid");

-- CreateIndex
CREATE INDEX "SessionTemplateProvider_instanceOid_idx" ON "SessionTemplateProvider"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "unique_session_template_provider_instance_provider" ON "SessionTemplateProvider"("sessionTemplateOid", "integrationInstanceProviderOid");

-- CreateIndex
CREATE UNIQUE INDEX "unique_session_template_provider_instance_group_provider" ON "SessionTemplateProvider"("sessionTemplateOid", "integrationInstanceGroupProviderOid");

-- CreateIndex
CREATE INDEX "SessionUsageRecord_createdAt_idx" ON "SessionUsageRecord"("createdAt");

-- CreateIndex
CREATE INDEX "SessionUsageRecord_projectOid_idx" ON "SessionUsageRecord"("projectOid");

-- CreateIndex
CREATE INDEX "ProviderRunUsageRecord_projectOid_idx" ON "ProviderRunUsageRecord"("projectOid");

-- CreateIndex
CREATE INDEX "ProviderRunUsageRecord_providerRunOid_idx" ON "ProviderRunUsageRecord"("providerRunOid");

-- CreateIndex
CREATE INDEX "ProviderRunUsageRecord_createdAt_idx" ON "ProviderRunUsageRecord"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SessionWarning_id_key" ON "SessionWarning"("id");

-- CreateIndex
CREATE INDEX "SessionWarning_projectOid_idx" ON "SessionWarning"("projectOid");

-- CreateIndex
CREATE INDEX "SessionWarning_instanceOid_idx" ON "SessionWarning"("instanceOid");

-- CreateIndex
CREATE INDEX "SessionWarning_connectionOid_idx" ON "SessionWarning"("connectionOid");

-- CreateIndex
CREATE INDEX "SessionWarning_tenantOid_createdAt_idx" ON "SessionWarning"("tenantOid", "createdAt");

-- CreateIndex
CREATE INDEX "SessionWarning_sessionOid_idx" ON "SessionWarning"("sessionOid");

-- CreateIndex
CREATE UNIQUE INDEX "SkillEntity_id_key" ON "SkillEntity"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SkillEntity_slug_key" ON "SkillEntity"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "SkillEntity_ownerSkillOid_key" ON "SkillEntity"("ownerSkillOid");

-- CreateIndex
CREATE INDEX "SkillEntity_projectOid_idx" ON "SkillEntity"("projectOid");

-- CreateIndex
CREATE INDEX "SkillEntity_instanceOid_idx" ON "SkillEntity"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_id_key" ON "Skill"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_slug_key" ON "Skill"("slug");

-- CreateIndex
CREATE INDEX "Skill_projectOid_idx" ON "Skill"("projectOid");

-- CreateIndex
CREATE INDEX "Skill_instanceOid_idx" ON "Skill"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "SkillIntegration_id_key" ON "SkillIntegration"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SkillIntegration_itemOid_key" ON "SkillIntegration"("itemOid");

-- CreateIndex
CREATE UNIQUE INDEX "SkillIntegration_skillOid_integrationOid_key" ON "SkillIntegration"("skillOid", "integrationOid");

-- CreateIndex
CREATE UNIQUE INDEX "SkillProvider_id_key" ON "SkillProvider"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SkillProvider_itemOid_key" ON "SkillProvider"("itemOid");

-- CreateIndex
CREATE UNIQUE INDEX "SkillProvider_skillOid_providerOid_key" ON "SkillProvider"("skillOid", "providerOid");

-- CreateIndex
CREATE UNIQUE INDEX "SkillProviderLink_id_key" ON "SkillProviderLink"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SkillProviderLink_skillOid_providerOid_key" ON "SkillProviderLink"("skillOid", "providerOid");

-- CreateIndex
CREATE UNIQUE INDEX "SkillItem_id_key" ON "SkillItem"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SkillTemplate_id_key" ON "SkillTemplate"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SkillTemplate_slug_key" ON "SkillTemplate"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "SkillTemplate_systemIdentifier_key" ON "SkillTemplate"("systemIdentifier");

-- CreateIndex
CREATE INDEX "SkillTemplate_projectOid_idx" ON "SkillTemplate"("projectOid");

-- CreateIndex
CREATE INDEX "SkillTemplate_instanceOid_idx" ON "SkillTemplate"("instanceOid");

-- CreateIndex
CREATE UNIQUE INDEX "SkillTemplateItem_id_key" ON "SkillTemplateItem"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Solution_id_key" ON "Solution"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Solution_identifier_key" ON "Solution"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "Consumer_id_key" ON "Consumer"("id");

-- CreateIndex
CREATE INDEX "Consumer_organizationMemberOid_idx" ON "Consumer"("organizationMemberOid");

-- CreateIndex
CREATE INDEX "Consumer_organizationActorOid_idx" ON "Consumer"("organizationActorOid");

-- CreateIndex
CREATE UNIQUE INDEX "Consumer_email_organizationOid_key" ON "Consumer"("email", "organizationOid");

-- CreateIndex
CREATE UNIQUE INDEX "InstanceConsumer_id_key" ON "InstanceConsumer"("id");

-- CreateIndex
CREATE INDEX "InstanceConsumer_organizationMemberOid_idx" ON "InstanceConsumer"("organizationMemberOid");

-- CreateIndex
CREATE INDEX "InstanceConsumer_organizationActorOid_idx" ON "InstanceConsumer"("organizationActorOid");

-- CreateIndex
CREATE UNIQUE INDEX "InstanceConsumer_instanceOid_consumerOid_key" ON "InstanceConsumer"("instanceOid", "consumerOid");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumerProfile_id_key" ON "ConsumerProfile"("id");

-- CreateIndex
CREATE INDEX "ConsumerProfile_organizationOid_idx" ON "ConsumerProfile"("organizationOid");

-- CreateIndex
CREATE INDEX "ConsumerProfile_instanceOid_idx" ON "ConsumerProfile"("instanceOid");

-- CreateIndex
CREATE INDEX "ConsumerProfile_consumerOid_idx" ON "ConsumerProfile"("consumerOid");

-- CreateIndex
CREATE INDEX "ConsumerProfile_organizationMemberOid_idx" ON "ConsumerProfile"("organizationMemberOid");

-- CreateIndex
CREATE INDEX "ConsumerProfile_organizationActorOid_idx" ON "ConsumerProfile"("organizationActorOid");

-- CreateIndex
CREATE UNIQUE INDEX "Instance_id_key" ON "Instance"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Instance_slug_key" ON "Instance"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_id_key" ON "Tenant"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_urlKey_key" ON "Tenant"("urlKey");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_identifier_key" ON "Tenant"("identifier");

-- CreateIndex
CREATE INDEX "Tenant_retiredAt_idx" ON "Tenant"("retiredAt");

-- CreateIndex
CREATE UNIQUE INDEX "Environment_id_key" ON "Environment"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Environment_identifier_key" ON "Environment"("identifier");

-- CreateIndex
CREATE INDEX "Environment_projectOid_idx" ON "Environment"("projectOid");

-- CreateIndex
CREATE INDEX "Environment_tenantOid_idx" ON "Environment"("tenantOid");

-- CreateIndex
CREATE UNIQUE INDEX "Actor_id_key" ON "Actor"("id");

-- CreateIndex
CREATE INDEX "Actor_organizationActorOid_idx" ON "Actor"("organizationActorOid");

-- CreateIndex
CREATE INDEX "Actor_projectOid_idx" ON "Actor"("projectOid");

-- CreateIndex
CREATE UNIQUE INDEX "Actor_tenantOid_identifier_key" ON "Actor"("tenantOid", "identifier");

-- CreateIndex
CREATE UNIQUE INDEX "Actor_tenantOid_organizationActorOid_key" ON "Actor"("tenantOid", "organizationActorOid");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_id_key" ON "Organization"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationActor_id_key" ON "OrganizationActor"("id");

-- CreateIndex
CREATE INDEX "OrganizationActor_organizationOid_idx" ON "OrganizationActor"("organizationOid");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMember_id_key" ON "OrganizationMember"("id");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMember_actorOid_key" ON "OrganizationMember"("actorOid");

-- CreateIndex
CREATE INDEX "OrganizationMember_organizationOid_idx" ON "OrganizationMember"("organizationOid");

-- CreateIndex
CREATE INDEX "OrganizationMember_lastActiveAt_idx" ON "OrganizationMember"("lastActiveAt");

-- CreateIndex
CREATE UNIQUE INDEX "Project_id_key" ON "Project"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_id_key" ON "Brand"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_identifier_key" ON "Brand"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_tenantOid_key" ON "Brand"("tenantOid");

-- CreateIndex
CREATE INDEX "Brand_projectOid_idx" ON "Brand"("projectOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderSetupSession_id_key" ON "ProviderSetupSession"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderSetupSession_authConfigOid_key" ON "ProviderSetupSession"("authConfigOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderSetupSession_identityCredentialOid_key" ON "ProviderSetupSession"("identityCredentialOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderSetupSession_oauthSetupOid_key" ON "ProviderSetupSession"("oauthSetupOid");

-- CreateIndex
CREATE INDEX "ProviderSetupSession_createdAt_idx" ON "ProviderSetupSession"("createdAt");

-- CreateIndex
CREATE INDEX "ProviderSetupSession_updatedAt_idx" ON "ProviderSetupSession"("updatedAt");

-- CreateIndex
CREATE INDEX "ProviderSetupSession_status_idx" ON "ProviderSetupSession"("status");

-- CreateIndex
CREATE INDEX "ProviderSetupSession_type_idx" ON "ProviderSetupSession"("type");

-- CreateIndex
CREATE INDEX "ProviderSetupSession_identityOid_idx" ON "ProviderSetupSession"("identityOid");

-- CreateIndex
CREATE INDEX "ProviderSetupSession_integrationSetupSessionProviderOid_idx" ON "ProviderSetupSession"("integrationSetupSessionProviderOid");

-- CreateIndex
CREATE INDEX "ProviderSetupSession_projectOid_idx" ON "ProviderSetupSession"("projectOid");

-- CreateIndex
CREATE INDEX "ProviderSetupSession_instanceOid_idx" ON "ProviderSetupSession"("instanceOid");

-- CreateIndex
CREATE INDEX "ProviderSetupSession_ownerActorOid_idx" ON "ProviderSetupSession"("ownerActorOid");

-- CreateIndex
CREATE INDEX "ProviderSetupSession_ownerPublicMcpServerOid_idx" ON "ProviderSetupSession"("ownerPublicMcpServerOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderSetupSessionEvent_id_key" ON "ProviderSetupSessionEvent"("id");

-- CreateIndex
CREATE INDEX "ProviderSetupSessionEvent_type_idx" ON "ProviderSetupSessionEvent"("type");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderSetupSessionEmail_id_key" ON "ProviderSetupSessionEmail"("id");

-- CreateIndex
CREATE INDEX "ProviderSetupSessionEmail_senderActorOid_idx" ON "ProviderSetupSessionEmail"("senderActorOid");

-- CreateIndex
CREATE INDEX "ProviderSetupSessionEmail_createdAt_idx" ON "ProviderSetupSessionEmail"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderSetupSessionEmail_setupSessionOid_recipientEmail_th_key" ON "ProviderSetupSessionEmail"("setupSessionOid", "recipientEmail", "throttleBucket");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationSetupSession_id_key" ON "IntegrationSetupSession"("id");

-- CreateIndex
CREATE INDEX "IntegrationSetupSession_createdAt_idx" ON "IntegrationSetupSession"("createdAt");

-- CreateIndex
CREATE INDEX "IntegrationSetupSession_updatedAt_idx" ON "IntegrationSetupSession"("updatedAt");

-- CreateIndex
CREATE INDEX "IntegrationSetupSession_status_idx" ON "IntegrationSetupSession"("status");

-- CreateIndex
CREATE INDEX "IntegrationSetupSession_integrationOid_idx" ON "IntegrationSetupSession"("integrationOid");

-- CreateIndex
CREATE INDEX "IntegrationSetupSession_integrationInstanceOid_idx" ON "IntegrationSetupSession"("integrationInstanceOid");

-- CreateIndex
CREATE INDEX "IntegrationSetupSession_projectOid_idx" ON "IntegrationSetupSession"("projectOid");

-- CreateIndex
CREATE INDEX "IntegrationSetupSession_instanceOid_idx" ON "IntegrationSetupSession"("instanceOid");

-- CreateIndex
CREATE INDEX "IntegrationSetupSession_ownerActorOid_idx" ON "IntegrationSetupSession"("ownerActorOid");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationSetupSessionProvider_id_key" ON "IntegrationSetupSessionProvider"("id");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationSetupSessionProvider_providerSetupSessionOid_key" ON "IntegrationSetupSessionProvider"("providerSetupSessionOid");

-- CreateIndex
CREATE INDEX "IntegrationSetupSessionProvider_integrationSetupSessionOid_idx" ON "IntegrationSetupSessionProvider"("integrationSetupSessionOid");

-- CreateIndex
CREATE INDEX "IntegrationSetupSessionProvider_integrationProviderOid_idx" ON "IntegrationSetupSessionProvider"("integrationProviderOid");

-- CreateIndex
CREATE INDEX "IntegrationSetupSessionProvider_integrationInstanceProvider_idx" ON "IntegrationSetupSessionProvider"("integrationInstanceProviderOid");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationSetupSessionProvider_integrationSetupSessionOid__key" ON "IntegrationSetupSessionProvider"("integrationSetupSessionOid", "integrationProviderOid");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationSetupSessionStep_id_key" ON "IntegrationSetupSessionStep"("id");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationSetupSessionStep_integrationSetupSessionProvider_key" ON "IntegrationSetupSessionStep"("integrationSetupSessionProviderOid");

-- CreateIndex
CREATE INDEX "IntegrationSetupSessionStep_integrationSetupSessionOid_idx" ON "IntegrationSetupSessionStep"("integrationSetupSessionOid");

-- CreateIndex
CREATE INDEX "IntegrationSetupSessionStep_index_idx" ON "IntegrationSetupSessionStep"("index");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationSetupSessionStep_integrationSetupSessionOid_inde_key" ON "IntegrationSetupSessionStep"("integrationSetupSessionOid", "index");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationSetupSessionEvent_id_key" ON "IntegrationSetupSessionEvent"("id");

-- CreateIndex
CREATE INDEX "IntegrationSetupSessionEvent_type_idx" ON "IntegrationSetupSessionEvent"("type");

-- CreateIndex
CREATE INDEX "IntegrationSetupSessionEvent_integrationSetupSessionOid_idx" ON "IntegrationSetupSessionEvent"("integrationSetupSessionOid");

-- CreateIndex
CREATE INDEX "IntegrationSetupSessionEvent_integrationSetupSessionProvide_idx" ON "IntegrationSetupSessionEvent"("integrationSetupSessionProviderOid");

-- CreateIndex
CREATE INDEX "_ProviderListingToProviderListingCategory_B_index" ON "_ProviderListingToProviderListingCategory"("B");

-- CreateIndex
CREATE INDEX "_ProviderListingToProviderListingCollection_B_index" ON "_ProviderListingToProviderListingCollection"("B");

-- CreateIndex
CREATE INDEX "_ProviderListingToProviderListingGroup_B_index" ON "_ProviderListingToProviderListingGroup"("B");

-- AddForeignKey
ALTER TABLE "AdapterIntegrationInstance" ADD CONSTRAINT "AdapterIntegrationInstance_adapterIntegrationOid_fkey" FOREIGN KEY ("adapterIntegrationOid") REFERENCES "AdapterIntegration"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdapterIntegrationInstance" ADD CONSTRAINT "AdapterIntegrationInstance_integrationInstanceOid_fkey" FOREIGN KEY ("integrationInstanceOid") REFERENCES "IntegrationInstance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdapterIntegrationInstance" ADD CONSTRAINT "AdapterIntegrationInstance_integrationOid_fkey" FOREIGN KEY ("integrationOid") REFERENCES "Integration"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdapterIntegrationInstance" ADD CONSTRAINT "AdapterIntegrationInstance_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdapterIntegrationInstance" ADD CONSTRAINT "AdapterIntegrationInstance_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdapterIntegrationInstance" ADD CONSTRAINT "AdapterIntegrationInstance_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdapterIntegrationInstance" ADD CONSTRAINT "AdapterIntegrationInstance_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdapterIntegrationInstance" ADD CONSTRAINT "AdapterIntegrationInstance_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdapterIntegrationInstanceProvider" ADD CONSTRAINT "aiip_aii_fkey" FOREIGN KEY ("adapterIntegrationInstanceOid") REFERENCES "AdapterIntegrationInstance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdapterIntegrationInstanceProvider" ADD CONSTRAINT "aiip_aip_fkey" FOREIGN KEY ("adapterIntegrationProviderOid") REFERENCES "AdapterIntegrationProvider"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdapterIntegrationInstanceProvider" ADD CONSTRAINT "aiip_ain_fkey" FOREIGN KEY ("adapterIntegrationOid") REFERENCES "AdapterIntegration"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdapterIntegrationInstanceProvider" ADD CONSTRAINT "aiip_iip_fkey" FOREIGN KEY ("integrationInstanceProviderOid") REFERENCES "IntegrationInstanceProvider"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdapterIntegrationInstanceProvider" ADD CONSTRAINT "aiip_ini_fkey" FOREIGN KEY ("integrationInstanceOid") REFERENCES "IntegrationInstance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdapterIntegrationInstanceProvider" ADD CONSTRAINT "aiip_inp_fkey" FOREIGN KEY ("integrationProviderOid") REFERENCES "IntegrationProvider"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdapterIntegrationInstanceProvider" ADD CONSTRAINT "aiip_int_fkey" FOREIGN KEY ("integrationOid") REFERENCES "Integration"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdapterIntegrationInstanceProvider" ADD CONSTRAINT "AdapterIntegrationInstanceProvider_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdapterIntegrationInstanceProvider" ADD CONSTRAINT "AdapterIntegrationInstanceProvider_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdapterIntegrationInstanceProvider" ADD CONSTRAINT "AdapterIntegrationInstanceProvider_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdapterIntegrationInstanceProvider" ADD CONSTRAINT "AdapterIntegrationInstanceProvider_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdapterIntegrationInstanceProvider" ADD CONSTRAINT "AdapterIntegrationInstanceProvider_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdapterIntegrationInstanceProvider" ADD CONSTRAINT "aiip_current_session_fkey" FOREIGN KEY ("currentSessionOid") REFERENCES "Session"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdapterIntegration" ADD CONSTRAINT "AdapterIntegration_adapterGlobalOid_fkey" FOREIGN KEY ("adapterGlobalOid") REFERENCES "ProviderAdapterGlobal"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdapterIntegration" ADD CONSTRAINT "AdapterIntegration_integrationOid_fkey" FOREIGN KEY ("integrationOid") REFERENCES "Integration"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdapterIntegration" ADD CONSTRAINT "AdapterIntegration_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdapterIntegration" ADD CONSTRAINT "AdapterIntegration_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdapterIntegration" ADD CONSTRAINT "AdapterIntegration_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdapterIntegration" ADD CONSTRAINT "AdapterIntegration_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdapterIntegration" ADD CONSTRAINT "AdapterIntegration_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdapterIntegrationProvider" ADD CONSTRAINT "AdapterIntegrationProvider_adapterIntegrationOid_fkey" FOREIGN KEY ("adapterIntegrationOid") REFERENCES "AdapterIntegration"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdapterIntegrationProvider" ADD CONSTRAINT "AdapterIntegrationProvider_integrationOid_fkey" FOREIGN KEY ("integrationOid") REFERENCES "Integration"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdapterIntegrationProvider" ADD CONSTRAINT "AdapterIntegrationProvider_integrationProviderOid_fkey" FOREIGN KEY ("integrationProviderOid") REFERENCES "IntegrationProvider"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdapterIntegrationProvider" ADD CONSTRAINT "AdapterIntegrationProvider_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdapterIntegrationProvider" ADD CONSTRAINT "AdapterIntegrationProvider_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdapterIntegrationProvider" ADD CONSTRAINT "AdapterIntegrationProvider_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdapterIntegrationProvider" ADD CONSTRAINT "AdapterIntegrationProvider_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdapterIntegrationProvider" ADD CONSTRAINT "AdapterIntegrationProvider_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdapterIntegrationInstanceProviderSession" ADD CONSTRAINT "aiips_aiip_fkey" FOREIGN KEY ("adapterIntegrationInstanceProviderOid") REFERENCES "AdapterIntegrationInstanceProvider"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdapterIntegrationInstanceProviderSession" ADD CONSTRAINT "aiips_session_fkey" FOREIGN KEY ("sessionOid") REFERENCES "Session"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdapterIntegrationInstanceProviderSession" ADD CONSTRAINT "aiips_aii_fkey" FOREIGN KEY ("adapterIntegrationInstanceOid") REFERENCES "AdapterIntegrationInstance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdapterIntegrationInstanceProviderSession" ADD CONSTRAINT "aiips_ain_fkey" FOREIGN KEY ("adapterIntegrationOid") REFERENCES "AdapterIntegration"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdapterIntegrationInstanceProviderSession" ADD CONSTRAINT "AdapterIntegrationInstanceProviderSession_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdapterIntegrationInstanceProviderSession" ADD CONSTRAINT "AdapterIntegrationInstanceProviderSession_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdapterIntegrationInstanceProviderSession" ADD CONSTRAINT "AdapterIntegrationInstanceProviderSession_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdapterIntegrationInstanceProviderSession" ADD CONSTRAINT "AdapterIntegrationInstanceProviderSession_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdapterIntegrationInstanceProviderSession" ADD CONSTRAINT "AdapterIntegrationInstanceProviderSession_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_actorOid_fkey" FOREIGN KEY ("actorOid") REFERENCES "IdentityActor"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentClient" ADD CONSTRAINT "AgentClient_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentClient" ADD CONSTRAINT "AgentClient_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentClient" ADD CONSTRAINT "AgentClient_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentClient" ADD CONSTRAINT "AgentClient_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentClient" ADD CONSTRAINT "AgentClient_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentClientRegistration" ADD CONSTRAINT "AgentClientRegistration_agentClientOid_fkey" FOREIGN KEY ("agentClientOid") REFERENCES "AgentClient"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentInstance" ADD CONSTRAINT "AgentInstance_agentOid_fkey" FOREIGN KEY ("agentOid") REFERENCES "Agent"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentInstance" ADD CONSTRAINT "AgentInstance_agentClientOid_fkey" FOREIGN KEY ("agentClientOid") REFERENCES "AgentClient"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentInstance" ADD CONSTRAINT "AgentInstance_agentClientRegistrationOid_fkey" FOREIGN KEY ("agentClientRegistrationOid") REFERENCES "AgentClientRegistration"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthConfig" ADD CONSTRAINT "ProviderAuthConfig_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthConfig" ADD CONSTRAINT "ProviderAuthConfig_authMethodOid_fkey" FOREIGN KEY ("authMethodOid") REFERENCES "ProviderAuthMethod"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthConfig" ADD CONSTRAINT "ProviderAuthConfig_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthConfig" ADD CONSTRAINT "ProviderAuthConfig_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthConfig" ADD CONSTRAINT "ProviderAuthConfig_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthConfig" ADD CONSTRAINT "ProviderAuthConfig_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthConfig" ADD CONSTRAINT "ProviderAuthConfig_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthConfig" ADD CONSTRAINT "ProviderAuthConfig_backendOid_fkey" FOREIGN KEY ("backendOid") REFERENCES "Backend"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthConfig" ADD CONSTRAINT "ProviderAuthConfig_owningIntegrationInstanceOid_fkey" FOREIGN KEY ("owningIntegrationInstanceOid") REFERENCES "IntegrationInstance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthConfig" ADD CONSTRAINT "ProviderAuthConfig_owningIntegrationInstanceProviderOid_fkey" FOREIGN KEY ("owningIntegrationInstanceProviderOid") REFERENCES "IntegrationInstanceProvider"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthConfig" ADD CONSTRAINT "ProviderAuthConfig_ownerActorOid_fkey" FOREIGN KEY ("ownerActorOid") REFERENCES "IdentityActor"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthConfig" ADD CONSTRAINT "ProviderAuthConfig_deploymentOid_fkey" FOREIGN KEY ("deploymentOid") REFERENCES "ProviderDeployment"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthConfig" ADD CONSTRAINT "ProviderAuthConfig_currentVersionOid_fkey" FOREIGN KEY ("currentVersionOid") REFERENCES "ProviderAuthConfigVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthConfig" ADD CONSTRAINT "ProviderAuthConfig_authCredentialsOid_fkey" FOREIGN KEY ("authCredentialsOid") REFERENCES "ProviderAuthCredentials"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthConfig" ADD CONSTRAINT "ProviderAuthConfig_ownerPublicMcpServerOid_fkey" FOREIGN KEY ("ownerPublicMcpServerOid") REFERENCES "PublicMcpServer"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthConfigVersion" ADD CONSTRAINT "ProviderAuthConfigVersion_authConfigOid_fkey" FOREIGN KEY ("authConfigOid") REFERENCES "ProviderAuthConfig"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthConfigVersion" ADD CONSTRAINT "ProviderAuthConfigVersion_slateAuthConfigOid_fkey" FOREIGN KEY ("slateAuthConfigOid") REFERENCES "SlateAuthConfig"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthConfigVersion" ADD CONSTRAINT "ProviderAuthConfigVersion_shuttleAuthConfigOid_fkey" FOREIGN KEY ("shuttleAuthConfigOid") REFERENCES "ShuttleAuthConfig"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthConfigVersion" ADD CONSTRAINT "ProviderAuthConfigVersion_authCredentialsOid_fkey" FOREIGN KEY ("authCredentialsOid") REFERENCES "ProviderAuthCredentials"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthConfigUpdate" ADD CONSTRAINT "ProviderAuthConfigUpdate_authConfigOid_fkey" FOREIGN KEY ("authConfigOid") REFERENCES "ProviderAuthConfig"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthConfigUpdate" ADD CONSTRAINT "ProviderAuthConfigUpdate_fromVersionOid_fkey" FOREIGN KEY ("fromVersionOid") REFERENCES "ProviderAuthConfigVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthConfigUpdate" ADD CONSTRAINT "ProviderAuthConfigUpdate_toVersionOid_fkey" FOREIGN KEY ("toVersionOid") REFERENCES "ProviderAuthConfigVersion"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthCredentials" ADD CONSTRAINT "ProviderAuthCredentials_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthCredentials" ADD CONSTRAINT "ProviderAuthCredentials_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthCredentials" ADD CONSTRAINT "ProviderAuthCredentials_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthCredentials" ADD CONSTRAINT "ProviderAuthCredentials_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthCredentials" ADD CONSTRAINT "ProviderAuthCredentials_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthCredentials" ADD CONSTRAINT "ProviderAuthCredentials_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthCredentials" ADD CONSTRAINT "ProviderAuthCredentials_backendOid_fkey" FOREIGN KEY ("backendOid") REFERENCES "Backend"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthCredentials" ADD CONSTRAINT "ProviderAuthCredentials_slateCredentialsOid_fkey" FOREIGN KEY ("slateCredentialsOid") REFERENCES "SlateOAuthCredentials"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthCredentials" ADD CONSTRAINT "ProviderAuthCredentials_shuttleCredentialsOid_fkey" FOREIGN KEY ("shuttleCredentialsOid") REFERENCES "ShuttleOAuthCredentials"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthCredentials" ADD CONSTRAINT "ProviderAuthCredentials_managedCredentialsOid_fkey" FOREIGN KEY ("managedCredentialsOid") REFERENCES "ManagedProviderAuthCredentials"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagedProviderAuthCredentials" ADD CONSTRAINT "ManagedProviderAuthCredentials_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagedProviderAuthCredentials" ADD CONSTRAINT "ManagedProviderAuthCredentials_providerAuthMethodOid_fkey" FOREIGN KEY ("providerAuthMethodOid") REFERENCES "ProviderAuthMethod"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagedProviderAuthCredentials" ADD CONSTRAINT "ManagedProviderAuthCredentials_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagedProviderAuthCredentials" ADD CONSTRAINT "ManagedProviderAuthCredentials_providerAuthMethodGlobalOid_fkey" FOREIGN KEY ("providerAuthMethodGlobalOid") REFERENCES "ProviderAuthMethodGlobal"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagedProviderAuthCredentialsBacking" ADD CONSTRAINT "ManagedProviderAuthCredentialsBacking_managedCredentialsOi_fkey" FOREIGN KEY ("managedCredentialsOid") REFERENCES "ManagedProviderAuthCredentials"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagedProviderAuthCredentialsBacking" ADD CONSTRAINT "ManagedProviderAuthCredentialsBacking_providerAuthCredenti_fkey" FOREIGN KEY ("providerAuthCredentialsOid") REFERENCES "ProviderAuthCredentials"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagedProviderAuthCredentialsBacking" ADD CONSTRAINT "ManagedProviderAuthCredentialsBacking_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagedProviderAuthCredentialsBacking" ADD CONSTRAINT "ManagedProviderAuthCredentialsBacking_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagedProviderAuthCredentialsBacking" ADD CONSTRAINT "ManagedProviderAuthCredentialsBacking_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthConfigEvent" ADD CONSTRAINT "ProviderAuthConfigEvent_authConfigOid_fkey" FOREIGN KEY ("authConfigOid") REFERENCES "ProviderAuthConfig"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthConfigEvent" ADD CONSTRAINT "ProviderAuthConfigEvent_authCredentialsOid_fkey" FOREIGN KEY ("authCredentialsOid") REFERENCES "ProviderAuthCredentials"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthConfigEvent" ADD CONSTRAINT "ProviderAuthConfigEvent_oauthSetupOid_fkey" FOREIGN KEY ("oauthSetupOid") REFERENCES "ProviderOAuthSetup"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthConfigEvent" ADD CONSTRAINT "ProviderAuthConfigEvent_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthConfigEvent" ADD CONSTRAINT "ProviderAuthConfigEvent_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthConfigEvent" ADD CONSTRAINT "ProviderAuthConfigEvent_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthConfigEvent" ADD CONSTRAINT "ProviderAuthConfigEvent_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthConfigEvent" ADD CONSTRAINT "ProviderAuthConfigEvent_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthConfigErrorGlobal" ADD CONSTRAINT "ProviderAuthConfigErrorGlobal_firstOccurrenceOid_fkey" FOREIGN KEY ("firstOccurrenceOid") REFERENCES "ProviderAuthConfigError"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthConfigErrorGlobal" ADD CONSTRAINT "ProviderAuthConfigErrorGlobal_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthConfigErrorGlobal" ADD CONSTRAINT "ProviderAuthConfigErrorGlobal_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthConfigErrorGlobal" ADD CONSTRAINT "ProviderAuthConfigErrorGlobal_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthConfigErrorGlobal" ADD CONSTRAINT "ProviderAuthConfigErrorGlobal_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthConfigErrorGlobal" ADD CONSTRAINT "ProviderAuthConfigErrorGlobal_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthConfigError" ADD CONSTRAINT "ProviderAuthConfigError_groupOid_fkey" FOREIGN KEY ("groupOid") REFERENCES "ProviderAuthConfigErrorGlobal"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthConfigError" ADD CONSTRAINT "ProviderAuthConfigError_authConfigEventOid_fkey" FOREIGN KEY ("authConfigEventOid") REFERENCES "ProviderAuthConfigEvent"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthConfigError" ADD CONSTRAINT "ProviderAuthConfigError_authConfigOid_fkey" FOREIGN KEY ("authConfigOid") REFERENCES "ProviderAuthConfig"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthConfigError" ADD CONSTRAINT "ProviderAuthConfigError_authCredentialsOid_fkey" FOREIGN KEY ("authCredentialsOid") REFERENCES "ProviderAuthCredentials"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthConfigError" ADD CONSTRAINT "ProviderAuthConfigError_oauthSetupOid_fkey" FOREIGN KEY ("oauthSetupOid") REFERENCES "ProviderOAuthSetup"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthConfigError" ADD CONSTRAINT "ProviderAuthConfigError_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthConfigError" ADD CONSTRAINT "ProviderAuthConfigError_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthConfigError" ADD CONSTRAINT "ProviderAuthConfigError_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthConfigError" ADD CONSTRAINT "ProviderAuthConfigError_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthConfigError" ADD CONSTRAINT "ProviderAuthConfigError_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthExport" ADD CONSTRAINT "ProviderAuthExport_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthExport" ADD CONSTRAINT "ProviderAuthExport_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthExport" ADD CONSTRAINT "ProviderAuthExport_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthExport" ADD CONSTRAINT "ProviderAuthExport_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthExport" ADD CONSTRAINT "ProviderAuthExport_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthExport" ADD CONSTRAINT "ProviderAuthExport_authConfigOid_fkey" FOREIGN KEY ("authConfigOid") REFERENCES "ProviderAuthConfig"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthImport" ADD CONSTRAINT "ProviderAuthImport_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthImport" ADD CONSTRAINT "ProviderAuthImport_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthImport" ADD CONSTRAINT "ProviderAuthImport_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthImport" ADD CONSTRAINT "ProviderAuthImport_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthImport" ADD CONSTRAINT "ProviderAuthImport_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthImport" ADD CONSTRAINT "ProviderAuthImport_authConfigOid_fkey" FOREIGN KEY ("authConfigOid") REFERENCES "ProviderAuthConfig"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthImport" ADD CONSTRAINT "ProviderAuthImport_authConfigUpdateOid_fkey" FOREIGN KEY ("authConfigUpdateOid") REFERENCES "ProviderAuthConfigUpdate"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthImport" ADD CONSTRAINT "ProviderAuthImport_deploymentOid_fkey" FOREIGN KEY ("deploymentOid") REFERENCES "ProviderDeployment"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderOAuthSetup" ADD CONSTRAINT "ProviderOAuthSetup_authCredentialsOid_fkey" FOREIGN KEY ("authCredentialsOid") REFERENCES "ProviderAuthCredentials"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderOAuthSetup" ADD CONSTRAINT "ProviderOAuthSetup_authMethodOid_fkey" FOREIGN KEY ("authMethodOid") REFERENCES "ProviderAuthMethod"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderOAuthSetup" ADD CONSTRAINT "ProviderOAuthSetup_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderOAuthSetup" ADD CONSTRAINT "ProviderOAuthSetup_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderOAuthSetup" ADD CONSTRAINT "ProviderOAuthSetup_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderOAuthSetup" ADD CONSTRAINT "ProviderOAuthSetup_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderOAuthSetup" ADD CONSTRAINT "ProviderOAuthSetup_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderOAuthSetup" ADD CONSTRAINT "ProviderOAuthSetup_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderOAuthSetup" ADD CONSTRAINT "ProviderOAuthSetup_deploymentOid_fkey" FOREIGN KEY ("deploymentOid") REFERENCES "ProviderDeployment"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderOAuthSetup" ADD CONSTRAINT "ProviderOAuthSetup_authConfigOid_fkey" FOREIGN KEY ("authConfigOid") REFERENCES "ProviderAuthConfig"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderOAuthSetup" ADD CONSTRAINT "ProviderOAuthSetup_slateOAuthSetupOid_fkey" FOREIGN KEY ("slateOAuthSetupOid") REFERENCES "SlateOAuthSetup"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderOAuthSetup" ADD CONSTRAINT "ProviderOAuthSetup_shuttleOAuthSetupOid_fkey" FOREIGN KEY ("shuttleOAuthSetupOid") REFERENCES "ShuttleOAuthSetup"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderOAuthSetup" ADD CONSTRAINT "ProviderOAuthSetup_ownerPublicMcpServerOid_fkey" FOREIGN KEY ("ownerPublicMcpServerOid") REFERENCES "PublicMcpServer"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShuttleOAuthCredentials" ADD CONSTRAINT "ShuttleOAuthCredentials_shuttleServerOid_fkey" FOREIGN KEY ("shuttleServerOid") REFERENCES "ShuttleServer"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShuttleOAuthCredentials" ADD CONSTRAINT "ShuttleOAuthCredentials_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShuttleOAuthCredentials" ADD CONSTRAINT "ShuttleOAuthCredentials_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShuttleOAuthSetup" ADD CONSTRAINT "ShuttleOAuthSetup_shuttleServerOid_fkey" FOREIGN KEY ("shuttleServerOid") REFERENCES "ShuttleServer"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShuttleOAuthSetup" ADD CONSTRAINT "ShuttleOAuthSetup_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShuttleOAuthSetup" ADD CONSTRAINT "ShuttleOAuthSetup_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShuttleAuthConfig" ADD CONSTRAINT "ShuttleAuthConfig_shuttleServerOid_fkey" FOREIGN KEY ("shuttleServerOid") REFERENCES "ShuttleServer"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShuttleAuthConfig" ADD CONSTRAINT "ShuttleAuthConfig_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShuttleAuthConfig" ADD CONSTRAINT "ShuttleAuthConfig_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShuttleAuthConfig" ADD CONSTRAINT "ShuttleAuthConfig_providerAuthConfigUpdateOid_fkey" FOREIGN KEY ("providerAuthConfigUpdateOid") REFERENCES "ProviderAuthConfigUpdate"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShuttleServerConfig" ADD CONSTRAINT "ShuttleServerConfig_shuttleServerOid_fkey" FOREIGN KEY ("shuttleServerOid") REFERENCES "ShuttleServer"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShuttleServerConfig" ADD CONSTRAINT "ShuttleServerConfig_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShuttleServerConfig" ADD CONSTRAINT "ShuttleServerConfig_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShuttleServerConfig" ADD CONSTRAINT "ShuttleServerConfig_lockedShuttleVersionOid_fkey" FOREIGN KEY ("lockedShuttleVersionOid") REFERENCES "ShuttleServerVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShuttleCustomServer" ADD CONSTRAINT "ShuttleCustomServer_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShuttleCustomServer" ADD CONSTRAINT "ShuttleCustomServer_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShuttleCustomServer" ADD CONSTRAINT "ShuttleCustomServer_serverOid_fkey" FOREIGN KEY ("serverOid") REFERENCES "ShuttleServer"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShuttleCustomServerDeployment" ADD CONSTRAINT "ShuttleCustomServerDeployment_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShuttleCustomServerDeployment" ADD CONSTRAINT "ShuttleCustomServerDeployment_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShuttleCustomServerDeployment" ADD CONSTRAINT "ShuttleCustomServerDeployment_serverOid_fkey" FOREIGN KEY ("serverOid") REFERENCES "ShuttleServer"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShuttleCustomServerDeployment" ADD CONSTRAINT "ShuttleCustomServerDeployment_customServerOid_fkey" FOREIGN KEY ("customServerOid") REFERENCES "ShuttleCustomServer"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShuttleCustomServerDeployment" ADD CONSTRAINT "ShuttleCustomServerDeployment_serverVersionOid_fkey" FOREIGN KEY ("serverVersionOid") REFERENCES "ShuttleServerVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerInstanceConfiguration" ADD CONSTRAINT "ServerInstanceConfiguration_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerInstanceConfiguration" ADD CONSTRAINT "ServerInstanceConfiguration_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerInstanceConfiguration" ADD CONSTRAINT "ServerInstanceConfiguration_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerInstanceConfiguration" ADD CONSTRAINT "ServerInstanceConfiguration_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShuttleConnection" ADD CONSTRAINT "ShuttleConnection_providerRunOid_fkey" FOREIGN KEY ("providerRunOid") REFERENCES "ProviderRun"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShuttleConnection" ADD CONSTRAINT "ShuttleConnection_shuttleServerOid_fkey" FOREIGN KEY ("shuttleServerOid") REFERENCES "ShuttleServer"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShuttleConnection" ADD CONSTRAINT "ShuttleConnection_shuttleServerVersionOid_fkey" FOREIGN KEY ("shuttleServerVersionOid") REFERENCES "ShuttleServerVersion"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShuttleServerVersion" ADD CONSTRAINT "ShuttleServerVersion_serverOid_fkey" FOREIGN KEY ("serverOid") REFERENCES "ShuttleServer"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShuttleSyncChangeNotificationCursor" ADD CONSTRAINT "ShuttleSyncChangeNotificationCursor_backendOid_fkey" FOREIGN KEY ("backendOid") REFERENCES "Backend"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShuttleSyncAuthConfigEventCursor" ADD CONSTRAINT "ShuttleSyncAuthConfigEventCursor_backendOid_fkey" FOREIGN KEY ("backendOid") REFERENCES "Backend"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShuttleSyncOAuthSetupEventCursor" ADD CONSTRAINT "ShuttleSyncOAuthSetupEventCursor_backendOid_fkey" FOREIGN KEY ("backendOid") REFERENCES "Backend"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateOAuthCredentials" ADD CONSTRAINT "SlateOAuthCredentials_slateOid_fkey" FOREIGN KEY ("slateOid") REFERENCES "Slate"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateOAuthCredentials" ADD CONSTRAINT "SlateOAuthCredentials_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateOAuthCredentials" ADD CONSTRAINT "SlateOAuthCredentials_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateOAuthSetup" ADD CONSTRAINT "SlateOAuthSetup_slateOid_fkey" FOREIGN KEY ("slateOid") REFERENCES "Slate"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateOAuthSetup" ADD CONSTRAINT "SlateOAuthSetup_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateOAuthSetup" ADD CONSTRAINT "SlateOAuthSetup_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateAuthConfig" ADD CONSTRAINT "SlateAuthConfig_slateOid_fkey" FOREIGN KEY ("slateOid") REFERENCES "Slate"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateAuthConfig" ADD CONSTRAINT "SlateAuthConfig_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateAuthConfig" ADD CONSTRAINT "SlateAuthConfig_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateAuthConfig" ADD CONSTRAINT "SlateAuthConfig_providerAuthConfigUpdateOid_fkey" FOREIGN KEY ("providerAuthConfigUpdateOid") REFERENCES "ProviderAuthConfigUpdate"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateCallback" ADD CONSTRAINT "SlateCallback_slateOid_fkey" FOREIGN KEY ("slateOid") REFERENCES "Slate"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateCallback" ADD CONSTRAINT "SlateCallback_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateCallback" ADD CONSTRAINT "SlateCallback_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateCallback" ADD CONSTRAINT "SlateCallback_callbackOid_fkey" FOREIGN KEY ("callbackOid") REFERENCES "CallbackV2"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateCallbackInstance" ADD CONSTRAINT "SlateCallbackInstance_slateCallbackOid_fkey" FOREIGN KEY ("slateCallbackOid") REFERENCES "SlateCallback"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateCallbackInstance" ADD CONSTRAINT "SlateCallbackInstance_slateInstanceOid_fkey" FOREIGN KEY ("slateInstanceOid") REFERENCES "SlateInstance"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateCallbackInstance" ADD CONSTRAINT "SlateCallbackInstance_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateCallbackInstance" ADD CONSTRAINT "SlateCallbackInstance_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateCallbackInstance" ADD CONSTRAINT "SlateCallbackInstance_callbackInstanceOid_fkey" FOREIGN KEY ("callbackInstanceOid") REFERENCES "CallbackInstanceV2"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateWebhookRegistration" ADD CONSTRAINT "SlateWebhookRegistration_slateOid_fkey" FOREIGN KEY ("slateOid") REFERENCES "Slate"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateWebhookRegistration" ADD CONSTRAINT "SlateWebhookRegistration_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateWebhookRegistration" ADD CONSTRAINT "SlateWebhookRegistration_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateWebhookRegistration" ADD CONSTRAINT "SlateWebhookRegistration_webhookRegistrationOid_fkey" FOREIGN KEY ("webhookRegistrationOid") REFERENCES "WebhookRegistrationV2"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateTriggerEvent" ADD CONSTRAINT "SlateTriggerEvent_slateCallbackInstanceOid_fkey" FOREIGN KEY ("slateCallbackInstanceOid") REFERENCES "SlateCallbackInstance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateTriggerEvent" ADD CONSTRAINT "SlateTriggerEvent_callbackEventOid_fkey" FOREIGN KEY ("callbackEventOid") REFERENCES "CallbackEventV2"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateInstance" ADD CONSTRAINT "SlateInstance_slateOid_fkey" FOREIGN KEY ("slateOid") REFERENCES "Slate"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateInstance" ADD CONSTRAINT "SlateInstance_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateInstance" ADD CONSTRAINT "SlateInstance_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateInstance" ADD CONSTRAINT "SlateInstance_lockedSlateVersionOid_fkey" FOREIGN KEY ("lockedSlateVersionOid") REFERENCES "SlateVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateInstanceConfiguration" ADD CONSTRAINT "SlateInstanceConfiguration_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateInstanceConfiguration" ADD CONSTRAINT "SlateInstanceConfiguration_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateInstanceConfiguration" ADD CONSTRAINT "SlateInstanceConfiguration_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateInstanceConfiguration" ADD CONSTRAINT "SlateInstanceConfiguration_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateToolCall" ADD CONSTRAINT "SlateToolCall_sessionOid_fkey" FOREIGN KEY ("sessionOid") REFERENCES "SlateSession"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateSession" ADD CONSTRAINT "SlateSession_providerRunOid_fkey" FOREIGN KEY ("providerRunOid") REFERENCES "ProviderRun"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateVersion" ADD CONSTRAINT "SlateVersion_slateOid_fkey" FOREIGN KEY ("slateOid") REFERENCES "Slate"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlatesSyncChangeNotificationCursor" ADD CONSTRAINT "SlatesSyncChangeNotificationCursor_backendOid_fkey" FOREIGN KEY ("backendOid") REFERENCES "Backend"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlatesSyncAuthConfigEventCursor" ADD CONSTRAINT "SlatesSyncAuthConfigEventCursor_backendOid_fkey" FOREIGN KEY ("backendOid") REFERENCES "Backend"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlatesSyncOAuthSetupEventCursor" ADD CONSTRAINT "SlatesSyncOAuthSetupEventCursor_backendOid_fkey" FOREIGN KEY ("backendOid") REFERENCES "Backend"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallbackV2" ADD CONSTRAINT "CallbackV2_managedAdapterGlobalOid_fkey" FOREIGN KEY ("managedAdapterGlobalOid") REFERENCES "ProviderAdapterGlobal"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallbackV2" ADD CONSTRAINT "CallbackV2_integrationOid_fkey" FOREIGN KEY ("integrationOid") REFERENCES "Integration"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallbackV2" ADD CONSTRAINT "CallbackV2_integrationProviderOid_fkey" FOREIGN KEY ("integrationProviderOid") REFERENCES "IntegrationProvider"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallbackV2" ADD CONSTRAINT "CallbackV2_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallbackV2" ADD CONSTRAINT "CallbackV2_providerVariantOid_fkey" FOREIGN KEY ("providerVariantOid") REFERENCES "ProviderVariant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallbackV2" ADD CONSTRAINT "CallbackV2_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallbackV2" ADD CONSTRAINT "CallbackV2_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallbackV2" ADD CONSTRAINT "CallbackV2_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallbackV2" ADD CONSTRAINT "CallbackV2_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallbackV2" ADD CONSTRAINT "CallbackV2_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallbackEventV2" ADD CONSTRAINT "CallbackEventV2_providerTriggerOid_fkey" FOREIGN KEY ("providerTriggerOid") REFERENCES "ProviderTrigger"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallbackEventV2" ADD CONSTRAINT "CallbackEventV2_callbackOid_fkey" FOREIGN KEY ("callbackOid") REFERENCES "CallbackV2"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallbackEventV2" ADD CONSTRAINT "CallbackEventV2_callbackInstanceOid_fkey" FOREIGN KEY ("callbackInstanceOid") REFERENCES "CallbackInstanceV2"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallbackEventV2" ADD CONSTRAINT "CallbackEventV2_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallbackEventV2" ADD CONSTRAINT "CallbackEventV2_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallbackEventV2" ADD CONSTRAINT "CallbackEventV2_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallbackEventV2" ADD CONSTRAINT "CallbackEventV2_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallbackEventV2" ADD CONSTRAINT "CallbackEventV2_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallbackInstanceV2" ADD CONSTRAINT "CallbackInstanceV2_callbackOid_fkey" FOREIGN KEY ("callbackOid") REFERENCES "CallbackV2"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallbackInstanceV2" ADD CONSTRAINT "CallbackInstanceV2_integrationInstanceOid_fkey" FOREIGN KEY ("integrationInstanceOid") REFERENCES "IntegrationInstance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallbackInstanceV2" ADD CONSTRAINT "CallbackInstanceV2_integrationInstanceProviderOid_fkey" FOREIGN KEY ("integrationInstanceProviderOid") REFERENCES "IntegrationInstanceProvider"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallbackInstanceV2" ADD CONSTRAINT "CallbackInstanceV2_providerConfigVersionOid_fkey" FOREIGN KEY ("providerConfigVersionOid") REFERENCES "ProviderConfigVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallbackInstanceV2" ADD CONSTRAINT "CallbackInstanceV2_providerAuthConfigVersionOid_fkey" FOREIGN KEY ("providerAuthConfigVersionOid") REFERENCES "ProviderAuthConfigVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallbackInstanceV2" ADD CONSTRAINT "CallbackInstanceV2_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallbackInstanceV2" ADD CONSTRAINT "CallbackInstanceV2_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallbackInstanceV2" ADD CONSTRAINT "CallbackInstanceV2_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallbackInstanceV2" ADD CONSTRAINT "CallbackInstanceV2_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallbackInstanceV2" ADD CONSTRAINT "CallbackInstanceV2_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookRegistrationV2" ADD CONSTRAINT "WebhookRegistrationV2_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookRegistrationV2" ADD CONSTRAINT "WebhookRegistrationV2_providerVariantOid_fkey" FOREIGN KEY ("providerVariantOid") REFERENCES "ProviderVariant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookRegistrationV2" ADD CONSTRAINT "WebhookRegistrationV2_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookRegistrationV2" ADD CONSTRAINT "WebhookRegistrationV2_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookRegistrationV2" ADD CONSTRAINT "WebhookRegistrationV2_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookRegistrationV2" ADD CONSTRAINT "WebhookRegistrationV2_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookRegistrationV2" ADD CONSTRAINT "WebhookRegistrationV2_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatAuthor" ADD CONSTRAINT "ChatAuthor_chatOid_fkey" FOREIGN KEY ("chatOid") REFERENCES "Chat"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatWorkspace" ADD CONSTRAINT "ChatWorkspace_chatOid_fkey" FOREIGN KEY ("chatOid") REFERENCES "Chat"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatWorkspace" ADD CONSTRAINT "cws_ciip_fkey" FOREIGN KEY ("chatInstanceProviderOid") REFERENCES "ChatInstanceProvider"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatChannel" ADD CONSTRAINT "ChatChannel_chatOid_fkey" FOREIGN KEY ("chatOid") REFERENCES "Chat"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatChannel" ADD CONSTRAINT "ChatChannel_workspaceOid_fkey" FOREIGN KEY ("workspaceOid") REFERENCES "ChatWorkspace"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatChannel" ADD CONSTRAINT "ChatChannel_recipientOid_fkey" FOREIGN KEY ("recipientOid") REFERENCES "ChatAuthor"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatThread" ADD CONSTRAINT "ChatThread_channelOid_fkey" FOREIGN KEY ("channelOid") REFERENCES "ChatChannel"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatThread" ADD CONSTRAINT "ChatThread_chatOid_fkey" FOREIGN KEY ("chatOid") REFERENCES "Chat"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_chatConnectionOid_fkey" FOREIGN KEY ("chatConnectionOid") REFERENCES "ChatConnection"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_chatInstanceOid_fkey" FOREIGN KEY ("chatInstanceOid") REFERENCES "ChatInstance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_chatInstanceProviderOid_fkey" FOREIGN KEY ("chatInstanceProviderOid") REFERENCES "ChatInstanceProvider"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_adapterOid_fkey" FOREIGN KEY ("adapterOid") REFERENCES "ProviderAdapter"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatConnection" ADD CONSTRAINT "ChatConnection_adapterIntegrationOid_fkey" FOREIGN KEY ("adapterIntegrationOid") REFERENCES "AdapterIntegration"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatConnection" ADD CONSTRAINT "ChatConnection_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatConnection" ADD CONSTRAINT "ChatConnection_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatConnection" ADD CONSTRAINT "ChatConnection_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatConnection" ADD CONSTRAINT "ChatConnection_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatConnection" ADD CONSTRAINT "ChatConnection_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatConnectionProvider" ADD CONSTRAINT "ChatConnectionProvider_chatConnectionOid_fkey" FOREIGN KEY ("chatConnectionOid") REFERENCES "ChatConnection"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatConnectionProvider" ADD CONSTRAINT "ChatConnectionProvider_adapterIntegrationOid_fkey" FOREIGN KEY ("adapterIntegrationOid") REFERENCES "AdapterIntegration"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatConnectionProvider" ADD CONSTRAINT "ChatConnectionProvider_adapterIntegrationProviderOid_fkey" FOREIGN KEY ("adapterIntegrationProviderOid") REFERENCES "AdapterIntegrationProvider"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatConnectionProvider" ADD CONSTRAINT "ChatConnectionProvider_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatConnectionProvider" ADD CONSTRAINT "ChatConnectionProvider_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatConnectionProvider" ADD CONSTRAINT "ChatConnectionProvider_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatConnectionProvider" ADD CONSTRAINT "ChatConnectionProvider_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatConnectionProvider" ADD CONSTRAINT "ChatConnectionProvider_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatEvent" ADD CONSTRAINT "ChatEvent_sessionMessageOid_fkey" FOREIGN KEY ("sessionMessageOid") REFERENCES "SessionMessage"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatEvent" ADD CONSTRAINT "ChatEvent_chatOid_fkey" FOREIGN KEY ("chatOid") REFERENCES "Chat"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatEvent" ADD CONSTRAINT "ChatEvent_chatConnectionOid_fkey" FOREIGN KEY ("chatConnectionOid") REFERENCES "ChatConnection"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatEvent" ADD CONSTRAINT "ChatEvent_chatInstanceOid_fkey" FOREIGN KEY ("chatInstanceOid") REFERENCES "ChatInstance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatEvent" ADD CONSTRAINT "chevt_ciip_fkey" FOREIGN KEY ("chatInstanceProviderOid") REFERENCES "ChatInstanceProvider"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatEvent" ADD CONSTRAINT "ChatEvent_channelOid_fkey" FOREIGN KEY ("channelOid") REFERENCES "ChatChannel"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatEvent" ADD CONSTRAINT "ChatEvent_threadOid_fkey" FOREIGN KEY ("threadOid") REFERENCES "ChatThread"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatEvent" ADD CONSTRAINT "ChatEvent_messageOid_fkey" FOREIGN KEY ("messageOid") REFERENCES "ChatMessage"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatEvent" ADD CONSTRAINT "ChatEvent_authorOid_fkey" FOREIGN KEY ("authorOid") REFERENCES "ChatAuthor"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatEvent" ADD CONSTRAINT "ChatEvent_callbackEventOid_fkey" FOREIGN KEY ("callbackEventOid") REFERENCES "CallbackEventV2"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatEvent" ADD CONSTRAINT "ChatEvent_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatEvent" ADD CONSTRAINT "ChatEvent_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatEvent" ADD CONSTRAINT "ChatEvent_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatEvent" ADD CONSTRAINT "ChatEvent_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatEvent" ADD CONSTRAINT "ChatEvent_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatInstance" ADD CONSTRAINT "ChatInstance_chatConnectionOid_fkey" FOREIGN KEY ("chatConnectionOid") REFERENCES "ChatConnection"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatInstance" ADD CONSTRAINT "ChatInstance_adapterIntegrationInstanceOid_fkey" FOREIGN KEY ("adapterIntegrationInstanceOid") REFERENCES "AdapterIntegrationInstance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatInstance" ADD CONSTRAINT "ChatInstance_adapterIntegrationOid_fkey" FOREIGN KEY ("adapterIntegrationOid") REFERENCES "AdapterIntegration"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatInstance" ADD CONSTRAINT "ChatInstance_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatInstance" ADD CONSTRAINT "ChatInstance_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatInstance" ADD CONSTRAINT "ChatInstance_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatInstance" ADD CONSTRAINT "ChatInstance_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatInstance" ADD CONSTRAINT "ChatInstance_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatInstanceProvider" ADD CONSTRAINT "ChatInstanceProvider_chatInstanceOid_fkey" FOREIGN KEY ("chatInstanceOid") REFERENCES "ChatInstance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatInstanceProvider" ADD CONSTRAINT "ChatInstanceProvider_chatConnectionProviderOid_fkey" FOREIGN KEY ("chatConnectionProviderOid") REFERENCES "ChatConnectionProvider"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatInstanceProvider" ADD CONSTRAINT "ChatInstanceProvider_chatConnectionOid_fkey" FOREIGN KEY ("chatConnectionOid") REFERENCES "ChatConnection"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatInstanceProvider" ADD CONSTRAINT "ChatInstanceProvider_authorOid_fkey" FOREIGN KEY ("authorOid") REFERENCES "ChatAuthor"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatInstanceProvider" ADD CONSTRAINT "ciip_aiip_fkey" FOREIGN KEY ("adapterIntegrationInstanceProviderOid") REFERENCES "AdapterIntegrationInstanceProvider"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatInstanceProvider" ADD CONSTRAINT "ciip_aii_fkey" FOREIGN KEY ("adapterIntegrationInstanceOid") REFERENCES "AdapterIntegrationInstance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatInstanceProvider" ADD CONSTRAINT "ciip_aip_fkey" FOREIGN KEY ("adapterIntegrationProviderOid") REFERENCES "AdapterIntegrationProvider"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatInstanceProvider" ADD CONSTRAINT "ciip_ain_fkey" FOREIGN KEY ("adapterIntegrationOid") REFERENCES "AdapterIntegration"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatInstanceProvider" ADD CONSTRAINT "ChatInstanceProvider_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatInstanceProvider" ADD CONSTRAINT "ChatInstanceProvider_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatInstanceProvider" ADD CONSTRAINT "ChatInstanceProvider_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatInstanceProvider" ADD CONSTRAINT "ChatInstanceProvider_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatInstanceProvider" ADD CONSTRAINT "ChatInstanceProvider_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_channelOid_fkey" FOREIGN KEY ("channelOid") REFERENCES "ChatChannel"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_threadOid_fkey" FOREIGN KEY ("threadOid") REFERENCES "ChatThread"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_authorOid_fkey" FOREIGN KEY ("authorOid") REFERENCES "ChatAuthor"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_groupOid_fkey" FOREIGN KEY ("groupOid") REFERENCES "ChatMessageGroup"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessageGroup" ADD CONSTRAINT "ChatMessageGroup_channelOid_fkey" FOREIGN KEY ("channelOid") REFERENCES "ChatChannel"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessageGroup" ADD CONSTRAINT "ChatMessageGroup_primaryMessageOid_fkey" FOREIGN KEY ("primaryMessageOid") REFERENCES "ChatMessage"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessageAttachment" ADD CONSTRAINT "ChatMessageAttachment_messageOid_fkey" FOREIGN KEY ("messageOid") REFERENCES "ChatMessage"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessageAttachment" ADD CONSTRAINT "ChatMessageAttachment_toolCallAttachmentOid_fkey" FOREIGN KEY ("toolCallAttachmentOid") REFERENCES "ToolCallAttachment"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomProviderCommit" ADD CONSTRAINT "CustomProviderCommit_creatorActorOid_fkey" FOREIGN KEY ("creatorActorOid") REFERENCES "Actor"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomProviderCommit" ADD CONSTRAINT "CustomProviderCommit_fromEnvironmentOid_fkey" FOREIGN KEY ("fromEnvironmentOid") REFERENCES "CustomProviderEnvironment"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomProviderCommit" ADD CONSTRAINT "CustomProviderCommit_toEnvironmentOid_fkey" FOREIGN KEY ("toEnvironmentOid") REFERENCES "CustomProviderEnvironment"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomProviderCommit" ADD CONSTRAINT "CustomProviderCommit_toEnvironmentVersionBeforeOid_fkey" FOREIGN KEY ("toEnvironmentVersionBeforeOid") REFERENCES "CustomProviderVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomProviderCommit" ADD CONSTRAINT "CustomProviderCommit_targetCustomProviderVersionOid_fkey" FOREIGN KEY ("targetCustomProviderVersionOid") REFERENCES "CustomProviderVersion"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomProviderCommit" ADD CONSTRAINT "CustomProviderCommit_customProviderOid_fkey" FOREIGN KEY ("customProviderOid") REFERENCES "CustomProvider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomProviderCommit" ADD CONSTRAINT "CustomProviderCommit_scmRepoPushOid_fkey" FOREIGN KEY ("scmRepoPushOid") REFERENCES "ScmRepoPush"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomProviderCommit" ADD CONSTRAINT "CustomProviderCommit_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomProviderCommit" ADD CONSTRAINT "CustomProviderCommit_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomProviderCommit" ADD CONSTRAINT "CustomProviderCommit_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomProviderDeployment" ADD CONSTRAINT "CustomProviderDeployment_creatorActorOid_fkey" FOREIGN KEY ("creatorActorOid") REFERENCES "Actor"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomProviderDeployment" ADD CONSTRAINT "CustomProviderDeployment_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomProviderDeployment" ADD CONSTRAINT "CustomProviderDeployment_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomProviderDeployment" ADD CONSTRAINT "CustomProviderDeployment_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomProviderDeployment" ADD CONSTRAINT "CustomProviderDeployment_customProviderOid_fkey" FOREIGN KEY ("customProviderOid") REFERENCES "CustomProvider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomProviderDeployment" ADD CONSTRAINT "CustomProviderDeployment_sourceEnvironmentOid_fkey" FOREIGN KEY ("sourceEnvironmentOid") REFERENCES "CustomProviderEnvironment"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomProviderDeployment" ADD CONSTRAINT "CustomProviderDeployment_commitOid_fkey" FOREIGN KEY ("commitOid") REFERENCES "CustomProviderCommit"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomProviderDeployment" ADD CONSTRAINT "CustomProviderDeployment_shuttleServerVersionOid_fkey" FOREIGN KEY ("shuttleServerVersionOid") REFERENCES "ShuttleServerVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomProviderDeployment" ADD CONSTRAINT "CustomProviderDeployment_shuttleCustomServerOid_fkey" FOREIGN KEY ("shuttleCustomServerOid") REFERENCES "ShuttleCustomServer"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomProviderDeployment" ADD CONSTRAINT "CustomProviderDeployment_shuttleCustomServerDeploymentOid_fkey" FOREIGN KEY ("shuttleCustomServerDeploymentOid") REFERENCES "ShuttleCustomServerDeployment"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomProviderDeployment" ADD CONSTRAINT "CustomProviderDeployment_scmRepoOid_fkey" FOREIGN KEY ("scmRepoOid") REFERENCES "ScmRepo"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomProviderDeployment" ADD CONSTRAINT "CustomProviderDeployment_immutableCodeBucketOid_fkey" FOREIGN KEY ("immutableCodeBucketOid") REFERENCES "CodeBucket"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomProviderDeployment" ADD CONSTRAINT "CustomProviderDeployment_scmRepoPushOid_fkey" FOREIGN KEY ("scmRepoPushOid") REFERENCES "ScmRepoPush"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomProviderEnvironment" ADD CONSTRAINT "CustomProviderEnvironment_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomProviderEnvironment" ADD CONSTRAINT "CustomProviderEnvironment_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomProviderEnvironment" ADD CONSTRAINT "CustomProviderEnvironment_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomProviderEnvironment" ADD CONSTRAINT "CustomProviderEnvironment_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomProviderEnvironment" ADD CONSTRAINT "CustomProviderEnvironment_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomProviderEnvironment" ADD CONSTRAINT "CustomProviderEnvironment_providerEnvironmentOid_fkey" FOREIGN KEY ("providerEnvironmentOid") REFERENCES "ProviderEnvironment"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomProviderEnvironment" ADD CONSTRAINT "CustomProviderEnvironment_customProviderOid_fkey" FOREIGN KEY ("customProviderOid") REFERENCES "CustomProvider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomProviderEnvironmentVersion" ADD CONSTRAINT "CustomProviderEnvironmentVersion_customProviderEnvironment_fkey" FOREIGN KEY ("customProviderEnvironmentOid") REFERENCES "CustomProviderEnvironment"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomProviderEnvironmentVersion" ADD CONSTRAINT "CustomProviderEnvironmentVersion_customProviderVersionOid_fkey" FOREIGN KEY ("customProviderVersionOid") REFERENCES "CustomProviderVersion"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomProviderEnvironmentVersion" ADD CONSTRAINT "CustomProviderEnvironmentVersion_providerEnvironmentVersio_fkey" FOREIGN KEY ("providerEnvironmentVersionOid") REFERENCES "ProviderEnvironmentVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomProviderEnvironmentVersion" ADD CONSTRAINT "CustomProviderEnvironmentVersion_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomProviderEnvironmentVersion" ADD CONSTRAINT "CustomProviderEnvironmentVersion_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomProviderEnvironmentVersion" ADD CONSTRAINT "CustomProviderEnvironmentVersion_commitOid_fkey" FOREIGN KEY ("commitOid") REFERENCES "CustomProviderCommit"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomProvider" ADD CONSTRAINT "CustomProvider_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomProvider" ADD CONSTRAINT "CustomProvider_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomProvider" ADD CONSTRAINT "CustomProvider_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomProvider" ADD CONSTRAINT "CustomProvider_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomProvider" ADD CONSTRAINT "CustomProvider_providerVariantOid_fkey" FOREIGN KEY ("providerVariantOid") REFERENCES "ProviderVariant"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomProvider" ADD CONSTRAINT "CustomProvider_shuttleCustomServerOid_fkey" FOREIGN KEY ("shuttleCustomServerOid") REFERENCES "ShuttleCustomServer"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomProvider" ADD CONSTRAINT "CustomProvider_scmRepoOid_fkey" FOREIGN KEY ("scmRepoOid") REFERENCES "ScmRepo"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomProvider" ADD CONSTRAINT "CustomProvider_draftCodeBucketOid_fkey" FOREIGN KEY ("draftCodeBucketOid") REFERENCES "CodeBucket"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UpcomingCustomProvider" ADD CONSTRAINT "UpcomingCustomProvider_customProviderOid_fkey" FOREIGN KEY ("customProviderOid") REFERENCES "CustomProvider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UpcomingCustomProvider" ADD CONSTRAINT "UpcomingCustomProvider_customProviderDeploymentOid_fkey" FOREIGN KEY ("customProviderDeploymentOid") REFERENCES "CustomProviderDeployment"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UpcomingCustomProvider" ADD CONSTRAINT "UpcomingCustomProvider_customProviderVersionOid_fkey" FOREIGN KEY ("customProviderVersionOid") REFERENCES "CustomProviderVersion"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UpcomingCustomProvider" ADD CONSTRAINT "UpcomingCustomProvider_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UpcomingCustomProvider" ADD CONSTRAINT "UpcomingCustomProvider_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UpcomingCustomProvider" ADD CONSTRAINT "UpcomingCustomProvider_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UpcomingCustomProvider" ADD CONSTRAINT "UpcomingCustomProvider_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UpcomingCustomProvider" ADD CONSTRAINT "UpcomingCustomProvider_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UpcomingCustomProvider" ADD CONSTRAINT "UpcomingCustomProvider_actorOid_fkey" FOREIGN KEY ("actorOid") REFERENCES "Actor"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomProviderVersion" ADD CONSTRAINT "CustomProviderVersion_creatorActorOid_fkey" FOREIGN KEY ("creatorActorOid") REFERENCES "Actor"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomProviderVersion" ADD CONSTRAINT "CustomProviderVersion_customProviderOid_fkey" FOREIGN KEY ("customProviderOid") REFERENCES "CustomProvider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomProviderVersion" ADD CONSTRAINT "CustomProviderVersion_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomProviderVersion" ADD CONSTRAINT "CustomProviderVersion_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomProviderVersion" ADD CONSTRAINT "CustomProviderVersion_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomProviderVersion" ADD CONSTRAINT "CustomProviderVersion_providerVersionOid_fkey" FOREIGN KEY ("providerVersionOid") REFERENCES "ProviderVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomProviderVersion" ADD CONSTRAINT "CustomProviderVersion_deploymentOid_fkey" FOREIGN KEY ("deploymentOid") REFERENCES "CustomProviderDeployment"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomProviderVersion" ADD CONSTRAINT "CustomProviderVersion_shuttleServerVersionOid_fkey" FOREIGN KEY ("shuttleServerVersionOid") REFERENCES "ShuttleServerVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomProviderVersion" ADD CONSTRAINT "CustomProviderVersion_shuttleCustomServerOid_fkey" FOREIGN KEY ("shuttleCustomServerOid") REFERENCES "ShuttleCustomServer"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomProviderVersion" ADD CONSTRAINT "CustomProviderVersion_shuttleCustomServerDeploymentOid_fkey" FOREIGN KEY ("shuttleCustomServerDeploymentOid") REFERENCES "ShuttleCustomServerDeployment"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomProviderVersion" ADD CONSTRAINT "CustomProviderVersion_scmRepoOid_fkey" FOREIGN KEY ("scmRepoOid") REFERENCES "ScmRepo"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomProviderVersion" ADD CONSTRAINT "CustomProviderVersion_immutableCodeBucketOid_fkey" FOREIGN KEY ("immutableCodeBucketOid") REFERENCES "CodeBucket"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderConfig" ADD CONSTRAINT "ProviderConfig_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderConfig" ADD CONSTRAINT "ProviderConfig_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderConfig" ADD CONSTRAINT "ProviderConfig_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderConfig" ADD CONSTRAINT "ProviderConfig_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderConfig" ADD CONSTRAINT "ProviderConfig_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderConfig" ADD CONSTRAINT "ProviderConfig_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderConfig" ADD CONSTRAINT "ProviderConfig_specificationOid_fkey" FOREIGN KEY ("specificationOid") REFERENCES "ProviderSpecification"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderConfig" ADD CONSTRAINT "ProviderConfig_owningIntegrationInstanceOid_fkey" FOREIGN KEY ("owningIntegrationInstanceOid") REFERENCES "IntegrationInstance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderConfig" ADD CONSTRAINT "ProviderConfig_owningIntegrationInstanceProviderOid_fkey" FOREIGN KEY ("owningIntegrationInstanceProviderOid") REFERENCES "IntegrationInstanceProvider"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderConfig" ADD CONSTRAINT "ProviderConfig_ownerActorOid_fkey" FOREIGN KEY ("ownerActorOid") REFERENCES "IdentityActor"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderConfig" ADD CONSTRAINT "ProviderConfig_deploymentOid_fkey" FOREIGN KEY ("deploymentOid") REFERENCES "ProviderDeployment"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderConfig" ADD CONSTRAINT "ProviderConfig_fromVaultOid_fkey" FOREIGN KEY ("fromVaultOid") REFERENCES "ProviderConfigVault"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderConfig" ADD CONSTRAINT "ProviderConfig_parentConfigOid_fkey" FOREIGN KEY ("parentConfigOid") REFERENCES "ProviderConfig"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderConfig" ADD CONSTRAINT "ProviderConfig_currentVersionOid_fkey" FOREIGN KEY ("currentVersionOid") REFERENCES "ProviderConfigVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderConfig" ADD CONSTRAINT "ProviderConfig_ownerPublicMcpServerOid_fkey" FOREIGN KEY ("ownerPublicMcpServerOid") REFERENCES "PublicMcpServer"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderConfigVersion" ADD CONSTRAINT "ProviderConfigVersion_configOid_fkey" FOREIGN KEY ("configOid") REFERENCES "ProviderConfig"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderConfigVersion" ADD CONSTRAINT "ProviderConfigVersion_slateInstanceOid_fkey" FOREIGN KEY ("slateInstanceOid") REFERENCES "SlateInstance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderConfigVersion" ADD CONSTRAINT "ProviderConfigVersion_shuttleConfigOid_fkey" FOREIGN KEY ("shuttleConfigOid") REFERENCES "ShuttleServerConfig"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderConfigUpdate" ADD CONSTRAINT "ProviderConfigUpdate_configOid_fkey" FOREIGN KEY ("configOid") REFERENCES "ProviderConfig"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderConfigUpdate" ADD CONSTRAINT "ProviderConfigUpdate_fromVersionOid_fkey" FOREIGN KEY ("fromVersionOid") REFERENCES "ProviderConfigVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderConfigUpdate" ADD CONSTRAINT "ProviderConfigUpdate_toVersionOid_fkey" FOREIGN KEY ("toVersionOid") REFERENCES "ProviderConfigVersion"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderDeployment" ADD CONSTRAINT "ProviderDeployment_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderDeployment" ADD CONSTRAINT "ProviderDeployment_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderDeployment" ADD CONSTRAINT "ProviderDeployment_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderDeployment" ADD CONSTRAINT "ProviderDeployment_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderDeployment" ADD CONSTRAINT "ProviderDeployment_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderDeployment" ADD CONSTRAINT "ProviderDeployment_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderDeployment" ADD CONSTRAINT "ProviderDeployment_providerVariantOid_fkey" FOREIGN KEY ("providerVariantOid") REFERENCES "ProviderVariant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderDeployment" ADD CONSTRAINT "ProviderDeployment_defaultConfigOid_fkey" FOREIGN KEY ("defaultConfigOid") REFERENCES "ProviderConfig"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderDeployment" ADD CONSTRAINT "ProviderDeployment_defaultAuthConfigOid_fkey" FOREIGN KEY ("defaultAuthConfigOid") REFERENCES "ProviderAuthConfig"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderDeployment" ADD CONSTRAINT "ProviderDeployment_currentVersionOid_fkey" FOREIGN KEY ("currentVersionOid") REFERENCES "ProviderDeploymentVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderDeployment" ADD CONSTRAINT "ProviderDeployment_slateInstanceConfigurationOid_fkey" FOREIGN KEY ("slateInstanceConfigurationOid") REFERENCES "SlateInstanceConfiguration"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderDeployment" ADD CONSTRAINT "ProviderDeployment_serverInstanceConfigurationOid_fkey" FOREIGN KEY ("serverInstanceConfigurationOid") REFERENCES "ServerInstanceConfiguration"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderDeploymentVersion" ADD CONSTRAINT "ProviderDeploymentVersion_providerVariantOid_fkey" FOREIGN KEY ("providerVariantOid") REFERENCES "ProviderVariant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderDeploymentVersion" ADD CONSTRAINT "ProviderDeploymentVersion_lockedVersionOid_fkey" FOREIGN KEY ("lockedVersionOid") REFERENCES "ProviderVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderDeploymentVersion" ADD CONSTRAINT "ProviderDeploymentVersion_deploymentOid_fkey" FOREIGN KEY ("deploymentOid") REFERENCES "ProviderDeployment"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantOAuthCallbackUrl" ADD CONSTRAINT "TenantOAuthCallbackUrl_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantOAuthCallbackUrl" ADD CONSTRAINT "TenantOAuthCallbackUrl_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantOAuthCallbackUrl" ADD CONSTRAINT "TenantOAuthCallbackUrl_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantOAuthCallbackUrl" ADD CONSTRAINT "TenantOAuthCallbackUrl_providerTypeOid_fkey" FOREIGN KEY ("providerTypeOid") REFERENCES "ProviderType"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderDeploymentConfigPair" ADD CONSTRAINT "ProviderDeploymentConfigPair_providerDeploymentVersionOid_fkey" FOREIGN KEY ("providerDeploymentVersionOid") REFERENCES "ProviderDeploymentVersion"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderDeploymentConfigPair" ADD CONSTRAINT "ProviderDeploymentConfigPair_providerConfigVersionOid_fkey" FOREIGN KEY ("providerConfigVersionOid") REFERENCES "ProviderConfigVersion"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderDeploymentConfigPair" ADD CONSTRAINT "ProviderDeploymentConfigPair_providerAuthConfigVersionOid_fkey" FOREIGN KEY ("providerAuthConfigVersionOid") REFERENCES "ProviderAuthConfigVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderDeploymentConfigPair" ADD CONSTRAINT "ProviderDeploymentConfigPair_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderDeploymentConfigPair" ADD CONSTRAINT "ProviderDeploymentConfigPair_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderDeploymentConfigPair" ADD CONSTRAINT "ProviderDeploymentConfigPair_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderDeploymentConfigPair" ADD CONSTRAINT "ProviderDeploymentConfigPair_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderDeploymentConfigPair" ADD CONSTRAINT "ProviderDeploymentConfigPair_lastUsedPairVersionOid_fkey" FOREIGN KEY ("lastUsedPairVersionOid") REFERENCES "ProviderDeploymentConfigPairProviderVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderDeploymentConfigPairProviderVersion" ADD CONSTRAINT "ProviderDeploymentConfigPairProviderVersion_pairOid_fkey" FOREIGN KEY ("pairOid") REFERENCES "ProviderDeploymentConfigPair"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderDeploymentConfigPairProviderVersion" ADD CONSTRAINT "ProviderDeploymentConfigPairProviderVersion_versionOid_fkey" FOREIGN KEY ("versionOid") REFERENCES "ProviderVersion"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderDeploymentConfigPairProviderVersion" ADD CONSTRAINT "ProviderDeploymentConfigPairProviderVersion_latestDiscover_fkey" FOREIGN KEY ("latestDiscoveryRecordOid") REFERENCES "ProviderDeploymentConfigPairDiscovery"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderDeploymentConfigPairProviderVersion" ADD CONSTRAINT "ProviderDeploymentConfigPairProviderVersion_previousPairVe_fkey" FOREIGN KEY ("previousPairVersionOid") REFERENCES "ProviderDeploymentConfigPairProviderVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderDeploymentConfigPairProviderVersion" ADD CONSTRAINT "ProviderDeploymentConfigPairProviderVersion_specificationO_fkey" FOREIGN KEY ("specificationOid") REFERENCES "ProviderSpecification"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderDeploymentConfigPairSpecificationChange" ADD CONSTRAINT "ProviderDeploymentConfigPairSpecificationChange_fromSpecif_fkey" FOREIGN KEY ("fromSpecificationOid") REFERENCES "ProviderSpecification"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderDeploymentConfigPairSpecificationChange" ADD CONSTRAINT "ProviderDeploymentConfigPairSpecificationChange_toSpecific_fkey" FOREIGN KEY ("toSpecificationOid") REFERENCES "ProviderSpecification"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderDeploymentConfigPairSpecificationChange" ADD CONSTRAINT "ProviderDeploymentConfigPairSpecificationChange_fromPairVe_fkey" FOREIGN KEY ("fromPairVersionOid") REFERENCES "ProviderDeploymentConfigPairProviderVersion"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderDeploymentConfigPairSpecificationChange" ADD CONSTRAINT "ProviderDeploymentConfigPairSpecificationChange_toPairVers_fkey" FOREIGN KEY ("toPairVersionOid") REFERENCES "ProviderDeploymentConfigPairProviderVersion"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderDeploymentConfigPairDiscovery" ADD CONSTRAINT "ProviderDeploymentConfigPairDiscovery_pairOid_fkey" FOREIGN KEY ("pairOid") REFERENCES "ProviderDeploymentConfigPair"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderDeploymentConfigPairDiscovery" ADD CONSTRAINT "ProviderDeploymentConfigPairDiscovery_versionOid_fkey" FOREIGN KEY ("versionOid") REFERENCES "ProviderVersion"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvironmentProvider" ADD CONSTRAINT "EnvironmentProvider_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvironmentProvider" ADD CONSTRAINT "EnvironmentProvider_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvironmentProvider" ADD CONSTRAINT "EnvironmentProvider_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvironmentProvider" ADD CONSTRAINT "EnvironmentProvider_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvironmentProvider" ADD CONSTRAINT "EnvironmentProvider_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvironmentProvider" ADD CONSTRAINT "EnvironmentProvider_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderConfigVault" ADD CONSTRAINT "ProviderConfigVault_configOid_fkey" FOREIGN KEY ("configOid") REFERENCES "ProviderConfig"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderConfigVault" ADD CONSTRAINT "ProviderConfigVault_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderConfigVault" ADD CONSTRAINT "ProviderConfigVault_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderConfigVault" ADD CONSTRAINT "ProviderConfigVault_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderConfigVault" ADD CONSTRAINT "ProviderConfigVault_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderConfigVault" ADD CONSTRAINT "ProviderConfigVault_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderConfigVault" ADD CONSTRAINT "ProviderConfigVault_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderConfigVault" ADD CONSTRAINT "ProviderConfigVault_deploymentOid_fkey" FOREIGN KEY ("deploymentOid") REFERENCES "ProviderDeployment"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnclaveEnvironment" ADD CONSTRAINT "EnclaveEnvironment_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnclaveEnvironment" ADD CONSTRAINT "EnclaveEnvironment_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enclave" ADD CONSTRAINT "Enclave_enclaveEnvironmentOid_fkey" FOREIGN KEY ("enclaveEnvironmentOid") REFERENCES "EnclaveEnvironment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enclave" ADD CONSTRAINT "Enclave_providerDeploymentOid_fkey" FOREIGN KEY ("providerDeploymentOid") REFERENCES "ProviderDeployment"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enclave" ADD CONSTRAINT "Enclave_networkOid_fkey" FOREIGN KEY ("networkOid") REFERENCES "Network"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enclave" ADD CONSTRAINT "Enclave_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enclave" ADD CONSTRAINT "Enclave_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enclave" ADD CONSTRAINT "Enclave_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enclave" ADD CONSTRAINT "Enclave_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Network" ADD CONSTRAINT "Network_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Network" ADD CONSTRAINT "Network_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Network" ADD CONSTRAINT "Network_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Network" ADD CONSTRAINT "Network_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Firewall" ADD CONSTRAINT "Firewall_networkOid_fkey" FOREIGN KEY ("networkOid") REFERENCES "Network"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Firewall" ADD CONSTRAINT "Firewall_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Firewall" ADD CONSTRAINT "Firewall_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Firewall" ADD CONSTRAINT "Firewall_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Firewall" ADD CONSTRAINT "Firewall_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirewallBinding" ADD CONSTRAINT "FirewallBinding_firewallOid_fkey" FOREIGN KEY ("firewallOid") REFERENCES "Firewall"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirewallBinding" ADD CONSTRAINT "FirewallBinding_enclaveOid_fkey" FOREIGN KEY ("enclaveOid") REFERENCES "Enclave"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirewallBinding" ADD CONSTRAINT "FirewallBinding_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirewallBinding" ADD CONSTRAINT "FirewallBinding_networkOid_fkey" FOREIGN KEY ("networkOid") REFERENCES "Network"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirewallBinding" ADD CONSTRAINT "FirewallBinding_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirewallBinding" ADD CONSTRAINT "FirewallBinding_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirewallBinding" ADD CONSTRAINT "FirewallBinding_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirewallBinding" ADD CONSTRAINT "FirewallBinding_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkPolicy" ADD CONSTRAINT "NetworkPolicy_currentVersionOid_fkey" FOREIGN KEY ("currentVersionOid") REFERENCES "NetworkPolicyVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkPolicy" ADD CONSTRAINT "NetworkPolicy_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkPolicy" ADD CONSTRAINT "NetworkPolicy_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkPolicy" ADD CONSTRAINT "NetworkPolicy_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkPolicy" ADD CONSTRAINT "NetworkPolicy_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkPolicyVersion" ADD CONSTRAINT "NetworkPolicyVersion_networkPolicyOid_fkey" FOREIGN KEY ("networkPolicyOid") REFERENCES "NetworkPolicy"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirewallNetworkPolicy" ADD CONSTRAINT "FirewallNetworkPolicy_firewallOid_fkey" FOREIGN KEY ("firewallOid") REFERENCES "Firewall"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirewallNetworkPolicy" ADD CONSTRAINT "FirewallNetworkPolicy_networkPolicyOid_fkey" FOREIGN KEY ("networkPolicyOid") REFERENCES "NetworkPolicy"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnclaveIngressNetworkLog" ADD CONSTRAINT "EnclaveIngressNetworkLog_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnclaveIngressNetworkLog" ADD CONSTRAINT "EnclaveIngressNetworkLog_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnclaveIngressNetworkLog" ADD CONSTRAINT "EnclaveIngressNetworkLog_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnclaveIngressNetworkLog" ADD CONSTRAINT "EnclaveIngressNetworkLog_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityActor" ADD CONSTRAINT "IdentityActor_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityActor" ADD CONSTRAINT "IdentityActor_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityActor" ADD CONSTRAINT "IdentityActor_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityActor" ADD CONSTRAINT "IdentityActor_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityActor" ADD CONSTRAINT "IdentityActor_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityActor" ADD CONSTRAINT "IdentityActor_consumerOid_fkey" FOREIGN KEY ("consumerOid") REFERENCES "Consumer"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityActor" ADD CONSTRAINT "IdentityActor_instanceConsumerOid_fkey" FOREIGN KEY ("instanceConsumerOid") REFERENCES "InstanceConsumer"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityActor" ADD CONSTRAINT "IdentityActor_consumerProfileOid_fkey" FOREIGN KEY ("consumerProfileOid") REFERENCES "ConsumerProfile"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityActor" ADD CONSTRAINT "IdentityActor_defaultForInstanceConsumerOid_fkey" FOREIGN KEY ("defaultForInstanceConsumerOid") REFERENCES "InstanceConsumer"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityActor" ADD CONSTRAINT "IdentityActor_defaultIdentityOid_fkey" FOREIGN KEY ("defaultIdentityOid") REFERENCES "Identity"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DelegatedIdentity" ADD CONSTRAINT "DelegatedIdentity_identityOid_fkey" FOREIGN KEY ("identityOid") REFERENCES "Identity"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DelegatedIdentity" ADD CONSTRAINT "DelegatedIdentity_actorOid_fkey" FOREIGN KEY ("actorOid") REFERENCES "IdentityActor"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DelegatedIdentityCredential" ADD CONSTRAINT "DelegatedIdentityCredential_delegatedIdentityOid_fkey" FOREIGN KEY ("delegatedIdentityOid") REFERENCES "DelegatedIdentity"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DelegatedIdentityCredential" ADD CONSTRAINT "DelegatedIdentityCredential_credentialOid_fkey" FOREIGN KEY ("credentialOid") REFERENCES "IdentityCredential"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DelegatedIdentityUpdate" ADD CONSTRAINT "DelegatedIdentityUpdate_delegatedIdentityOid_fkey" FOREIGN KEY ("delegatedIdentityOid") REFERENCES "DelegatedIdentity"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DelegatedIdentityCredentialUpdate" ADD CONSTRAINT "DelegatedIdentityCredentialUpdate_updateOid_fkey" FOREIGN KEY ("updateOid") REFERENCES "DelegatedIdentityUpdate"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DelegatedIdentityCredentialUpdate" ADD CONSTRAINT "DelegatedIdentityCredentialUpdate_delegatedCredentialOid_fkey" FOREIGN KEY ("delegatedCredentialOid") REFERENCES "DelegatedIdentityCredential"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityDelegation" ADD CONSTRAINT "IdentityDelegation_identityOid_fkey" FOREIGN KEY ("identityOid") REFERENCES "Identity"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityDelegation" ADD CONSTRAINT "IdentityDelegation_subDelegatedFromOid_fkey" FOREIGN KEY ("subDelegatedFromOid") REFERENCES "IdentityActor"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityDelegation" ADD CONSTRAINT "IdentityDelegation_delegateeOid_fkey" FOREIGN KEY ("delegateeOid") REFERENCES "IdentityActor"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityDelegation" ADD CONSTRAINT "IdentityDelegation_delegationConfigOid_fkey" FOREIGN KEY ("delegationConfigOid") REFERENCES "IdentityDelegationConfig"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityDelegation" ADD CONSTRAINT "IdentityDelegation_selectedDelegationConfigVersionOid_fkey" FOREIGN KEY ("selectedDelegationConfigVersionOid") REFERENCES "IdentityDelegationConfigVersion"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityDelegation" ADD CONSTRAINT "IdentityDelegation_attestationOid_fkey" FOREIGN KEY ("attestationOid") REFERENCES "IdentityDelegationAttestation"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityDelegation" ADD CONSTRAINT "IdentityDelegation_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityDelegation" ADD CONSTRAINT "IdentityDelegation_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityDelegation" ADD CONSTRAINT "IdentityDelegation_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityDelegation" ADD CONSTRAINT "IdentityDelegation_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityDelegation" ADD CONSTRAINT "IdentityDelegation_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityDelegationCredentialOverride" ADD CONSTRAINT "IdentityDelegationCredentialOverride_delegationOid_fkey" FOREIGN KEY ("delegationOid") REFERENCES "IdentityDelegation"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityDelegationCredentialOverride" ADD CONSTRAINT "IdentityDelegationCredentialOverride_credentialOid_fkey" FOREIGN KEY ("credentialOid") REFERENCES "IdentityCredential"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityDelegationParty" ADD CONSTRAINT "IdentityDelegationParty_delegationOid_fkey" FOREIGN KEY ("delegationOid") REFERENCES "IdentityDelegation"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityDelegationParty" ADD CONSTRAINT "IdentityDelegationParty_actorOid_fkey" FOREIGN KEY ("actorOid") REFERENCES "IdentityActor"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityDelegationConfig" ADD CONSTRAINT "IdentityDelegationConfig_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityDelegationConfig" ADD CONSTRAINT "IdentityDelegationConfig_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityDelegationConfig" ADD CONSTRAINT "IdentityDelegationConfig_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityDelegationConfig" ADD CONSTRAINT "IdentityDelegationConfig_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityDelegationConfig" ADD CONSTRAINT "IdentityDelegationConfig_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityDelegationConfig" ADD CONSTRAINT "IdentityDelegationConfig_currentVersionOid_fkey" FOREIGN KEY ("currentVersionOid") REFERENCES "IdentityDelegationConfigVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityDelegationConfigVersion" ADD CONSTRAINT "IdentityDelegationConfigVersion_delegationConfigOid_fkey" FOREIGN KEY ("delegationConfigOid") REFERENCES "IdentityDelegationConfig"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Identity" ADD CONSTRAINT "Identity_actorOid_fkey" FOREIGN KEY ("actorOid") REFERENCES "IdentityActor"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Identity" ADD CONSTRAINT "Identity_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Identity" ADD CONSTRAINT "Identity_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Identity" ADD CONSTRAINT "Identity_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Identity" ADD CONSTRAINT "Identity_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Identity" ADD CONSTRAINT "Identity_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Identity" ADD CONSTRAINT "Identity_delegationConfigOid_fkey" FOREIGN KEY ("delegationConfigOid") REFERENCES "IdentityDelegationConfig"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Identity" ADD CONSTRAINT "Identity_ownedByIntegrationInstanceOid_fkey" FOREIGN KEY ("ownedByIntegrationInstanceOid") REFERENCES "IntegrationInstance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityCredential" ADD CONSTRAINT "IdentityCredential_identityOid_fkey" FOREIGN KEY ("identityOid") REFERENCES "Identity"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityCredential" ADD CONSTRAINT "IdentityCredential_deploymentOid_fkey" FOREIGN KEY ("deploymentOid") REFERENCES "ProviderDeployment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityCredential" ADD CONSTRAINT "IdentityCredential_configOid_fkey" FOREIGN KEY ("configOid") REFERENCES "ProviderConfig"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityCredential" ADD CONSTRAINT "IdentityCredential_authConfigOid_fkey" FOREIGN KEY ("authConfigOid") REFERENCES "ProviderAuthConfig"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityCredential" ADD CONSTRAINT "IdentityCredential_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityCredential" ADD CONSTRAINT "IdentityCredential_delegationConfigOid_fkey" FOREIGN KEY ("delegationConfigOid") REFERENCES "IdentityDelegationConfig"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityCredential" ADD CONSTRAINT "IdentityCredential_integrationInstanceOid_fkey" FOREIGN KEY ("integrationInstanceOid") REFERENCES "IntegrationInstance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityCredential" ADD CONSTRAINT "IdentityCredential_integrationInstanceProviderOid_fkey" FOREIGN KEY ("integrationInstanceProviderOid") REFERENCES "IntegrationInstanceProvider"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityDelegationRequest" ADD CONSTRAINT "IdentityDelegationRequest_delegationOid_fkey" FOREIGN KEY ("delegationOid") REFERENCES "IdentityDelegation"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityDelegationRequest" ADD CONSTRAINT "IdentityDelegationRequest_attestationOid_fkey" FOREIGN KEY ("attestationOid") REFERENCES "IdentityDelegationAttestation"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityDelegationRequest" ADD CONSTRAINT "IdentityDelegationRequest_requesterOid_fkey" FOREIGN KEY ("requesterOid") REFERENCES "IdentityActor"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityDelegationRequest" ADD CONSTRAINT "IdentityDelegationRequest_identityOid_fkey" FOREIGN KEY ("identityOid") REFERENCES "Identity"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityDelegationRequest" ADD CONSTRAINT "IdentityDelegationRequest_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityDelegationRequest" ADD CONSTRAINT "IdentityDelegationRequest_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityDelegationRequest" ADD CONSTRAINT "IdentityDelegationRequest_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityDelegationRequest" ADD CONSTRAINT "IdentityDelegationRequest_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityDelegationRequest" ADD CONSTRAINT "IdentityDelegationRequest_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MagicMcpServerBacking" ADD CONSTRAINT "MagicMcpServerBacking_providerTemplateBackingOid_fkey" FOREIGN KEY ("providerTemplateBackingOid") REFERENCES "ProviderTemplateBacking"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MagicMcpServerBacking" ADD CONSTRAINT "MagicMcpServerBacking_ownerIntegrationOid_fkey" FOREIGN KEY ("ownerIntegrationOid") REFERENCES "Integration"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MagicMcpServerBacking" ADD CONSTRAINT "MagicMcpServerBacking_integrationOid_fkey" FOREIGN KEY ("integrationOid") REFERENCES "Integration"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MagicMcpServerBacking" ADD CONSTRAINT "MagicMcpServerBacking_integrationInstanceOid_fkey" FOREIGN KEY ("integrationInstanceOid") REFERENCES "IntegrationInstance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MagicMcpServerBacking" ADD CONSTRAINT "MagicMcpServerBacking_sessionTemplateOid_fkey" FOREIGN KEY ("sessionTemplateOid") REFERENCES "SessionTemplate"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MagicMcpServerBacking" ADD CONSTRAINT "MagicMcpServerBacking_ephemeralManagedSessionOid_fkey" FOREIGN KEY ("ephemeralManagedSessionOid") REFERENCES "EphemeralManagedSession"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MagicMcpServerBacking" ADD CONSTRAINT "MagicMcpServerBacking_actorOid_fkey" FOREIGN KEY ("actorOid") REFERENCES "IdentityActor"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MagicMcpServerBacking" ADD CONSTRAINT "MagicMcpServerBacking_identityOid_fkey" FOREIGN KEY ("identityOid") REFERENCES "Identity"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MagicMcpServerBacking" ADD CONSTRAINT "MagicMcpServerBacking_ownerActorOid_fkey" FOREIGN KEY ("ownerActorOid") REFERENCES "IdentityActor"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MagicMcpServerProvider" ADD CONSTRAINT "MagicMcpServerProvider_magicMcpServerBackingOid_fkey" FOREIGN KEY ("magicMcpServerBackingOid") REFERENCES "MagicMcpServerBacking"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MagicMcpServerProvider" ADD CONSTRAINT "MagicMcpServerProvider_integrationProviderOid_fkey" FOREIGN KEY ("integrationProviderOid") REFERENCES "IntegrationProvider"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MagicMcpServerProvider" ADD CONSTRAINT "MagicMcpServerProvider_integrationInstanceProviderOid_fkey" FOREIGN KEY ("integrationInstanceProviderOid") REFERENCES "IntegrationInstanceProvider"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MagicMcpEndpointBacking" ADD CONSTRAINT "MagicMcpEndpointBacking_integrationGroupOid_fkey" FOREIGN KEY ("integrationGroupOid") REFERENCES "IntegrationInstanceGroup"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MagicMcpEndpointBacking" ADD CONSTRAINT "MagicMcpEndpointBacking_sessionTemplateOid_fkey" FOREIGN KEY ("sessionTemplateOid") REFERENCES "SessionTemplate"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MagicMcpEndpointBacking" ADD CONSTRAINT "MagicMcpEndpointBacking_ephemeralManagedSessionOid_fkey" FOREIGN KEY ("ephemeralManagedSessionOid") REFERENCES "EphemeralManagedSession"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MagicMcpEndpointBacking" ADD CONSTRAINT "MagicMcpEndpointBacking_actorOid_fkey" FOREIGN KEY ("actorOid") REFERENCES "IdentityActor"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MagicMcpEndpointBacking" ADD CONSTRAINT "MagicMcpEndpointBacking_ownerActorOid_fkey" FOREIGN KEY ("ownerActorOid") REFERENCES "IdentityActor"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MagicMcpEndpointServerBacking" ADD CONSTRAINT "MagicMcpEndpointServerBacking_magicMcpEndpointBackingOid_fkey" FOREIGN KEY ("magicMcpEndpointBackingOid") REFERENCES "MagicMcpEndpointBacking"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MagicMcpEndpointServerBacking" ADD CONSTRAINT "MagicMcpEndpointServerBacking_magicMcpServerBackingOid_fkey" FOREIGN KEY ("magicMcpServerBackingOid") REFERENCES "MagicMcpServerBacking"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderTemplateBacking" ADD CONSTRAINT "ProviderTemplateBacking_integrationOid_fkey" FOREIGN KEY ("integrationOid") REFERENCES "Integration"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationInstance" ADD CONSTRAINT "IntegrationInstance_integrationOid_fkey" FOREIGN KEY ("integrationOid") REFERENCES "Integration"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationInstance" ADD CONSTRAINT "IntegrationInstance_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationInstance" ADD CONSTRAINT "IntegrationInstance_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationInstance" ADD CONSTRAINT "IntegrationInstance_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationInstance" ADD CONSTRAINT "IntegrationInstance_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationInstance" ADD CONSTRAINT "IntegrationInstance_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationInstance" ADD CONSTRAINT "IntegrationInstance_identityActorOid_fkey" FOREIGN KEY ("identityActorOid") REFERENCES "IdentityActor"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationInstance" ADD CONSTRAINT "IntegrationInstance_identityOid_fkey" FOREIGN KEY ("identityOid") REFERENCES "Identity"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationInstance" ADD CONSTRAINT "IntegrationInstance_ownerActorOid_fkey" FOREIGN KEY ("ownerActorOid") REFERENCES "IdentityActor"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationInstanceProvider" ADD CONSTRAINT "IntegrationInstanceProvider_currentVersionOid_fkey" FOREIGN KEY ("currentVersionOid") REFERENCES "IntegrationInstanceProviderVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationInstanceProvider" ADD CONSTRAINT "IntegrationInstanceProvider_integrationOid_fkey" FOREIGN KEY ("integrationOid") REFERENCES "Integration"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationInstanceProvider" ADD CONSTRAINT "IntegrationInstanceProvider_integrationInstanceOid_fkey" FOREIGN KEY ("integrationInstanceOid") REFERENCES "IntegrationInstance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationInstanceProvider" ADD CONSTRAINT "IntegrationInstanceProvider_integrationProviderOid_fkey" FOREIGN KEY ("integrationProviderOid") REFERENCES "IntegrationProvider"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationInstanceProvider" ADD CONSTRAINT "IntegrationInstanceProvider_integrationVersionOid_fkey" FOREIGN KEY ("integrationVersionOid") REFERENCES "IntegrationVersion"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationInstanceProvider" ADD CONSTRAINT "IntegrationInstanceProvider_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationInstanceProvider" ADD CONSTRAINT "IntegrationInstanceProvider_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationInstanceProvider" ADD CONSTRAINT "IntegrationInstanceProvider_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationInstanceProvider" ADD CONSTRAINT "IntegrationInstanceProvider_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationInstanceProvider" ADD CONSTRAINT "IntegrationInstanceProvider_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationInstanceProviderVersion" ADD CONSTRAINT "IntegrationInstanceProviderVersion_integrationInstanceProv_fkey" FOREIGN KEY ("integrationInstanceProviderOid") REFERENCES "IntegrationInstanceProvider"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationInstanceProviderVersion" ADD CONSTRAINT "IntegrationInstanceProviderVersion_integrationProviderVers_fkey" FOREIGN KEY ("integrationProviderVersionOid") REFERENCES "IntegrationProviderVersion"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationInstanceProviderVersion" ADD CONSTRAINT "IntegrationInstanceProviderVersion_configOid_fkey" FOREIGN KEY ("configOid") REFERENCES "ProviderConfig"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationInstanceProviderVersion" ADD CONSTRAINT "IntegrationInstanceProviderVersion_authConfigOid_fkey" FOREIGN KEY ("authConfigOid") REFERENCES "ProviderAuthConfig"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationInstanceGroup" ADD CONSTRAINT "IntegrationInstanceGroup_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationInstanceGroup" ADD CONSTRAINT "IntegrationInstanceGroup_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationInstanceGroup" ADD CONSTRAINT "IntegrationInstanceGroup_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationInstanceGroup" ADD CONSTRAINT "IntegrationInstanceGroup_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationInstanceGroup" ADD CONSTRAINT "IntegrationInstanceGroup_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationInstanceGroup" ADD CONSTRAINT "IntegrationInstanceGroup_identityActorOid_fkey" FOREIGN KEY ("identityActorOid") REFERENCES "IdentityActor"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationInstanceGroup" ADD CONSTRAINT "IntegrationInstanceGroup_identityOid_fkey" FOREIGN KEY ("identityOid") REFERENCES "Identity"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationInstanceGroup" ADD CONSTRAINT "IntegrationInstanceGroup_ownerActorOid_fkey" FOREIGN KEY ("ownerActorOid") REFERENCES "IdentityActor"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationInstanceGroupSource" ADD CONSTRAINT "IntegrationInstanceGroupSource_integrationInstanceGroupOid_fkey" FOREIGN KEY ("integrationInstanceGroupOid") REFERENCES "IntegrationInstanceGroup"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationInstanceGroupSource" ADD CONSTRAINT "IntegrationInstanceGroupSource_integrationInstanceOid_fkey" FOREIGN KEY ("integrationInstanceOid") REFERENCES "IntegrationInstance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationInstanceGroupSource" ADD CONSTRAINT "IntegrationInstanceGroupSource_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationInstanceGroupSource" ADD CONSTRAINT "IntegrationInstanceGroupSource_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationInstanceGroupSource" ADD CONSTRAINT "IntegrationInstanceGroupSource_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationInstanceGroupSource" ADD CONSTRAINT "IntegrationInstanceGroupSource_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationInstanceGroupSource" ADD CONSTRAINT "IntegrationInstanceGroupSource_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationInstanceGroupProvider" ADD CONSTRAINT "dii_provider_dii_fkey" FOREIGN KEY ("integrationInstanceGroupOid") REFERENCES "IntegrationInstanceGroup"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationInstanceGroupProvider" ADD CONSTRAINT "dii_provider_source_fkey" FOREIGN KEY ("integrationInstanceGroupSourceOid") REFERENCES "IntegrationInstanceGroupSource"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationInstanceGroupProvider" ADD CONSTRAINT "IntegrationInstanceGroupProvider_integrationOid_fkey" FOREIGN KEY ("integrationOid") REFERENCES "Integration"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationInstanceGroupProvider" ADD CONSTRAINT "IntegrationInstanceGroupProvider_integrationInstanceOid_fkey" FOREIGN KEY ("integrationInstanceOid") REFERENCES "IntegrationInstance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationInstanceGroupProvider" ADD CONSTRAINT "IntegrationInstanceGroupProvider_integrationInstanceProvid_fkey" FOREIGN KEY ("integrationInstanceProviderOid") REFERENCES "IntegrationInstanceProvider"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationInstanceGroupProvider" ADD CONSTRAINT "IntegrationInstanceGroupProvider_integrationProviderOid_fkey" FOREIGN KEY ("integrationProviderOid") REFERENCES "IntegrationProvider"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationInstanceGroupProvider" ADD CONSTRAINT "IntegrationInstanceGroupProvider_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationInstanceGroupProvider" ADD CONSTRAINT "IntegrationInstanceGroupProvider_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationInstanceGroupProvider" ADD CONSTRAINT "IntegrationInstanceGroupProvider_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationInstanceGroupProvider" ADD CONSTRAINT "IntegrationInstanceGroupProvider_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationInstanceGroupProvider" ADD CONSTRAINT "IntegrationInstanceGroupProvider_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_currentVersionOid_fkey" FOREIGN KEY ("currentVersionOid") REFERENCES "IntegrationVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationProvider" ADD CONSTRAINT "IntegrationProvider_currentVersionOid_fkey" FOREIGN KEY ("currentVersionOid") REFERENCES "IntegrationProviderVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationProvider" ADD CONSTRAINT "IntegrationProvider_integrationOid_fkey" FOREIGN KEY ("integrationOid") REFERENCES "Integration"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationProvider" ADD CONSTRAINT "IntegrationProvider_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationProvider" ADD CONSTRAINT "IntegrationProvider_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationProvider" ADD CONSTRAINT "IntegrationProvider_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationProvider" ADD CONSTRAINT "IntegrationProvider_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationProvider" ADD CONSTRAINT "IntegrationProvider_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationProvider" ADD CONSTRAINT "IntegrationProvider_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationProviderVersion" ADD CONSTRAINT "IntegrationProviderVersion_integrationProviderOid_fkey" FOREIGN KEY ("integrationProviderOid") REFERENCES "IntegrationProvider"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationProviderVersion" ADD CONSTRAINT "IntegrationProviderVersion_deploymentOid_fkey" FOREIGN KEY ("deploymentOid") REFERENCES "ProviderDeployment"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationProviderVersion" ADD CONSTRAINT "IntegrationProviderVersion_authMethodOid_fkey" FOREIGN KEY ("authMethodOid") REFERENCES "ProviderAuthMethod"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationProviderVersion" ADD CONSTRAINT "IntegrationProviderVersion_authCredentialsOid_fkey" FOREIGN KEY ("authCredentialsOid") REFERENCES "ProviderAuthCredentials"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationProviderVersion" ADD CONSTRAINT "IntegrationProviderVersion_configOid_fkey" FOREIGN KEY ("configOid") REFERENCES "ProviderConfig"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationVersion" ADD CONSTRAINT "IntegrationVersion_integrationOid_fkey" FOREIGN KEY ("integrationOid") REFERENCES "Integration"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationVersionProvider" ADD CONSTRAINT "IntegrationVersionProvider_integrationVersionOid_fkey" FOREIGN KEY ("integrationVersionOid") REFERENCES "IntegrationVersion"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationVersionProvider" ADD CONSTRAINT "IntegrationVersionProvider_integrationProviderVersionOid_fkey" FOREIGN KEY ("integrationProviderVersionOid") REFERENCES "IntegrationProviderVersion"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderListingGroup" ADD CONSTRAINT "ProviderListingGroup_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderListingGroup" ADD CONSTRAINT "ProviderListingGroup_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderListingGroup" ADD CONSTRAINT "ProviderListingGroup_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderListingGroup" ADD CONSTRAINT "ProviderListingGroup_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderListingGroup" ADD CONSTRAINT "ProviderListingGroup_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderListing" ADD CONSTRAINT "ProviderListing_ownerTenantOid_fkey" FOREIGN KEY ("ownerTenantOid") REFERENCES "Tenant"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderListing" ADD CONSTRAINT "ProviderListing_ownerSolutionOid_fkey" FOREIGN KEY ("ownerSolutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderListing" ADD CONSTRAINT "ProviderListing_publisherOid_fkey" FOREIGN KEY ("publisherOid") REFERENCES "Publisher"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderListing" ADD CONSTRAINT "ProviderListing_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderListing" ADD CONSTRAINT "ProviderListing_typeOid_fkey" FOREIGN KEY ("typeOid") REFERENCES "ProviderType"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderListingUpdate" ADD CONSTRAINT "ProviderListingUpdate_providerListingOid_fkey" FOREIGN KEY ("providerListingOid") REFERENCES "ProviderListing"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitorAlert" ADD CONSTRAINT "MonitorAlert_monitorOid_fkey" FOREIGN KEY ("monitorOid") REFERENCES "Monitor"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitorAlert" ADD CONSTRAINT "MonitorAlert_protoGuardAlertOid_fkey" FOREIGN KEY ("protoGuardAlertOid") REFERENCES "ProtoGuardAlert"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitorAlert" ADD CONSTRAINT "MonitorAlert_specificationChangeNotificationOid_fkey" FOREIGN KEY ("specificationChangeNotificationOid") REFERENCES "ProviderSpecificationChangeNotification"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitorAlert" ADD CONSTRAINT "MonitorAlert_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitorAlert" ADD CONSTRAINT "MonitorAlert_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitorAlert" ADD CONSTRAINT "MonitorAlert_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitorAlert" ADD CONSTRAINT "MonitorAlert_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitorAlert" ADD CONSTRAINT "MonitorAlert_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitorAlertEvent" ADD CONSTRAINT "MonitorAlertEvent_monitorAlertOid_fkey" FOREIGN KEY ("monitorAlertOid") REFERENCES "MonitorAlert"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitorAlertEvent" ADD CONSTRAINT "MonitorAlertEvent_actorOid_fkey" FOREIGN KEY ("actorOid") REFERENCES "Actor"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitorAlertRecipient" ADD CONSTRAINT "MonitorAlertRecipient_monitorAlertOid_fkey" FOREIGN KEY ("monitorAlertOid") REFERENCES "MonitorAlert"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitorAlertRecipient" ADD CONSTRAINT "MonitorAlertRecipient_recipientOid_fkey" FOREIGN KEY ("recipientOid") REFERENCES "Actor"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Monitor" ADD CONSTRAINT "Monitor_protoGuardFilterOid_fkey" FOREIGN KEY ("protoGuardFilterOid") REFERENCES "ProtoGuardFilter"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Monitor" ADD CONSTRAINT "Monitor_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Monitor" ADD CONSTRAINT "Monitor_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Monitor" ADD CONSTRAINT "Monitor_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Monitor" ADD CONSTRAINT "Monitor_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Monitor" ADD CONSTRAINT "Monitor_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Monitor" ADD CONSTRAINT "Monitor_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAdapter" ADD CONSTRAINT "ProviderAdapter_globalOid_fkey" FOREIGN KEY ("globalOid") REFERENCES "ProviderAdapterGlobal"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAdapter" ADD CONSTRAINT "ProviderAdapter_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAdapterCapability" ADD CONSTRAINT "ProviderAdapterCapability_adapterOid_fkey" FOREIGN KEY ("adapterOid") REFERENCES "ProviderAdapter"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderVersionAdapter" ADD CONSTRAINT "ProviderVersionAdapter_providerVersionOid_fkey" FOREIGN KEY ("providerVersionOid") REFERENCES "ProviderVersion"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderVersionAdapter" ADD CONSTRAINT "ProviderVersionAdapter_adapterOid_fkey" FOREIGN KEY ("adapterOid") REFERENCES "ProviderAdapter"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderVersionAdapterCapability" ADD CONSTRAINT "ProviderVersionAdapterCapability_providerVersionAdapterOid_fkey" FOREIGN KEY ("providerVersionAdapterOid") REFERENCES "ProviderVersionAdapter"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderVersionAdapterCapability" ADD CONSTRAINT "ProviderVersionAdapterCapability_adapterCapabilityOid_fkey" FOREIGN KEY ("adapterCapabilityOid") REFERENCES "ProviderAdapterCapability"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderEnvironment" ADD CONSTRAINT "ProviderEnvironment_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderEnvironment" ADD CONSTRAINT "ProviderEnvironment_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderEnvironment" ADD CONSTRAINT "ProviderEnvironment_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderEnvironment" ADD CONSTRAINT "ProviderEnvironment_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderEnvironment" ADD CONSTRAINT "ProviderEnvironment_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderEnvironment" ADD CONSTRAINT "ProviderEnvironment_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderEnvironment" ADD CONSTRAINT "ProviderEnvironment_providerVariantOid_fkey" FOREIGN KEY ("providerVariantOid") REFERENCES "ProviderVariant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderEnvironment" ADD CONSTRAINT "ProviderEnvironment_currentVersionOid_fkey" FOREIGN KEY ("currentVersionOid") REFERENCES "ProviderVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderEnvironmentVersion" ADD CONSTRAINT "ProviderEnvironmentVersion_providerEnvironmentOid_fkey" FOREIGN KEY ("providerEnvironmentOid") REFERENCES "ProviderEnvironment"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderEnvironmentVersion" ADD CONSTRAINT "ProviderEnvironmentVersion_providerVersionOid_fkey" FOREIGN KEY ("providerVersionOid") REFERENCES "ProviderVersion"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderEnvironmentVersion" ADD CONSTRAINT "ProviderEnvironmentVersion_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderEnvironmentVersion" ADD CONSTRAINT "ProviderEnvironmentVersion_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderEntry" ADD CONSTRAINT "ProviderEntry_publisherOid_fkey" FOREIGN KEY ("publisherOid") REFERENCES "Publisher"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Provider" ADD CONSTRAINT "Provider_tag_fkey" FOREIGN KEY ("tag") REFERENCES "ProviderTag"("tag") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Provider" ADD CONSTRAINT "Provider_entryOid_fkey" FOREIGN KEY ("entryOid") REFERENCES "ProviderEntry"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Provider" ADD CONSTRAINT "Provider_publisherOid_fkey" FOREIGN KEY ("publisherOid") REFERENCES "Publisher"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Provider" ADD CONSTRAINT "Provider_ownerTenantOid_fkey" FOREIGN KEY ("ownerTenantOid") REFERENCES "Tenant"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Provider" ADD CONSTRAINT "Provider_ownerSolutionOid_fkey" FOREIGN KEY ("ownerSolutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Provider" ADD CONSTRAINT "Provider_defaultVariantOid_fkey" FOREIGN KEY ("defaultVariantOid") REFERENCES "ProviderVariant"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Provider" ADD CONSTRAINT "Provider_typeOid_fkey" FOREIGN KEY ("typeOid") REFERENCES "ProviderType"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderToolGlobal" ADD CONSTRAINT "ProviderToolGlobal_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderToolGlobal" ADD CONSTRAINT "ProviderToolGlobal_currentInstanceOid_fkey" FOREIGN KEY ("currentInstanceOid") REFERENCES "ProviderTool"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderTool" ADD CONSTRAINT "ProviderTool_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderTool" ADD CONSTRAINT "ProviderTool_specificationOid_fkey" FOREIGN KEY ("specificationOid") REFERENCES "ProviderSpecification"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderTool" ADD CONSTRAINT "ProviderTool_globalOid_fkey" FOREIGN KEY ("globalOid") REFERENCES "ProviderToolGlobal"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderTool" ADD CONSTRAINT "ProviderTool_adapterOid_fkey" FOREIGN KEY ("adapterOid") REFERENCES "ProviderAdapter"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthMethodGlobal" ADD CONSTRAINT "ProviderAuthMethodGlobal_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthMethodGlobal" ADD CONSTRAINT "ProviderAuthMethodGlobal_currentInstanceOid_fkey" FOREIGN KEY ("currentInstanceOid") REFERENCES "ProviderAuthMethod"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthMethod" ADD CONSTRAINT "ProviderAuthMethod_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthMethod" ADD CONSTRAINT "ProviderAuthMethod_specificationOid_fkey" FOREIGN KEY ("specificationOid") REFERENCES "ProviderSpecification"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthMethod" ADD CONSTRAINT "ProviderAuthMethod_globalOid_fkey" FOREIGN KEY ("globalOid") REFERENCES "ProviderAuthMethodGlobal"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderSpecification" ADD CONSTRAINT "ProviderSpecification_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderTriggerGlobal" ADD CONSTRAINT "ProviderTriggerGlobal_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderTriggerGlobal" ADD CONSTRAINT "ProviderTriggerGlobal_currentInstanceOid_fkey" FOREIGN KEY ("currentInstanceOid") REFERENCES "ProviderTrigger"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderTriggerGroupGlobal" ADD CONSTRAINT "ProviderTriggerGroupGlobal_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderTriggerGroupGlobal" ADD CONSTRAINT "ProviderTriggerGroupGlobal_currentInstanceOid_fkey" FOREIGN KEY ("currentInstanceOid") REFERENCES "ProviderTriggerGroup"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderTriggerGroup" ADD CONSTRAINT "ProviderTriggerGroup_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderTriggerGroup" ADD CONSTRAINT "ProviderTriggerGroup_specificationOid_fkey" FOREIGN KEY ("specificationOid") REFERENCES "ProviderSpecification"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderTriggerGroup" ADD CONSTRAINT "ProviderTriggerGroup_globalOid_fkey" FOREIGN KEY ("globalOid") REFERENCES "ProviderTriggerGroupGlobal"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderTrigger" ADD CONSTRAINT "ProviderTrigger_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderTrigger" ADD CONSTRAINT "ProviderTrigger_specificationOid_fkey" FOREIGN KEY ("specificationOid") REFERENCES "ProviderSpecification"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderTrigger" ADD CONSTRAINT "ProviderTrigger_globalOid_fkey" FOREIGN KEY ("globalOid") REFERENCES "ProviderTriggerGlobal"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderTrigger" ADD CONSTRAINT "ProviderTrigger_adapterOid_fkey" FOREIGN KEY ("adapterOid") REFERENCES "ProviderAdapter"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderTrigger" ADD CONSTRAINT "ProviderTrigger_triggerGroupOid_fkey" FOREIGN KEY ("triggerGroupOid") REFERENCES "ProviderTriggerGroup"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderVersionSpecificationChange" ADD CONSTRAINT "ProviderVersionSpecificationChange_fromSpecificationOid_fkey" FOREIGN KEY ("fromSpecificationOid") REFERENCES "ProviderSpecification"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderVersionSpecificationChange" ADD CONSTRAINT "ProviderVersionSpecificationChange_toSpecificationOid_fkey" FOREIGN KEY ("toSpecificationOid") REFERENCES "ProviderSpecification"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderVersionSpecificationChange" ADD CONSTRAINT "ProviderVersionSpecificationChange_fromVersionOid_fkey" FOREIGN KEY ("fromVersionOid") REFERENCES "ProviderVersion"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderVersionSpecificationChange" ADD CONSTRAINT "ProviderVersionSpecificationChange_toVersionOid_fkey" FOREIGN KEY ("toVersionOid") REFERENCES "ProviderVersion"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderSpecificationChangeNotification" ADD CONSTRAINT "ProviderSpecificationChangeNotification_versionOid_fkey" FOREIGN KEY ("versionOid") REFERENCES "ProviderVersion"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderSpecificationChangeNotification" ADD CONSTRAINT "ProviderSpecificationChangeNotification_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderSpecificationChangeNotification" ADD CONSTRAINT "ProviderSpecificationChangeNotification_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderSpecificationChangeNotification" ADD CONSTRAINT "ProviderSpecificationChangeNotification_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderSpecificationChangeNotification" ADD CONSTRAINT "ProviderSpecificationChangeNotification_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderSpecificationChangeNotification" ADD CONSTRAINT "ProviderSpecificationChangeNotification_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderSpecificationChangeNotification" ADD CONSTRAINT "ProviderSpecificationChangeNotification_versionSpecificati_fkey" FOREIGN KEY ("versionSpecificationChangeOid") REFERENCES "ProviderVersionSpecificationChange"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderSpecificationChangeNotification" ADD CONSTRAINT "ProviderSpecificationChangeNotification_deploymentConfigPa_fkey" FOREIGN KEY ("deploymentConfigPairOid") REFERENCES "ProviderDeploymentConfigPair"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderSpecificationChangeNotification" ADD CONSTRAINT "ProviderSpecificationChangeNotification_pairSpecificationC_fkey" FOREIGN KEY ("pairSpecificationChangeOid") REFERENCES "ProviderDeploymentConfigPairSpecificationChange"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderUse" ADD CONSTRAINT "ProviderUse_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderUse" ADD CONSTRAINT "ProviderUse_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderUse" ADD CONSTRAINT "ProviderUse_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderUse" ADD CONSTRAINT "ProviderUse_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderUse" ADD CONSTRAINT "ProviderUse_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderUse" ADD CONSTRAINT "ProviderUse_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderVariant" ADD CONSTRAINT "ProviderVariant_tag_fkey" FOREIGN KEY ("tag") REFERENCES "ProviderTag"("tag") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderVariant" ADD CONSTRAINT "ProviderVariant_backendOid_fkey" FOREIGN KEY ("backendOid") REFERENCES "Backend"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderVariant" ADD CONSTRAINT "ProviderVariant_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderVariant" ADD CONSTRAINT "ProviderVariant_publisherOid_fkey" FOREIGN KEY ("publisherOid") REFERENCES "Publisher"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderVariant" ADD CONSTRAINT "ProviderVariant_slateOid_fkey" FOREIGN KEY ("slateOid") REFERENCES "Slate"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderVariant" ADD CONSTRAINT "ProviderVariant_shuttleServerOid_fkey" FOREIGN KEY ("shuttleServerOid") REFERENCES "ShuttleServer"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderVariant" ADD CONSTRAINT "ProviderVariant_currentVersionOid_fkey" FOREIGN KEY ("currentVersionOid") REFERENCES "ProviderVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderVersion" ADD CONSTRAINT "ProviderVersion_tag_fkey" FOREIGN KEY ("tag") REFERENCES "ProviderTag"("tag") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderVersion" ADD CONSTRAINT "ProviderVersion_backendOid_fkey" FOREIGN KEY ("backendOid") REFERENCES "Backend"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderVersion" ADD CONSTRAINT "ProviderVersion_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderVersion" ADD CONSTRAINT "ProviderVersion_providerVariantOid_fkey" FOREIGN KEY ("providerVariantOid") REFERENCES "ProviderVariant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderVersion" ADD CONSTRAINT "ProviderVersion_typeOid_fkey" FOREIGN KEY ("typeOid") REFERENCES "ProviderType"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderVersion" ADD CONSTRAINT "ProviderVersion_previousVersionOid_fkey" FOREIGN KEY ("previousVersionOid") REFERENCES "ProviderVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderVersion" ADD CONSTRAINT "ProviderVersion_slateOid_fkey" FOREIGN KEY ("slateOid") REFERENCES "Slate"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderVersion" ADD CONSTRAINT "ProviderVersion_slateVersionOid_fkey" FOREIGN KEY ("slateVersionOid") REFERENCES "SlateVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderVersion" ADD CONSTRAINT "ProviderVersion_shuttleServerOid_fkey" FOREIGN KEY ("shuttleServerOid") REFERENCES "ShuttleServer"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderVersion" ADD CONSTRAINT "ProviderVersion_shuttleServerVersionOid_fkey" FOREIGN KEY ("shuttleServerVersionOid") REFERENCES "ShuttleServerVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderVersion" ADD CONSTRAINT "ProviderVersion_specificationOid_fkey" FOREIGN KEY ("specificationOid") REFERENCES "ProviderSpecification"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicMcpServerAuthorization" ADD CONSTRAINT "PublicMcpServerAuthorization_publicMcpServerOid_fkey" FOREIGN KEY ("publicMcpServerOid") REFERENCES "PublicMcpServer"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicMcpServerAuthorization" ADD CONSTRAINT "PublicMcpServerAuthorization_clientOid_fkey" FOREIGN KEY ("clientOid") REFERENCES "PublicMcpServerClient"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicMcpServerAuthorization" ADD CONSTRAINT "PublicMcpServerAuthorization_setupSessionOid_fkey" FOREIGN KEY ("setupSessionOid") REFERENCES "ProviderSetupSession"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicMcpServerAuthorization" ADD CONSTRAINT "PublicMcpServerAuthorization_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicMcpServerAuthorization" ADD CONSTRAINT "PublicMcpServerAuthorization_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicMcpServerClient" ADD CONSTRAINT "PublicMcpServerClient_publicMcpServerOid_fkey" FOREIGN KEY ("publicMcpServerOid") REFERENCES "PublicMcpServer"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicMcpServerClient" ADD CONSTRAINT "PublicMcpServerClient_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicMcpServerClient" ADD CONSTRAINT "PublicMcpServerClient_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicMcpServerGrant" ADD CONSTRAINT "PublicMcpServerGrant_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicMcpServerGrant" ADD CONSTRAINT "PublicMcpServerGrant_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicMcpServerGrant" ADD CONSTRAINT "PublicMcpServerGrant_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicMcpServerGrant" ADD CONSTRAINT "PublicMcpServerGrant_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicMcpServerGrant" ADD CONSTRAINT "PublicMcpServerGrant_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicMcpServerGrant" ADD CONSTRAINT "PublicMcpServerGrant_publicMcpServerOid_fkey" FOREIGN KEY ("publicMcpServerOid") REFERENCES "PublicMcpServer"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicMcpServerGrant" ADD CONSTRAINT "PublicMcpServerGrant_clientOid_fkey" FOREIGN KEY ("clientOid") REFERENCES "PublicMcpServerClient"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicMcpServerGrant" ADD CONSTRAINT "PublicMcpServerGrant_authorizationOid_fkey" FOREIGN KEY ("authorizationOid") REFERENCES "PublicMcpServerAuthorization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicMcpServerGrant" ADD CONSTRAINT "PublicMcpServerGrant_deploymentOid_fkey" FOREIGN KEY ("deploymentOid") REFERENCES "ProviderDeployment"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicMcpServerGrant" ADD CONSTRAINT "PublicMcpServerGrant_configOid_fkey" FOREIGN KEY ("configOid") REFERENCES "ProviderConfig"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicMcpServerGrant" ADD CONSTRAINT "PublicMcpServerGrant_authConfigOid_fkey" FOREIGN KEY ("authConfigOid") REFERENCES "ProviderAuthConfig"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicMcpServerGrant" ADD CONSTRAINT "PublicMcpServerGrant_currentSessionOid_fkey" FOREIGN KEY ("currentSessionOid") REFERENCES "Session"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicMcpServerGrantUse" ADD CONSTRAINT "PublicMcpServerGrantUse_grantOid_fkey" FOREIGN KEY ("grantOid") REFERENCES "PublicMcpServerGrant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicMcpServerGrantUse" ADD CONSTRAINT "PublicMcpServerGrantUse_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicMcpServerGrantUse" ADD CONSTRAINT "PublicMcpServerGrantUse_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicMcpServer" ADD CONSTRAINT "PublicMcpServer_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicMcpServer" ADD CONSTRAINT "PublicMcpServer_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicMcpServer" ADD CONSTRAINT "PublicMcpServer_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicMcpServer" ADD CONSTRAINT "PublicMcpServer_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicMcpServer" ADD CONSTRAINT "PublicMcpServer_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicMcpServer" ADD CONSTRAINT "PublicMcpServer_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicMcpServer" ADD CONSTRAINT "PublicMcpServer_deploymentOid_fkey" FOREIGN KEY ("deploymentOid") REFERENCES "ProviderDeployment"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicMcpServer" ADD CONSTRAINT "PublicMcpServer_ownerActorOid_fkey" FOREIGN KEY ("ownerActorOid") REFERENCES "IdentityActor"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicMcpServerToken" ADD CONSTRAINT "PublicMcpServerToken_grantOid_fkey" FOREIGN KEY ("grantOid") REFERENCES "PublicMcpServerGrant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicMcpServerToken" ADD CONSTRAINT "PublicMcpServerToken_replacedByOid_fkey" FOREIGN KEY ("replacedByOid") REFERENCES "PublicMcpServerToken"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicMcpServerToken" ADD CONSTRAINT "PublicMcpServerToken_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicMcpServerToken" ADD CONSTRAINT "PublicMcpServerToken_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Publisher" ADD CONSTRAINT "Publisher_tag_fkey" FOREIGN KEY ("tag") REFERENCES "ProviderTag"("tag") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Publisher" ADD CONSTRAINT "Publisher_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Publisher" ADD CONSTRAINT "Publisher_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodeBucket" ADD CONSTRAINT "CodeBucket_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodeBucket" ADD CONSTRAINT "CodeBucket_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodeBucket" ADD CONSTRAINT "CodeBucket_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodeBucket" ADD CONSTRAINT "CodeBucket_scmRepoOid_fkey" FOREIGN KEY ("scmRepoOid") REFERENCES "ScmRepo"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScmRepo" ADD CONSTRAINT "ScmRepo_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScmRepo" ADD CONSTRAINT "ScmRepo_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScmRepo" ADD CONSTRAINT "ScmRepo_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScmRepoPush" ADD CONSTRAINT "ScmRepoPush_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScmRepoPush" ADD CONSTRAINT "ScmRepoPush_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScmRepoPush" ADD CONSTRAINT "ScmRepoPush_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScmRepoPush" ADD CONSTRAINT "ScmRepoPush_repoOid_fkey" FOREIGN KEY ("repoOid") REFERENCES "ScmRepo"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionConnection" ADD CONSTRAINT "SessionConnection_adapterGlobalOid_fkey" FOREIGN KEY ("adapterGlobalOid") REFERENCES "ProviderAdapterGlobal"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionConnection" ADD CONSTRAINT "SessionConnection_sessionOid_fkey" FOREIGN KEY ("sessionOid") REFERENCES "Session"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionConnection" ADD CONSTRAINT "SessionConnection_participantOid_fkey" FOREIGN KEY ("participantOid") REFERENCES "SessionParticipant"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionConnection" ADD CONSTRAINT "SessionConnection_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionConnection" ADD CONSTRAINT "SessionConnection_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionConnection" ADD CONSTRAINT "SessionConnection_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionConnection" ADD CONSTRAINT "SessionConnection_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionConnection" ADD CONSTRAINT "SessionConnection_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionConnection" ADD CONSTRAINT "SessionConnection_ownerPublicMcpServerOid_fkey" FOREIGN KEY ("ownerPublicMcpServerOid") REFERENCES "PublicMcpServer"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionConnectionProviderSpecification" ADD CONSTRAINT "SessionConnectionProviderSpecification_connectionOid_fkey" FOREIGN KEY ("connectionOid") REFERENCES "SessionConnection"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionConnectionProviderSpecification" ADD CONSTRAINT "SessionConnectionProviderSpecification_sessionProviderOid_fkey" FOREIGN KEY ("sessionProviderOid") REFERENCES "SessionProvider"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionConnectionProviderSpecification" ADD CONSTRAINT "SessionConnectionProviderSpecification_providerVersionOid_fkey" FOREIGN KEY ("providerVersionOid") REFERENCES "ProviderVersion"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionConnectionProviderSpecification" ADD CONSTRAINT "SessionConnectionProviderSpecification_specificationOid_fkey" FOREIGN KEY ("specificationOid") REFERENCES "ProviderSpecification"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EphemeralManagedSession" ADD CONSTRAINT "EphemeralManagedSession_adapterGlobalOid_fkey" FOREIGN KEY ("adapterGlobalOid") REFERENCES "ProviderAdapterGlobal"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EphemeralManagedSession" ADD CONSTRAINT "EphemeralManagedSession_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EphemeralManagedSession" ADD CONSTRAINT "EphemeralManagedSession_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EphemeralManagedSession" ADD CONSTRAINT "EphemeralManagedSession_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EphemeralManagedSession" ADD CONSTRAINT "EphemeralManagedSession_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EphemeralManagedSession" ADD CONSTRAINT "EphemeralManagedSession_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EphemeralManagedSession" ADD CONSTRAINT "EphemeralManagedSession_sessionTemplateOid_fkey" FOREIGN KEY ("sessionTemplateOid") REFERENCES "SessionTemplate"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EphemeralManagedSession" ADD CONSTRAINT "EphemeralManagedSession_currentSessionOid_fkey" FOREIGN KEY ("currentSessionOid") REFERENCES "Session"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EphemeralManagedSession" ADD CONSTRAINT "EphemeralManagedSession_actorOid_fkey" FOREIGN KEY ("actorOid") REFERENCES "IdentityActor"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EphemeralManagedSession" ADD CONSTRAINT "EphemeralManagedSession_identityOid_fkey" FOREIGN KEY ("identityOid") REFERENCES "Identity"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EphemeralManagedSession" ADD CONSTRAINT "EphemeralManagedSession_ownerActorOid_fkey" FOREIGN KEY ("ownerActorOid") REFERENCES "IdentityActor"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionErrorGroup" ADD CONSTRAINT "SessionErrorGroup_firstOccurrenceOid_fkey" FOREIGN KEY ("firstOccurrenceOid") REFERENCES "SessionError"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionErrorGroup" ADD CONSTRAINT "SessionErrorGroup_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionErrorGroup" ADD CONSTRAINT "SessionErrorGroup_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionErrorGroup" ADD CONSTRAINT "SessionErrorGroup_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionErrorGroup" ADD CONSTRAINT "SessionErrorGroup_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionErrorGroup" ADD CONSTRAINT "SessionErrorGroup_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionErrorGroupOccurrencePeriod" ADD CONSTRAINT "SessionErrorGroupOccurrencePeriod_groupOid_fkey" FOREIGN KEY ("groupOid") REFERENCES "SessionErrorGroup"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionError" ADD CONSTRAINT "SessionError_groupOid_fkey" FOREIGN KEY ("groupOid") REFERENCES "SessionErrorGroup"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionError" ADD CONSTRAINT "SessionError_connectionOid_fkey" FOREIGN KEY ("connectionOid") REFERENCES "SessionConnection"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionError" ADD CONSTRAINT "SessionError_sessionOid_fkey" FOREIGN KEY ("sessionOid") REFERENCES "Session"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionError" ADD CONSTRAINT "SessionError_providerRunOid_fkey" FOREIGN KEY ("providerRunOid") REFERENCES "ProviderRun"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionError" ADD CONSTRAINT "SessionError_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionError" ADD CONSTRAINT "SessionError_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionError" ADD CONSTRAINT "SessionError_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionError" ADD CONSTRAINT "SessionError_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionError" ADD CONSTRAINT "SessionError_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionEvent" ADD CONSTRAINT "SessionEvent_sessionOid_fkey" FOREIGN KEY ("sessionOid") REFERENCES "Session"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionEvent" ADD CONSTRAINT "SessionEvent_providerRunOid_fkey" FOREIGN KEY ("providerRunOid") REFERENCES "ProviderRun"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionEvent" ADD CONSTRAINT "SessionEvent_messageOid_fkey" FOREIGN KEY ("messageOid") REFERENCES "SessionMessage"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionEvent" ADD CONSTRAINT "SessionEvent_connectionOid_fkey" FOREIGN KEY ("connectionOid") REFERENCES "SessionConnection"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionEvent" ADD CONSTRAINT "SessionEvent_errorOid_fkey" FOREIGN KEY ("errorOid") REFERENCES "SessionError"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionEvent" ADD CONSTRAINT "SessionEvent_warningOid_fkey" FOREIGN KEY ("warningOid") REFERENCES "SessionWarning"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionEvent" ADD CONSTRAINT "SessionEvent_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionEvent" ADD CONSTRAINT "SessionEvent_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionEvent" ADD CONSTRAINT "SessionEvent_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionEvent" ADD CONSTRAINT "SessionEvent_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionEvent" ADD CONSTRAINT "SessionEvent_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionMessage" ADD CONSTRAINT "SessionMessage_parentMessageOid_fkey" FOREIGN KEY ("parentMessageOid") REFERENCES "SessionMessage"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionMessage" ADD CONSTRAINT "SessionMessage_bucketOid_fkey" FOREIGN KEY ("bucketOid") REFERENCES "SessionMessageStorageBucket"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionMessage" ADD CONSTRAINT "SessionMessage_sessionOid_fkey" FOREIGN KEY ("sessionOid") REFERENCES "Session"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionMessage" ADD CONSTRAINT "SessionMessage_senderParticipantOid_fkey" FOREIGN KEY ("senderParticipantOid") REFERENCES "SessionParticipant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionMessage" ADD CONSTRAINT "SessionMessage_responderParticipantOid_fkey" FOREIGN KEY ("responderParticipantOid") REFERENCES "SessionParticipant"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionMessage" ADD CONSTRAINT "SessionMessage_sessionProviderOid_fkey" FOREIGN KEY ("sessionProviderOid") REFERENCES "SessionProvider"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionMessage" ADD CONSTRAINT "SessionMessage_connectionOid_fkey" FOREIGN KEY ("connectionOid") REFERENCES "SessionConnection"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionMessage" ADD CONSTRAINT "SessionMessage_providerRunOid_fkey" FOREIGN KEY ("providerRunOid") REFERENCES "ProviderRun"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionMessage" ADD CONSTRAINT "SessionMessage_slateToolCallOid_fkey" FOREIGN KEY ("slateToolCallOid") REFERENCES "SlateToolCall"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionMessage" ADD CONSTRAINT "SessionMessage_errorOid_fkey" FOREIGN KEY ("errorOid") REFERENCES "SessionError"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionMessage" ADD CONSTRAINT "SessionMessage_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionMessage" ADD CONSTRAINT "SessionMessage_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionMessage" ADD CONSTRAINT "SessionMessage_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionMessage" ADD CONSTRAINT "SessionMessage_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionMessage" ADD CONSTRAINT "SessionMessage_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionMessage" ADD CONSTRAINT "SessionMessage_providerToolOid_fkey" FOREIGN KEY ("providerToolOid") REFERENCES "ProviderTool"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolCall" ADD CONSTRAINT "ToolCall_messageOid_fkey" FOREIGN KEY ("messageOid") REFERENCES "SessionMessage"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolCall" ADD CONSTRAINT "ToolCall_sessionOid_fkey" FOREIGN KEY ("sessionOid") REFERENCES "Session"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolCall" ADD CONSTRAINT "ToolCall_sessionProviderOid_fkey" FOREIGN KEY ("sessionProviderOid") REFERENCES "SessionProvider"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolCall" ADD CONSTRAINT "ToolCall_providerRunOid_fkey" FOREIGN KEY ("providerRunOid") REFERENCES "ProviderRun"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolCall" ADD CONSTRAINT "ToolCall_toolOid_fkey" FOREIGN KEY ("toolOid") REFERENCES "ProviderTool"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolCall" ADD CONSTRAINT "ToolCall_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolCall" ADD CONSTRAINT "ToolCall_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolCall" ADD CONSTRAINT "ToolCall_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolCall" ADD CONSTRAINT "ToolCall_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolCall" ADD CONSTRAINT "ToolCall_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolCallAttachment" ADD CONSTRAINT "ToolCallAttachment_toolCallOid_fkey" FOREIGN KEY ("toolCallOid") REFERENCES "ToolCall"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionParticipant" ADD CONSTRAINT "SessionParticipant_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionParticipant" ADD CONSTRAINT "SessionParticipant_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionParticipant" ADD CONSTRAINT "SessionParticipant_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionParticipant" ADD CONSTRAINT "SessionParticipant_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionParticipant" ADD CONSTRAINT "SessionParticipant_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionParticipant" ADD CONSTRAINT "SessionParticipant_agentInstanceOid_fkey" FOREIGN KEY ("agentInstanceOid") REFERENCES "AgentInstance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionParticipant" ADD CONSTRAINT "SessionParticipant_identityActorOid_fkey" FOREIGN KEY ("identityActorOid") REFERENCES "IdentityActor"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionParticipant" ADD CONSTRAINT "SessionParticipant_identityOid_fkey" FOREIGN KEY ("identityOid") REFERENCES "Identity"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtoGuardTenantSetting" ADD CONSTRAINT "ProtoGuardTenantSetting_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtoGuardTenantSetting" ADD CONSTRAINT "ProtoGuardTenantSetting_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtoGuardTenantFilterSetting" ADD CONSTRAINT "ProtoGuardTenantFilterSetting_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtoGuardTenantFilterSetting" ADD CONSTRAINT "ProtoGuardTenantFilterSetting_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtoGuardTenantFilterSetting" ADD CONSTRAINT "ProtoGuardTenantFilterSetting_filterOid_fkey" FOREIGN KEY ("filterOid") REFERENCES "ProtoGuardFilter"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtoGuardRun" ADD CONSTRAINT "ProtoGuardRun_messageOid_fkey" FOREIGN KEY ("messageOid") REFERENCES "SessionMessage"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtoGuardRun" ADD CONSTRAINT "ProtoGuardRun_sessionOid_fkey" FOREIGN KEY ("sessionOid") REFERENCES "Session"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtoGuardRun" ADD CONSTRAINT "ProtoGuardRun_connectionOid_fkey" FOREIGN KEY ("connectionOid") REFERENCES "SessionConnection"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtoGuardRun" ADD CONSTRAINT "ProtoGuardRun_providerRunOid_fkey" FOREIGN KEY ("providerRunOid") REFERENCES "ProviderRun"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtoGuardRun" ADD CONSTRAINT "ProtoGuardRun_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtoGuardRun" ADD CONSTRAINT "ProtoGuardRun_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtoGuardRun" ADD CONSTRAINT "ProtoGuardRun_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtoGuardRun" ADD CONSTRAINT "ProtoGuardRun_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtoGuardRun" ADD CONSTRAINT "ProtoGuardRun_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtoGuardAlert" ADD CONSTRAINT "ProtoGuardAlert_runOid_fkey" FOREIGN KEY ("runOid") REFERENCES "ProtoGuardRun"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtoGuardAlert" ADD CONSTRAINT "ProtoGuardAlert_messageOid_fkey" FOREIGN KEY ("messageOid") REFERENCES "SessionMessage"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtoGuardAlert" ADD CONSTRAINT "ProtoGuardAlert_sessionOid_fkey" FOREIGN KEY ("sessionOid") REFERENCES "Session"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtoGuardAlert" ADD CONSTRAINT "ProtoGuardAlert_connectionOid_fkey" FOREIGN KEY ("connectionOid") REFERENCES "SessionConnection"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtoGuardAlert" ADD CONSTRAINT "ProtoGuardAlert_providerRunOid_fkey" FOREIGN KEY ("providerRunOid") REFERENCES "ProviderRun"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtoGuardAlert" ADD CONSTRAINT "ProtoGuardAlert_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtoGuardAlert" ADD CONSTRAINT "ProtoGuardAlert_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtoGuardAlert" ADD CONSTRAINT "ProtoGuardAlert_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtoGuardAlert" ADD CONSTRAINT "ProtoGuardAlert_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtoGuardAlert" ADD CONSTRAINT "ProtoGuardAlert_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtoGuardAlertInstance" ADD CONSTRAINT "ProtoGuardAlertInstance_alertOid_fkey" FOREIGN KEY ("alertOid") REFERENCES "ProtoGuardAlert"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProtoGuardAlertInstance" ADD CONSTRAINT "ProtoGuardAlertInstance_filterOid_fkey" FOREIGN KEY ("filterOid") REFERENCES "ProtoGuardFilter"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionProvider" ADD CONSTRAINT "SessionProvider_sessionOid_fkey" FOREIGN KEY ("sessionOid") REFERENCES "Session"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionProvider" ADD CONSTRAINT "SessionProvider_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionProvider" ADD CONSTRAINT "SessionProvider_deploymentOid_fkey" FOREIGN KEY ("deploymentOid") REFERENCES "ProviderDeployment"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionProvider" ADD CONSTRAINT "SessionProvider_configOid_fkey" FOREIGN KEY ("configOid") REFERENCES "ProviderConfig"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionProvider" ADD CONSTRAINT "SessionProvider_authConfigOid_fkey" FOREIGN KEY ("authConfigOid") REFERENCES "ProviderAuthConfig"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionProvider" ADD CONSTRAINT "SessionProvider_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionProvider" ADD CONSTRAINT "SessionProvider_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionProvider" ADD CONSTRAINT "SessionProvider_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionProvider" ADD CONSTRAINT "SessionProvider_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionProvider" ADD CONSTRAINT "SessionProvider_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionProvider" ADD CONSTRAINT "SessionProvider_fromTemplateOid_fkey" FOREIGN KEY ("fromTemplateOid") REFERENCES "SessionTemplate"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionProvider" ADD CONSTRAINT "SessionProvider_fromTemplateProviderOid_fkey" FOREIGN KEY ("fromTemplateProviderOid") REFERENCES "SessionTemplateProvider"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionProvider" ADD CONSTRAINT "SessionProvider_ownerPublicMcpServerOid_fkey" FOREIGN KEY ("ownerPublicMcpServerOid") REFERENCES "PublicMcpServer"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderRun" ADD CONSTRAINT "ProviderRun_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderRun" ADD CONSTRAINT "ProviderRun_sessionProviderOid_fkey" FOREIGN KEY ("sessionProviderOid") REFERENCES "SessionProvider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderRun" ADD CONSTRAINT "ProviderRun_providerVersionOid_fkey" FOREIGN KEY ("providerVersionOid") REFERENCES "ProviderVersion"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderRun" ADD CONSTRAINT "ProviderRun_sessionOid_fkey" FOREIGN KEY ("sessionOid") REFERENCES "Session"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderRun" ADD CONSTRAINT "ProviderRun_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "SessionProviderInstance"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderRun" ADD CONSTRAINT "ProviderRun_connectionOid_fkey" FOREIGN KEY ("connectionOid") REFERENCES "SessionConnection"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderRun" ADD CONSTRAINT "ProviderRun_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderRun" ADD CONSTRAINT "ProviderRun_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderRun" ADD CONSTRAINT "ProviderRun_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderRun" ADD CONSTRAINT "ProviderRun_metorialInstanceOid_fkey" FOREIGN KEY ("metorialInstanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderRun" ADD CONSTRAINT "ProviderRun_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionProviderInstance" ADD CONSTRAINT "SessionProviderInstance_sessionOid_fkey" FOREIGN KEY ("sessionOid") REFERENCES "Session"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionProviderInstance" ADD CONSTRAINT "SessionProviderInstance_sessionProviderOid_fkey" FOREIGN KEY ("sessionProviderOid") REFERENCES "SessionProvider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionProviderInstance" ADD CONSTRAINT "SessionProviderInstance_pairOid_fkey" FOREIGN KEY ("pairOid") REFERENCES "ProviderDeploymentConfigPair"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionProviderInstance" ADD CONSTRAINT "SessionProviderInstance_pairVersionOid_fkey" FOREIGN KEY ("pairVersionOid") REFERENCES "ProviderDeploymentConfigPairProviderVersion"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_adapterGlobalOid_fkey" FOREIGN KEY ("adapterGlobalOid") REFERENCES "ProviderAdapterGlobal"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_identityActorOid_fkey" FOREIGN KEY ("identityActorOid") REFERENCES "IdentityActor"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_identityOid_fkey" FOREIGN KEY ("identityOid") REFERENCES "Identity"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_ownerActorOid_fkey" FOREIGN KEY ("ownerActorOid") REFERENCES "IdentityActor"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_ephemeralManagedSessionOid_fkey" FOREIGN KEY ("ephemeralManagedSessionOid") REFERENCES "EphemeralManagedSession"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_ownerPublicMcpServerOid_fkey" FOREIGN KEY ("ownerPublicMcpServerOid") REFERENCES "PublicMcpServer"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionTemplate" ADD CONSTRAINT "SessionTemplate_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionTemplate" ADD CONSTRAINT "SessionTemplate_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionTemplate" ADD CONSTRAINT "SessionTemplate_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionTemplate" ADD CONSTRAINT "SessionTemplate_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionTemplate" ADD CONSTRAINT "SessionTemplate_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionTemplate" ADD CONSTRAINT "SessionTemplate_identityActorOid_fkey" FOREIGN KEY ("identityActorOid") REFERENCES "IdentityActor"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionTemplate" ADD CONSTRAINT "SessionTemplate_identityOid_fkey" FOREIGN KEY ("identityOid") REFERENCES "Identity"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionTemplate" ADD CONSTRAINT "SessionTemplate_ownerActorOid_fkey" FOREIGN KEY ("ownerActorOid") REFERENCES "IdentityActor"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionTemplate" ADD CONSTRAINT "SessionTemplate_integrationInstanceOid_fkey" FOREIGN KEY ("integrationInstanceOid") REFERENCES "IntegrationInstance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionTemplate" ADD CONSTRAINT "SessionTemplate_integrationInstanceGroupOid_fkey" FOREIGN KEY ("integrationInstanceGroupOid") REFERENCES "IntegrationInstanceGroup"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionTemplate" ADD CONSTRAINT "stm_default_for_instance_fkey" FOREIGN KEY ("defaultSessionTemplateForIntegrationInstanceOid") REFERENCES "IntegrationInstance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionTemplate" ADD CONSTRAINT "stm_default_for_instance_group_fkey" FOREIGN KEY ("defaultSessionTemplateForIntegrationInstanceGroupOid") REFERENCES "IntegrationInstanceGroup"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionTemplateProvider" ADD CONSTRAINT "SessionTemplateProvider_sessionTemplateOid_fkey" FOREIGN KEY ("sessionTemplateOid") REFERENCES "SessionTemplate"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionTemplateProvider" ADD CONSTRAINT "SessionTemplateProvider_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionTemplateProvider" ADD CONSTRAINT "SessionTemplateProvider_deploymentOid_fkey" FOREIGN KEY ("deploymentOid") REFERENCES "ProviderDeployment"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionTemplateProvider" ADD CONSTRAINT "SessionTemplateProvider_configOid_fkey" FOREIGN KEY ("configOid") REFERENCES "ProviderConfig"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionTemplateProvider" ADD CONSTRAINT "SessionTemplateProvider_authConfigOid_fkey" FOREIGN KEY ("authConfigOid") REFERENCES "ProviderAuthConfig"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionTemplateProvider" ADD CONSTRAINT "SessionTemplateProvider_integrationInstanceProviderOid_fkey" FOREIGN KEY ("integrationInstanceProviderOid") REFERENCES "IntegrationInstanceProvider"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionTemplateProvider" ADD CONSTRAINT "SessionTemplateProvider_integrationInstanceGroupProviderOi_fkey" FOREIGN KEY ("integrationInstanceGroupProviderOid") REFERENCES "IntegrationInstanceGroupProvider"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionTemplateProvider" ADD CONSTRAINT "SessionTemplateProvider_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionTemplateProvider" ADD CONSTRAINT "SessionTemplateProvider_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionTemplateProvider" ADD CONSTRAINT "SessionTemplateProvider_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionTemplateProvider" ADD CONSTRAINT "SessionTemplateProvider_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionTemplateProvider" ADD CONSTRAINT "SessionTemplateProvider_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionUsageRecord" ADD CONSTRAINT "SessionUsageRecord_sessionOid_fkey" FOREIGN KEY ("sessionOid") REFERENCES "Session"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionUsageRecord" ADD CONSTRAINT "SessionUsageRecord_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionUsageRecord" ADD CONSTRAINT "SessionUsageRecord_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionUsageRecord" ADD CONSTRAINT "SessionUsageRecord_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderRunUsageRecord" ADD CONSTRAINT "ProviderRunUsageRecord_providerRunOid_fkey" FOREIGN KEY ("providerRunOid") REFERENCES "ProviderRun"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderRunUsageRecord" ADD CONSTRAINT "ProviderRunUsageRecord_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderRunUsageRecord" ADD CONSTRAINT "ProviderRunUsageRecord_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderRunUsageRecord" ADD CONSTRAINT "ProviderRunUsageRecord_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionWarning" ADD CONSTRAINT "SessionWarning_sessionOid_fkey" FOREIGN KEY ("sessionOid") REFERENCES "Session"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionWarning" ADD CONSTRAINT "SessionWarning_connectionOid_fkey" FOREIGN KEY ("connectionOid") REFERENCES "SessionConnection"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionWarning" ADD CONSTRAINT "SessionWarning_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionWarning" ADD CONSTRAINT "SessionWarning_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionWarning" ADD CONSTRAINT "SessionWarning_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionWarning" ADD CONSTRAINT "SessionWarning_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionWarning" ADD CONSTRAINT "SessionWarning_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillEntity" ADD CONSTRAINT "SkillEntity_ownerSkillOid_fkey" FOREIGN KEY ("ownerSkillOid") REFERENCES "Skill"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillEntity" ADD CONSTRAINT "SkillEntity_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillEntity" ADD CONSTRAINT "SkillEntity_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillEntity" ADD CONSTRAINT "SkillEntity_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillEntity" ADD CONSTRAINT "SkillEntity_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillEntity" ADD CONSTRAINT "SkillEntity_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_skillEntityOid_fkey" FOREIGN KEY ("skillEntityOid") REFERENCES "SkillEntity"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_forkedFromSkillOid_fkey" FOREIGN KEY ("forkedFromSkillOid") REFERENCES "Skill"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_duplicatedFromSkillOid_fkey" FOREIGN KEY ("duplicatedFromSkillOid") REFERENCES "Skill"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_parentTemplateOid_fkey" FOREIGN KEY ("parentTemplateOid") REFERENCES "SkillTemplate"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillIntegration" ADD CONSTRAINT "SkillIntegration_skillOid_fkey" FOREIGN KEY ("skillOid") REFERENCES "Skill"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillIntegration" ADD CONSTRAINT "SkillIntegration_integrationOid_fkey" FOREIGN KEY ("integrationOid") REFERENCES "Integration"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillIntegration" ADD CONSTRAINT "SkillIntegration_itemOid_fkey" FOREIGN KEY ("itemOid") REFERENCES "SkillItem"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillProvider" ADD CONSTRAINT "SkillProvider_skillOid_fkey" FOREIGN KEY ("skillOid") REFERENCES "Skill"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillProvider" ADD CONSTRAINT "SkillProvider_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillProvider" ADD CONSTRAINT "SkillProvider_itemOid_fkey" FOREIGN KEY ("itemOid") REFERENCES "SkillItem"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillProviderLink" ADD CONSTRAINT "SkillProviderLink_skillOid_fkey" FOREIGN KEY ("skillOid") REFERENCES "Skill"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillProviderLink" ADD CONSTRAINT "SkillProviderLink_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillItem" ADD CONSTRAINT "SkillItem_skillOid_fkey" FOREIGN KEY ("skillOid") REFERENCES "Skill"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillTemplate" ADD CONSTRAINT "SkillTemplate_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillTemplate" ADD CONSTRAINT "SkillTemplate_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillTemplate" ADD CONSTRAINT "SkillTemplate_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillTemplate" ADD CONSTRAINT "SkillTemplate_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillTemplate" ADD CONSTRAINT "SkillTemplate_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillTemplateItem" ADD CONSTRAINT "SkillTemplateItem_skillTemplateOid_fkey" FOREIGN KEY ("skillTemplateOid") REFERENCES "SkillTemplate"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillTemplateItem" ADD CONSTRAINT "SkillTemplateItem_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillTemplateItem" ADD CONSTRAINT "SkillTemplateItem_integrationOid_fkey" FOREIGN KEY ("integrationOid") REFERENCES "Integration"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consumer" ADD CONSTRAINT "Consumer_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consumer" ADD CONSTRAINT "Consumer_organizationMemberOid_fkey" FOREIGN KEY ("organizationMemberOid") REFERENCES "OrganizationMember"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consumer" ADD CONSTRAINT "Consumer_organizationActorOid_fkey" FOREIGN KEY ("organizationActorOid") REFERENCES "OrganizationActor"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE "ConsumerProfile" ADD CONSTRAINT "ConsumerProfile_consumerOid_fkey" FOREIGN KEY ("consumerOid") REFERENCES "Consumer"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerProfile" ADD CONSTRAINT "ConsumerProfile_organizationMemberOid_fkey" FOREIGN KEY ("organizationMemberOid") REFERENCES "OrganizationMember"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumerProfile" ADD CONSTRAINT "ConsumerProfile_organizationActorOid_fkey" FOREIGN KEY ("organizationActorOid") REFERENCES "OrganizationActor"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Instance" ADD CONSTRAINT "Instance_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Instance" ADD CONSTRAINT "Instance_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Instance" ADD CONSTRAINT "Instance_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Environment" ADD CONSTRAINT "Environment_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Environment" ADD CONSTRAINT "Environment_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Actor" ADD CONSTRAINT "Actor_organizationActorOid_fkey" FOREIGN KEY ("organizationActorOid") REFERENCES "OrganizationActor"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Actor" ADD CONSTRAINT "Actor_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Actor" ADD CONSTRAINT "Actor_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationActor" ADD CONSTRAINT "OrganizationActor_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_actorOid_fkey" FOREIGN KEY ("actorOid") REFERENCES "OrganizationActor"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_organizationOid_fkey" FOREIGN KEY ("organizationOid") REFERENCES "Organization"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Brand" ADD CONSTRAINT "Brand_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Brand" ADD CONSTRAINT "Brand_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderSetupSession" ADD CONSTRAINT "ProviderSetupSession_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderSetupSession" ADD CONSTRAINT "ProviderSetupSession_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderSetupSession" ADD CONSTRAINT "ProviderSetupSession_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderSetupSession" ADD CONSTRAINT "ProviderSetupSession_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderSetupSession" ADD CONSTRAINT "ProviderSetupSession_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderSetupSession" ADD CONSTRAINT "ProviderSetupSession_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderSetupSession" ADD CONSTRAINT "ProviderSetupSession_authMethodOid_fkey" FOREIGN KEY ("authMethodOid") REFERENCES "ProviderAuthMethod"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderSetupSession" ADD CONSTRAINT "ProviderSetupSession_deploymentOid_fkey" FOREIGN KEY ("deploymentOid") REFERENCES "ProviderDeployment"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderSetupSession" ADD CONSTRAINT "ProviderSetupSession_identityOid_fkey" FOREIGN KEY ("identityOid") REFERENCES "Identity"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderSetupSession" ADD CONSTRAINT "ProviderSetupSession_ownerActorOid_fkey" FOREIGN KEY ("ownerActorOid") REFERENCES "IdentityActor"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderSetupSession" ADD CONSTRAINT "ProviderSetupSession_authConfigOid_fkey" FOREIGN KEY ("authConfigOid") REFERENCES "ProviderAuthConfig"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderSetupSession" ADD CONSTRAINT "ProviderSetupSession_configOid_fkey" FOREIGN KEY ("configOid") REFERENCES "ProviderConfig"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderSetupSession" ADD CONSTRAINT "ProviderSetupSession_identityCredentialOid_fkey" FOREIGN KEY ("identityCredentialOid") REFERENCES "IdentityCredential"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderSetupSession" ADD CONSTRAINT "ProviderSetupSession_oauthSetupOid_fkey" FOREIGN KEY ("oauthSetupOid") REFERENCES "ProviderOAuthSetup"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderSetupSession" ADD CONSTRAINT "ProviderSetupSession_authCredentialsOid_fkey" FOREIGN KEY ("authCredentialsOid") REFERENCES "ProviderAuthCredentials"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderSetupSession" ADD CONSTRAINT "ProviderSetupSession_brandOid_fkey" FOREIGN KEY ("brandOid") REFERENCES "Brand"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderSetupSession" ADD CONSTRAINT "ProviderSetupSession_ownerPublicMcpServerOid_fkey" FOREIGN KEY ("ownerPublicMcpServerOid") REFERENCES "PublicMcpServer"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderSetupSession" ADD CONSTRAINT "ProviderSetupSession_integrationSetupSessionProviderOid_fkey" FOREIGN KEY ("integrationSetupSessionProviderOid") REFERENCES "IntegrationSetupSessionProvider"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderSetupSessionEvent" ADD CONSTRAINT "ProviderSetupSessionEvent_setupOid_fkey" FOREIGN KEY ("setupOid") REFERENCES "ProviderOAuthSetup"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderSetupSessionEvent" ADD CONSTRAINT "ProviderSetupSessionEvent_sessionOid_fkey" FOREIGN KEY ("sessionOid") REFERENCES "ProviderSetupSession"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderSetupSessionEmail" ADD CONSTRAINT "ProviderSetupSessionEmail_setupSessionOid_fkey" FOREIGN KEY ("setupSessionOid") REFERENCES "ProviderSetupSession"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderSetupSessionEmail" ADD CONSTRAINT "ProviderSetupSessionEmail_senderActorOid_fkey" FOREIGN KEY ("senderActorOid") REFERENCES "Actor"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationSetupSession" ADD CONSTRAINT "IntegrationSetupSession_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationSetupSession" ADD CONSTRAINT "IntegrationSetupSession_projectOid_fkey" FOREIGN KEY ("projectOid") REFERENCES "Project"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationSetupSession" ADD CONSTRAINT "IntegrationSetupSession_environmentOid_fkey" FOREIGN KEY ("environmentOid") REFERENCES "Environment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationSetupSession" ADD CONSTRAINT "IntegrationSetupSession_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "Instance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationSetupSession" ADD CONSTRAINT "IntegrationSetupSession_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationSetupSession" ADD CONSTRAINT "IntegrationSetupSession_integrationOid_fkey" FOREIGN KEY ("integrationOid") REFERENCES "Integration"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationSetupSession" ADD CONSTRAINT "IntegrationSetupSession_integrationInstanceOid_fkey" FOREIGN KEY ("integrationInstanceOid") REFERENCES "IntegrationInstance"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationSetupSession" ADD CONSTRAINT "IntegrationSetupSession_ownerActorOid_fkey" FOREIGN KEY ("ownerActorOid") REFERENCES "IdentityActor"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationSetupSession" ADD CONSTRAINT "IntegrationSetupSession_brandOid_fkey" FOREIGN KEY ("brandOid") REFERENCES "Brand"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationSetupSessionProvider" ADD CONSTRAINT "IntegrationSetupSessionProvider_integrationSetupSessionOid_fkey" FOREIGN KEY ("integrationSetupSessionOid") REFERENCES "IntegrationSetupSession"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationSetupSessionProvider" ADD CONSTRAINT "IntegrationSetupSessionProvider_integrationProviderOid_fkey" FOREIGN KEY ("integrationProviderOid") REFERENCES "IntegrationProvider"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationSetupSessionProvider" ADD CONSTRAINT "IntegrationSetupSessionProvider_providerSetupSessionOid_fkey" FOREIGN KEY ("providerSetupSessionOid") REFERENCES "ProviderSetupSession"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationSetupSessionProvider" ADD CONSTRAINT "IntegrationSetupSessionProvider_integrationInstanceProvide_fkey" FOREIGN KEY ("integrationInstanceProviderOid") REFERENCES "IntegrationInstanceProvider"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationSetupSessionStep" ADD CONSTRAINT "IntegrationSetupSessionStep_integrationSetupSessionOid_fkey" FOREIGN KEY ("integrationSetupSessionOid") REFERENCES "IntegrationSetupSession"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationSetupSessionStep" ADD CONSTRAINT "IntegrationSetupSessionStep_integrationSetupSessionProvide_fkey" FOREIGN KEY ("integrationSetupSessionProviderOid") REFERENCES "IntegrationSetupSessionProvider"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationSetupSessionEvent" ADD CONSTRAINT "IntegrationSetupSessionEvent_integrationSetupSessionProvid_fkey" FOREIGN KEY ("integrationSetupSessionProviderOid") REFERENCES "IntegrationSetupSessionProvider"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationSetupSessionEvent" ADD CONSTRAINT "IntegrationSetupSessionEvent_integrationSetupSessionOid_fkey" FOREIGN KEY ("integrationSetupSessionOid") REFERENCES "IntegrationSetupSession"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProviderListingToProviderListingCategory" ADD CONSTRAINT "_ProviderListingToProviderListingCategory_A_fkey" FOREIGN KEY ("A") REFERENCES "ProviderListing"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProviderListingToProviderListingCategory" ADD CONSTRAINT "_ProviderListingToProviderListingCategory_B_fkey" FOREIGN KEY ("B") REFERENCES "ProviderListingCategory"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProviderListingToProviderListingCollection" ADD CONSTRAINT "_ProviderListingToProviderListingCollection_A_fkey" FOREIGN KEY ("A") REFERENCES "ProviderListing"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProviderListingToProviderListingCollection" ADD CONSTRAINT "_ProviderListingToProviderListingCollection_B_fkey" FOREIGN KEY ("B") REFERENCES "ProviderListingCollection"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProviderListingToProviderListingGroup" ADD CONSTRAINT "_ProviderListingToProviderListingGroup_A_fkey" FOREIGN KEY ("A") REFERENCES "ProviderListing"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProviderListingToProviderListingGroup" ADD CONSTRAINT "_ProviderListingToProviderListingGroup_B_fkey" FOREIGN KEY ("B") REFERENCES "ProviderListingGroup"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

