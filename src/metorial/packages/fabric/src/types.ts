import { Context } from '@metorial/context';
import {
  AccessPolicy,
  AccessPolicyAssignment,
  AccessRole,
  ApiKey,
  ConsumerAuthTenant,
  ConsumerInvite,
  ConsumerProfile,
  ConsumerSurface,
  Instance,
  MachineAccess,
  MagicMcpEndpoint,
  MagicMcpServer,
  OAuthApplication,
  OAuthAuthorization,
  OAuthInstallation,
  OAuthToken,
  Organization,
  OrganizationActor,
  OrganizationInvite,
  OrganizationInviteJoin,
  OrganizationMember,
  Portal,
  Project,
  ServiceAccount,
  ServiceAccountCredential,
  Skill,
  SkillMarketplace,
  SkillPlugin,
  Team,
  TeamMember,
  TeamProject,
  User,
  UserSession,
  Workspace,
  WorkspaceInvite,
  WorkspaceProfile
} from '@metorial/db';
import type { OAuthAuthorizationRequestWithRelations } from '@metorial/module-machine-access';
import type {
  SubspaceCallback,
  SubspaceCallbackDestination,
  SubspaceCallbackInstance,
  SubspaceCustomProvider,
  SubspaceCustomProviderCommit,
  SubspaceCustomProviderVersion,
  SubspaceFirewall,
  SubspaceFirewallBinding,
  SubspaceIntegration,
  SubspaceIntegrationInstance,
  SubspaceIntegrationSetupSession,
  SubspaceNetworkPolicy,
  SubspaceNetworkPolicyRule,
  SubspaceProviderAuthConfig,
  SubspaceProviderAuthCredentials,
  SubspaceProviderAuthExport,
  SubspaceProviderAuthImport,
  SubspaceProviderConfig,
  SubspaceProviderConfigVault,
  SubspaceProviderDeployment,
  SubspaceProviderListingGroup,
  SubspaceProviderSetupSession,
  SubspaceSession,
  SubspaceSessionProvider,
  SubspaceSessionTemplate,
  SubspaceSessionTemplateProvider,
  SubspaceToolCall
} from '@metorial/module-subspace';

export type MachineAccessInput =
  | {
      type: 'organization_management';
      organization: Organization;
      performedBy: OrganizationActor;
    }
  | {
      type: 'instance_secret' | 'instance_publishable';
      organization: Organization;
      instance: Instance;
      performedBy: OrganizationActor;
    };

export type OAuthApplicationCreateInput = {
  status?: 'active' | 'archived';
  type: 'user_facing' | 'server_side' | 'cli_auth' | 'internal';
  accessLevel: 'organization' | 'global';
  systemIdentifier?: string | null;
  allowClientSecretlessTokenExchange?: boolean;
  name: string;
  description?: string | null;
  websiteUrl?: string;
  privacyPolicyUrl?: string;
  termsOfServiceUrl?: string;
  redirectUris?: string[];
  scopes: string[];
  image?: PrismaJson.EntityImage;
};

export type OAuthApplicationUpdateInput = {
  accessLevel?: 'organization' | 'global';
  allowClientSecretlessTokenExchange?: boolean;
  name?: string;
  description?: string | null;
  websiteUrl?: string | null;
  privacyPolicyUrl?: string | null;
  termsOfServiceUrl?: string | null;
  redirectUris?: string[];
  scopes?: string[];
  image?: PrismaJson.EntityImage;
};

export type ServiceAccountCreateInput = {
  name: string;
  description?: string;
  scopes: string[];
};

export type ServiceAccountUpdateInput = {
  name?: string;
  description?: string | null;
  scopes?: string[];
};

export type ProviderEventBase = {
  instance: Instance;
  organizationActor?: OrganizationActor;
  input?: Record<string, any>;
};

export type KeyProviderEventKeyProvider = {
  object: 'nebula#key_provider';
  id: string;
  name: string;
  type: 'aws_kms' | 'local';
  owner: 'tenant' | 'system';
  status: 'active' | 'inactive' | 'degraded';
  isMetorialManaged: boolean;
  keyReuseTimeSeconds: number | null;
  keyInfo: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type KeyProviderEventValidation = {
  object: 'key_provider_validation';
  keyProviderId: string;
  description: Record<string, unknown>;
};

export type KeyProviderEventBase = {
  organization: Organization;
  project: Project;
  performedBy: OrganizationActor;
  context?: Context;
};

// prettier-ignore
export interface FabricEvents {
  'user.created:before': { context?: Context };
  'user.created:after': { user: User, performedBy: User; context?: Context };
  'user.updated:before': { user: User, performedBy: User; context?: Context };
  'user.updated:after': { user: User, performedBy: User; context?: Context };
  'user.deleted:before': { user: User, performedBy: User; context?: Context };
  'user.deleted:after': { user: User, performedBy: User; context?: Context };

  'user.session.created:before': { user: User, performedBy: User; context?: Context };
  'user.session.created:after': { user: User, session: UserSession, performedBy: User; context?: Context };
  'user.session.deleted:before': { user: User, session: UserSession, performedBy: User; context?: Context };
  'user.session.deleted:after': { user: User, session: UserSession, performedBy: User; context?: Context };

  'organization.created:before': { performedBy: User; context: Context };
  'organization.created:after': { organization: Organization, performedBy: User; context: Context };
  'organization.updated:before': { organization: Organization, performedBy: OrganizationActor; context: Context };
  'organization.updated:after': { organization: Organization, performedBy: OrganizationActor; context: Context };
  'organization.deleted:before': { organization: Organization, performedBy: OrganizationActor; context: Context };
  'organization.deleted:after': { organization: Organization, performedBy: OrganizationActor; context: Context };

  'organization.actor.created:before': { organization: Organization, performedBy: {type: 'user', user: User} | {type: 'actor', actor: OrganizationActor}; context?: Context };
  'organization.actor.created:after': { organization: Organization, actor: OrganizationActor; performedBy: OrganizationActor; context?: Context };
  'organization.actor.updated:before': { organization: Organization, actor: OrganizationActor; performedBy: OrganizationActor; context?: Context };
  'organization.actor.updated:after': { organization: Organization, actor: OrganizationActor; performedBy: OrganizationActor; context?: Context };

  'organization.member.created:before': { organization: Organization; actor: OrganizationActor; user: User; performedBy: OrganizationActor; context?: Context };
  'organization.member.created:after': { organization: Organization; actor: OrganizationActor; user: User; member: OrganizationMember, performedBy: OrganizationActor; context?: Context };
  'organization.member.updated:before': { organization: Organization; member: OrganizationMember, performedBy: OrganizationActor; context?: Context };
  'organization.member.updated:after': { organization: Organization; member: OrganizationMember, performedBy: OrganizationActor; context?: Context };
  'organization.member.deleted:before': { organization: Organization; member: OrganizationMember, performedBy: OrganizationActor; context?: Context };
  'organization.member.deleted:after': { organization: Organization; member: OrganizationMember, performedBy: OrganizationActor; context?: Context };

  'organization.invitation.created:before': { organization: Organization, performedBy: OrganizationActor; context?: Context };
  'organization.invitation.created:after': { organization: Organization, invite: OrganizationInvite; performedBy: OrganizationActor; context?: Context };
  'organization.invitation.updated:before': { organization: Organization, invite: OrganizationInvite; performedBy: OrganizationActor; context?: Context };
  'organization.invitation.updated:after': { organization: Organization, invite: OrganizationInvite; performedBy: OrganizationActor; context?: Context };
  'organization.invitation.deleted:before': { organization: Organization, invite: OrganizationInvite; performedBy: OrganizationActor; context?: Context };
  'organization.invitation.deleted:after': { organization: Organization, invite: OrganizationInvite; performedBy: OrganizationActor; context?: Context };
  
  'organization.invitation.accepted:before': { organization: Organization, invite: OrganizationInvite; user: User; performedBy: OrganizationActor; context?: Context };
  'organization.invitation.accepted:after': { organization: Organization, invite: OrganizationInvite; user: User; performedBy: OrganizationActor; context?: Context };
  'organization.invitation.rejected:before': { organization: Organization, invite: OrganizationInvite; user: User; performedBy: OrganizationActor; context?: Context };
  'organization.invitation.rejected:after': { organization: Organization, invite: OrganizationInvite; user: User; performedBy: OrganizationActor; context?: Context };

  'organization.invitation.join.created:before': { organization: Organization, member: OrganizationMember; invite: OrganizationInvite; performedBy: OrganizationActor; context?: Context };
  'organization.invitation.join.created:after': { organization: Organization, member: OrganizationMember; invite: OrganizationInvite; join: OrganizationInviteJoin; performedBy: OrganizationActor; context?: Context };

  'organization.project.created:before': { organization: Organization, performedBy: OrganizationActor; context?: Context };
  'organization.project.created:after': { organization: Organization, project: Project, performedBy: OrganizationActor; context?: Context };
  'organization.project.updated:before': { organization: Organization, project: Project, performedBy: OrganizationActor; context?: Context };
  'organization.project.updated:after': { organization: Organization, project: Project, performedBy: OrganizationActor; context?: Context };
  'organization.project.retention.updated:before': { organization: Organization, project: Project, performedBy: OrganizationActor; context?: Context; input: { logRetentionInDays?: number; enforceSessionExpiry?: boolean } };
  'organization.project.retention.updated:after': { organization: Organization, project: Project, performedBy: OrganizationActor; context?: Context; input: { logRetentionInDays?: number; enforceSessionExpiry?: boolean } };
  'organization.project.auth_config_configuration.updated:before': { organization: Organization, project: Project, performedBy: OrganizationActor; context?: Context; input: { allowAuthConfigExport?: boolean; allowAuthConfigImport?: boolean } };
  'organization.project.auth_config_configuration.updated:after': { organization: Organization, project: Project, performedBy: OrganizationActor; context?: Context; input: { allowAuthConfigExport?: boolean; allowAuthConfigImport?: boolean }; configuration: { allowAuthConfigExport: boolean; allowAuthConfigImport: boolean } };
  'organization.project.integration_naming_configuration.updated:before': { organization: Organization, project: Project, performedBy: OrganizationActor; context?: Context; input: { useIntegrationNames?: boolean } };
  'organization.project.integration_naming_configuration.updated:after': { organization: Organization, project: Project, performedBy: OrganizationActor; context?: Context; input: { useIntegrationNames?: boolean }; configuration: { useIntegrationNames: boolean } };
  'organization.project.tool_calling_configuration.updated:before': { organization: Organization, project: Project, performedBy: OrganizationActor; context?: Context; input: { collectOperationDescriptionForToolCalls?: boolean, messageProcessingTimeoutMs?: number } };
  'organization.project.tool_calling_configuration.updated:after': { organization: Organization, project: Project, performedBy: OrganizationActor; context?: Context; input: { collectOperationDescriptionForToolCalls?: boolean, messageProcessingTimeoutMs?: number }; configuration: { collectOperationDescriptionForToolCalls: boolean, messageProcessingTimeoutMs?: number } };
  'organization.project.deleted:before': { organization: Organization, project: Project, performedBy: OrganizationActor; context?: Context };
  'organization.project.deleted:after': { organization: Organization, project: Project, performedBy: OrganizationActor; context?: Context };

  'organization.project.instance.created:before': { organization: Organization, project: Project, performedBy: OrganizationActor; context?: Context };
  'organization.project.instance.created:after': { organization: Organization, project: Project; instance: Instance, performedBy: OrganizationActor; context?: Context };
  'organization.project.instance.updated:before': { organization: Organization, project: Project; instance: Instance, performedBy: OrganizationActor; context?: Context };
  'organization.project.instance.updated:after': { organization: Organization, project: Project; instance: Instance, performedBy: OrganizationActor; context?: Context };
  'organization.project.instance.deleted:before': { organization: Organization, project: Project; instance: Instance, performedBy: OrganizationActor; context?: Context };
  'organization.project.instance.deleted:after': { organization: Organization, project: Project; instance: Instance, performedBy: OrganizationActor; context?: Context };

  'key_provider.imported:before': KeyProviderEventBase & { currentCount: number };
  'key_provider.imported:after': KeyProviderEventBase & { keyProvider: KeyProviderEventKeyProvider };
  'key_provider.managed.created:before': KeyProviderEventBase & { currentCount: number };
  'key_provider.managed.created:after': KeyProviderEventBase & { keyProvider: KeyProviderEventKeyProvider };
  'key_provider.default.set:after': KeyProviderEventBase & { keyProvider: KeyProviderEventKeyProvider };
  'key_provider.validated:after': KeyProviderEventBase & { keyProvider: KeyProviderEventKeyProvider, validation: KeyProviderEventValidation };

  'organization.team.created:before': { organization: Organization, performedBy: OrganizationActor; context?: Context };
  'organization.team.created:after': { organization: Organization, team: Team, performedBy: OrganizationActor; context?: Context };
  'organization.team.updated:before': { organization: Organization, team: Team, performedBy: OrganizationActor; context?: Context };
  'organization.team.updated:after': { organization: Organization, team: Team, performedBy: OrganizationActor; context?: Context };
  'organization.team.deleted:before': { organization: Organization, team: Team, performedBy: OrganizationActor; context?: Context };
  'organization.team.deleted:after': { organization: Organization, team: Team, performedBy: OrganizationActor; context?: Context };

  'organization.team.member.added:before': { organization: Organization, team: Team, actor: OrganizationActor, performedBy: OrganizationActor; context?: Context };
  'organization.team.member.added:after': { organization: Organization, team: Team, actor: OrganizationActor, member: TeamMember; performedBy: OrganizationActor; context?: Context };
  'organization.team.member.removed:before': { organization: Organization, team: Team, actor: OrganizationActor, member: TeamMember; performedBy: OrganizationActor; context?: Context };
  'organization.team.member.removed:after': { organization: Organization, team: Team, actor: OrganizationActor, member: TeamMember; performedBy: OrganizationActor; context?: Context };

  'organization.team.project.assigned:before': { organization: Organization, team: Team, project: Project, performedBy: OrganizationActor; context?: Context };
  'organization.team.project.assigned:after': { organization: Organization, team: Team, project: Project, teamProject: TeamProject; performedBy: OrganizationActor; context?: Context };
  'organization.team.project.unassigned:before': { organization: Organization, team: Team, project: Project, teamProject: TeamProject; performedBy: OrganizationActor; context?: Context };
  'organization.team.project.unassigned:after': { organization: Organization, team: Team, project: Project, teamProject: TeamProject; performedBy: OrganizationActor; context?: Context };

  'organization.access_role.created:before': { organization: Organization; performedBy: OrganizationActor; context: Context; input: { name: string; description?: string; scopes?: string[]; isAdmin?: boolean; message?: string; } };
  'organization.access_role.created:after': { organization: Organization; performedBy: OrganizationActor; context: Context; input: { name: string; description?: string; scopes?: string[]; isAdmin?: boolean; message?: string; }; accessRole: AccessRole };
  'organization.access_role.updated:before': { organization: Organization; performedBy: OrganizationActor; context: Context; accessRole: AccessRole; input: { name?: string; description?: string | null; scopes?: string[]; message?: string; } };
  'organization.access_role.updated:after': { organization: Organization; performedBy: OrganizationActor; context: Context; accessRole: AccessRole; input: { name?: string; description?: string | null; scopes?: string[]; message?: string; } };
  'organization.access_role.deleted:before': { organization: Organization; performedBy: OrganizationActor; context: Context; accessRole: AccessRole };
  'organization.access_role.deleted:after': { organization: Organization; performedBy: OrganizationActor; context: Context; accessRole: AccessRole };

  'organization.access_policy.created:before': { organization: Organization; performedBy: OrganizationActor; context: Context; input: { name: string; description?: string; document: PrismaJson.PolicyDocument; type?: AccessPolicy['type']; message?: string; } };
  'organization.access_policy.created:after': { organization: Organization; performedBy: OrganizationActor; context: Context; input: { name: string; description?: string; document: PrismaJson.PolicyDocument; type?: AccessPolicy['type']; message?: string; }; accessPolicy: AccessPolicy };
  'organization.access_policy.updated:before': { organization: Organization; performedBy: OrganizationActor; context: Context; accessPolicy: AccessPolicy; input: { name?: string; description?: string | null; document?: PrismaJson.PolicyDocument; message?: string; } };
  'organization.access_policy.updated:after': { organization: Organization; performedBy: OrganizationActor; context: Context; accessPolicy: AccessPolicy; input: { name?: string; description?: string | null; document?: PrismaJson.PolicyDocument; message?: string; } };
  'organization.access_policy.deleted:before': { organization: Organization; performedBy: OrganizationActor; context: Context; accessPolicy: AccessPolicy };
  'organization.access_policy.deleted:after': { organization: Organization; performedBy: OrganizationActor; context: Context; accessPolicy: AccessPolicy };
  'organization.access_policy.assignment.team.created:before': { organization: Organization; team: Team; accessPolicy: AccessPolicy; performedBy: OrganizationActor; context: Context };
  'organization.access_policy.assignment.team.created:after': { organization: Organization; team: Team; accessPolicy: AccessPolicy; accessPolicyAssignment: AccessPolicyAssignment; performedBy: OrganizationActor; context: Context };
  'organization.access_policy.assignment.team.deleted:before': { organization: Organization; team: Team; accessPolicy: AccessPolicy; accessPolicyAssignment: AccessPolicyAssignment; performedBy: OrganizationActor; context: Context };
  'organization.access_policy.assignment.team.deleted:after': { organization: Organization; team: Team; accessPolicy: AccessPolicy; accessPolicyAssignment: AccessPolicyAssignment; performedBy: OrganizationActor; context: Context };
  'organization.access_policy.assignment.member.created:before': { organization: Organization; member: OrganizationMember; accessPolicy: AccessPolicy; performedBy: OrganizationActor; context: Context };
  'organization.access_policy.assignment.member.created:after': { organization: Organization; member: OrganizationMember; accessPolicy: AccessPolicy; accessPolicyAssignment: AccessPolicyAssignment; performedBy: OrganizationActor; context: Context };
  'organization.access_policy.assignment.member.deleted:before': { organization: Organization; member: OrganizationMember; accessPolicy: AccessPolicy; accessPolicyAssignment: AccessPolicyAssignment; performedBy: OrganizationActor; context: Context };
  'organization.access_policy.assignment.member.deleted:after': { organization: Organization; member: OrganizationMember; accessPolicy: AccessPolicy; accessPolicyAssignment: AccessPolicyAssignment; performedBy: OrganizationActor; context: Context };
  'organization.access_policy.assignment.service_account.created:before': { organization: Organization; serviceAccount: ServiceAccount; accessPolicy: AccessPolicy; performedBy: OrganizationActor; context: Context };
  'organization.access_policy.assignment.service_account.created:after': { organization: Organization; serviceAccount: ServiceAccount; accessPolicy: AccessPolicy; accessPolicyAssignment: AccessPolicyAssignment; performedBy: OrganizationActor; context: Context };
  'organization.access_policy.assignment.service_account.deleted:before': { organization: Organization; serviceAccount: ServiceAccount; accessPolicy: AccessPolicy; accessPolicyAssignment: AccessPolicyAssignment; performedBy: OrganizationActor; context: Context };
  'organization.access_policy.assignment.service_account.deleted:after': { organization: Organization; serviceAccount: ServiceAccount; accessPolicy: AccessPolicy; accessPolicyAssignment: AccessPolicyAssignment; performedBy: OrganizationActor; context: Context };

  'machine_access.created:before': MachineAccessInput & { context?: Context };
  'machine_access.created:after': MachineAccessInput & { context?: Context, machineAccess: MachineAccess };
  'machine_access.updated:before': { machineAccess: MachineAccess, organization: Organization, performedBy: OrganizationActor; context?: Context };
  'machine_access.updated:after': { machineAccess: MachineAccess, organization: Organization, performedBy: OrganizationActor; context?: Context };
  'machine_access.deleted:before': { machineAccess: MachineAccess, organization: Organization, performedBy: OrganizationActor; context?: Context };
  'machine_access.deleted:after': { machineAccess: MachineAccess, organization: Organization, performedBy: OrganizationActor; context?: Context };

  'machine_access.api_key.created:before': { machineAccess: MachineAccess, organization: Organization; performedBy: OrganizationActor; context?: Context };
  'machine_access.api_key.created:after': { machineAccess: MachineAccess, apiKey: ApiKey, organization: Organization; performedBy: OrganizationActor; context?: Context };
  'machine_access.api_key.updated:before': { machineAccess: MachineAccess, apiKey: ApiKey, organization: Organization; performedBy: OrganizationActor; context?: Context };
  'machine_access.api_key.updated:after': { machineAccess: MachineAccess, apiKey: ApiKey, organization: Organization; performedBy: OrganizationActor; context?: Context };
  'machine_access.api_key.revoked:before': { machineAccess: MachineAccess, apiKey: ApiKey, organization: Organization; performedBy: OrganizationActor; context?: Context };
  'machine_access.api_key.revoked:after': { machineAccess: MachineAccess, apiKey: ApiKey, organization: Organization; performedBy: OrganizationActor; context?: Context };
  'machine_access.api_key.rotated:before': { machineAccess: MachineAccess, apiKey: ApiKey, organization: Organization; performedBy: OrganizationActor; context?: Context };
  'machine_access.api_key.rotated:after': { machineAccess: MachineAccess, apiKey: ApiKey, organization: Organization; performedBy: OrganizationActor; context?: Context };
  'machine_access.api_key.expired:before': { machineAccess: MachineAccess, apiKey: ApiKey; organization: Organization; performedBy: OrganizationActor };
  'machine_access.api_key.expired:after': { machineAccess: MachineAccess, apiKey: ApiKey; organization: Organization; performedBy: OrganizationActor };
  'machine_access.api_key:revealed': { machineAccess: MachineAccess, apiKey: ApiKey, organization: Organization; performedBy: OrganizationActor; context?: Context };
  
  'machine_access.oauth_application.created:before': { organization: Organization | null; performedBy: OrganizationActor | null; context: Context | null; input: OAuthApplicationCreateInput; serverSideMachineAccess: MachineAccess | null; };
  'machine_access.oauth_application.created:after': { organization: Organization | null; performedBy: OrganizationActor | null; context: Context | null; input: OAuthApplicationCreateInput; serverSideMachineAccess: MachineAccess | null; oauthApplication: OAuthApplication; };
  'machine_access.oauth_application.updated:before': { oauthApplication: OAuthApplication; organization: Organization | null; performedBy: OrganizationActor | null; context: Context | null; input: OAuthApplicationUpdateInput; };
  'machine_access.oauth_application.updated:after': { oauthApplication: OAuthApplication; organization: Organization | null; performedBy: OrganizationActor | null; context: Context | null; input: OAuthApplicationUpdateInput; };
  'machine_access.oauth_application.archived:before': { oauthApplication: OAuthApplication; organization: Organization | null; performedBy: OrganizationActor | null; context: Context | null; };
  'machine_access.oauth_application.archived:after': { oauthApplication: OAuthApplication; organization: Organization | null; performedBy: OrganizationActor | null; context: Context | null; };
  'machine_access.oauth_application.client_secret.create:after': { oauthApplication: OAuthApplication; };
  'machine_access.oauth_application.client_secret.revoked:after': { oauthApplication: OAuthApplication; };

  'machine_access.oauth_installation.created:before': { oauthApplication: OAuthApplication; organization: Organization; context?: Context; };
  'machine_access.oauth_installation.created:after': { oauthApplication: OAuthApplication; oauthInstallation: OAuthInstallation; organization: Organization; appActor: OrganizationActor | null; context?: Context; };
  'machine_access.oauth_installation.updated:before': { oauthApplication: OAuthApplication; organization: Organization; context?: Context; };
  'machine_access.oauth_installation.updated:after': { oauthApplication: OAuthApplication; oauthInstallation: OAuthInstallation; organization: Organization; appActor: OrganizationActor | null; context?: Context; };
  'machine_access.oauth_installation.revoked:before': { oauthApplication: OAuthApplication; oauthInstallation: OAuthInstallation; organization: Organization; performedBy: OrganizationActor; context?: Context; };
  'machine_access.oauth_installation.revoked:after': { oauthApplication: OAuthApplication; oauthInstallation: OAuthInstallation; organization: Organization; appActor: OrganizationActor | null; performedBy: OrganizationActor; context?: Context; };
  
  'machine_access.oauth_authorization.created:before': { oauthApplication: OAuthApplication; oauthInstallation: OAuthInstallation; organization: Organization; context?: Context; };
  'machine_access.oauth_authorization.created:after': { oauthApplication: OAuthApplication; oauthInstallation: OAuthInstallation; oauthAuthorization: OAuthAuthorization; organization: Organization; appActor: OrganizationActor | null; context?: Context; };
  'machine_access.oauth_authorization.updated:before': { oauthApplication: OAuthApplication; oauthInstallation: OAuthInstallation; organization: Organization; context?: Context; };
  'machine_access.oauth_authorization.updated:after': { oauthApplication: OAuthApplication; oauthInstallation: OAuthInstallation; oauthAuthorization: OAuthAuthorization; organization: Organization; appActor: OrganizationActor | null; context?: Context; };
  'machine_access.oauth_authorization.revoked:before': { oauthApplication: OAuthApplication; oauthInstallation: OAuthInstallation; oauthAuthorization: OAuthAuthorization; organization: Organization; appActor: OrganizationActor | null; performedBy: OrganizationActor; context?: Context; };
  'machine_access.oauth_authorization.revoked:after': { oauthApplication: OAuthApplication; oauthInstallation: OAuthInstallation; oauthAuthorization: OAuthAuthorization; organization: Organization; appActor: OrganizationActor | null; performedBy: OrganizationActor; context?: Context; };
  
  'machine_access.oauth_authorization_request.accepted:before': { oauthApplication: OAuthApplication; oauthAuthorizationRequest: OAuthAuthorizationRequestWithRelations; organization: Organization; member: OrganizationMember; performedBy: OrganizationActor; context?: Context; };
  'machine_access.oauth_authorization_request.accepted:after': { oauthApplication: OAuthApplication; oauthAuthorizationRequest: OAuthAuthorizationRequestWithRelations; organization: Organization; member: OrganizationMember; performedBy: OrganizationActor; context?: Context; };
  'machine_access.oauth_authorization_request.denied:before': { oauthApplication: OAuthApplication; oauthAuthorizationRequest: OAuthAuthorizationRequestWithRelations; organization: Organization; member: OrganizationMember; performedBy: OrganizationActor; context?: Context; };
  'machine_access.oauth_authorization_request.denied:after': { oauthApplication: OAuthApplication; oauthAuthorizationRequest: OAuthAuthorizationRequestWithRelations; organization: Organization; member: OrganizationMember; performedBy: OrganizationActor; context?: Context; };
  
  'machine_access.oauth_token.created:before': { oauthApplication: OAuthApplication; oauthInstallation: OAuthInstallation; oauthAuthorization: OAuthAuthorization; organization: Organization; appActor: OrganizationActor | null; context?: Context; };
  'machine_access.oauth_token.created:after': { oauthApplication: OAuthApplication; oauthInstallation: OAuthInstallation; oauthAuthorization: OAuthAuthorization; oauthToken: OAuthToken; organization: Organization; appActor: OrganizationActor | null; context?: Context; };
  'machine_access.oauth_token.refreshed:before': { oauthApplication: OAuthApplication; oauthInstallation: OAuthInstallation; oauthAuthorization: OAuthAuthorization; oauthToken: OAuthToken; organization: Organization; appActor: OrganizationActor | null; context?: Context; };
  'machine_access.oauth_token.refreshed:after': { oauthApplication: OAuthApplication; oauthInstallation: OAuthInstallation; oauthAuthorization: OAuthAuthorization; oauthToken: OAuthToken; organization: Organization; appActor: OrganizationActor | null; context?: Context; };

  'machine_access.service_account.created:before': { organization: Organization; performedBy: OrganizationActor; context: Context; input: ServiceAccountCreateInput; };
  'machine_access.service_account.created:after': { organization: Organization; performedBy: OrganizationActor; context: Context; input: ServiceAccountCreateInput; serviceAccount: ServiceAccount; oauthApplication: OAuthApplication; };
  'machine_access.service_account.updated:before': { serviceAccount: ServiceAccount; oauthApplication: OAuthApplication; organization: Organization; performedBy: OrganizationActor; context: Context; input: ServiceAccountUpdateInput; };
  'machine_access.service_account.updated:after': { serviceAccount: ServiceAccount; oauthApplication: OAuthApplication; organization: Organization; performedBy: OrganizationActor; context: Context; input: ServiceAccountUpdateInput; };
  'machine_access.service_account.archived:before': { serviceAccount: ServiceAccount; oauthApplication: OAuthApplication; organization: Organization; performedBy: OrganizationActor; context: Context; };
  'machine_access.service_account.archived:after': { serviceAccount: ServiceAccount; oauthApplication: OAuthApplication; organization: Organization; performedBy: OrganizationActor; context: Context; };
  'machine_access.service_account_credential.created:before': { serviceAccount: ServiceAccount; oauthApplication: OAuthApplication; oauthInstallation: OAuthInstallation; oauthAuthorization: OAuthAuthorization; organization: Organization; appActor: OrganizationActor | null; context?: Context; };
  'machine_access.service_account_credential.created:after': { serviceAccount: ServiceAccount; serviceAccountCredential: ServiceAccountCredential; oauthApplication: OAuthApplication; oauthInstallation: OAuthInstallation; oauthAuthorization: OAuthAuthorization; organization: Organization; appActor: OrganizationActor | null; context?: Context; };

  'portal.created:before': { organization: Organization; instance: Instance; context: Context; input: { name: string; description?: string; sessionExpiryTimeInSeconds?: number; } };
  'portal.created:after': { organization: Organization; instance: Instance; portal: Portal; context: Context; input: { name: string; description?: string; sessionExpiryTimeInSeconds?: number; } };
  'portal.updated:before': { portal: Portal; input: { name?: string; description?: string; sessionExpiryTimeInSeconds?: number; } };
  'portal.updated:after': { portal: Portal; input: { name?: string; description?: string; sessionExpiryTimeInSeconds?: number; } };
  'portal.archived:before': { portal: Portal };
  'portal.archived:after': { portal: Portal };

  'workspace.created:before':
    | { organization: Organization }
    | { portal: Portal };
  'workspace.created:after':
    | { workspace: Workspace; organization: Organization }
    | { workspace: Workspace; portal: Portal };
  'workspace.updated:before':
    | { workspace: Workspace; organization: Organization }
    | { workspace: Workspace; portal: Portal };
  'workspace.updated:after':
    | { workspace: Workspace; organization: Organization }
    | { workspace: Workspace; portal: Portal };
  'workspace.deleted:before':
    | { workspace: Workspace; organization: Organization }
    | { workspace: Workspace; portal: Portal };
  'workspace.deleted:after':
    | { workspace: Workspace; organization: Organization }
    | { workspace: Workspace; portal: Portal };

  'workspace_profile.created:before':
    | { consumerProfile: ConsumerProfile }
    | { organizationMember: OrganizationMember };
  'workspace_profile.created:after':
    | { workspaceProfile: WorkspaceProfile; consumerProfile: ConsumerProfile }
    | { workspaceProfile: WorkspaceProfile; organizationMember: OrganizationMember };
  'workspace_profile.updated:before':
    | { workspaceProfile: WorkspaceProfile; consumerProfile: ConsumerProfile }
    | { workspaceProfile: WorkspaceProfile; organizationMember: OrganizationMember };
  'workspace_profile.updated:after':
    | { workspaceProfile: WorkspaceProfile; consumerProfile: ConsumerProfile }
    | { workspaceProfile: WorkspaceProfile; organizationMember: OrganizationMember };
  'workspace_profile.deleted:before':
    | { workspaceProfile: WorkspaceProfile; consumerProfile: ConsumerProfile }
    | { workspaceProfile: WorkspaceProfile; organizationMember: OrganizationMember };
  'workspace_profile.deleted:after':
    | { workspaceProfile: WorkspaceProfile; consumerProfile: ConsumerProfile }
    | { workspaceProfile: WorkspaceProfile; organizationMember: OrganizationMember };

  'consumer.profile.created:before': { surface: ConsumerSurface };
  'consumer.profile.created:after': { consumerProfile: ConsumerProfile, surface: ConsumerSurface };
  'consumer.profile.updated:before': { consumerProfile: ConsumerProfile, surface: ConsumerSurface };
  'consumer.profile.updated:after': { consumerProfile: ConsumerProfile, surface: ConsumerSurface };
  'consumer.profile.deleted:before': { consumerProfile: ConsumerProfile, surface: ConsumerSurface };
  'consumer.profile.deleted:after': { consumerProfile: ConsumerProfile, surface: ConsumerSurface };

  'consumer.invite.created:before': { consumerProfile: ConsumerProfile, consumerSurface: ConsumerSurface, performedBy: OrganizationActor };
  'consumer.invite.created:after': { consumerInvite: ConsumerInvite, consumerProfile: ConsumerProfile, consumerSurface: ConsumerSurface, performedBy: OrganizationActor };
  'consumer.invite.updated:before': { consumerProfile: ConsumerProfile, consumerSurface: ConsumerSurface, performedBy: OrganizationActor, consumerInviteId: string };
  'consumer.invite.updated:after': { consumerInvite: ConsumerInvite, consumerProfile: ConsumerProfile, consumerSurface: ConsumerSurface, performedBy: OrganizationActor };

  'workspace_invite.created:before':
    | { consumerInvite: ConsumerInvite }
    | { organizationInvite: OrganizationInvite };
  'workspace_invite.created:after':
    | { workspaceInvite: WorkspaceInvite; consumerInvite: ConsumerInvite }
    | { workspaceInvite: WorkspaceInvite; organizationInvite: OrganizationInvite };
  'workspace_invite.updated:before':
    | { workspaceInvite: WorkspaceInvite; consumerInvite: ConsumerInvite }
    | { workspaceInvite: WorkspaceInvite; organizationInvite: OrganizationInvite };
  'workspace_invite.updated:after':
    | { workspaceInvite: WorkspaceInvite; consumerInvite: ConsumerInvite }
    | { workspaceInvite: WorkspaceInvite; organizationInvite: OrganizationInvite };
  'workspace_invite.deleted:before':
    | { workspaceInvite: WorkspaceInvite; organizationInvite: OrganizationInvite };
  'workspace_invite.deleted:after':
    | { workspaceInvite: WorkspaceInvite; organizationInvite: OrganizationInvite };

  'consumer.auth_tenant.created:before': { organization: Organization; instance: Instance };
  'consumer.auth_tenant.created:after': { organization: Organization, consumerAuthTenant: ConsumerAuthTenant, consumerSurface: ConsumerSurface };
  'consumer.auth_tenant.archived:after': { organization: Organization, consumerAuthTenant: ConsumerAuthTenant, consumerSurface: ConsumerSurface };
  'consumer.auth_tenant.deleted:after': { organization: Organization, consumerAuthTenant: ConsumerAuthTenant, consumerSurface: ConsumerSurface };

  'consumer.integration_setup_session.created:before': { instance: Instance };
  'consumer.integration_setup_session.created:after': { instance: Instance; setupSession: SubspaceIntegrationSetupSession };

  'magic_mcp.server.created:before': { organization: Organization; instance: Instance };
  'magic_mcp.server.created:after': { organization: Organization; instance: Instance; magicMcpServer: MagicMcpServer };
  'magic_mcp.server.archived:after': { organization: Organization; instance: Instance; magicMcpServer: MagicMcpServer };
  'magic_mcp.endpoint.created:before': { instance: Instance };
  'magic_mcp.endpoint.created:after': { instance: Instance; magicMcpEndpoint: MagicMcpEndpoint };
  'magic_mcp.endpoint.archived:after': { instance: Instance; magicMcpEndpoint: MagicMcpEndpoint };

  'skill.created:before': { instance: Instance };
  'skill.created:after': { instance: Instance; skill: Skill };
  'skill.archived:after': { instance: Instance; skill: Skill };
  'skill.deleted:after': { instance: Instance; skill: Skill };

  'skill.plugin.created:before': { organization: Organization; instance: Instance };
  'skill.plugin.created:after': { organization: Organization; instance: Instance; skillPlugin: SkillPlugin };
  'skill.plugin.updated:after': { organization: Organization; instance: Instance; skillPlugin: SkillPlugin };
  'skill.plugin.archived:after': { organization: Organization; instance: Instance; skillPlugin: SkillPlugin };
  'skill.plugin.deleted:after': { organization: Organization; instance: Instance; skillPlugin: SkillPlugin };

  'skill.marketplace.created:before': { organization: Organization; instance: Instance };
  'skill.marketplace.created:after': { organization: Organization; instance: Instance; skillMarketplace: SkillMarketplace };
  'skill.marketplace.archived:after': { organization: Organization; instance: Instance; skillMarketplace: SkillMarketplace };
  'skill.marketplace.deleted:after': { organization: Organization; instance: Instance; skillMarketplace: SkillMarketplace };

  'provider.deployment.created:before': ProviderEventBase;
  'provider.deployment.created:after': ProviderEventBase & { deployment: SubspaceProviderDeployment };
  'provider.deployment.updated:before': ProviderEventBase;
  'provider.deployment.updated:after': ProviderEventBase & { deployment: SubspaceProviderDeployment };
  'provider.deployment.deleted:before': ProviderEventBase;
  'provider.deployment.deleted:after': ProviderEventBase & { deployment: SubspaceProviderDeployment };

  'provider.config.created:before': ProviderEventBase;
  'provider.config.created:after': ProviderEventBase & { config: SubspaceProviderConfig };
  'provider.config.updated:before': ProviderEventBase;
  'provider.config.updated:after': ProviderEventBase & { config: SubspaceProviderConfig };
  'provider.config.deleted:before': ProviderEventBase;
  'provider.config.deleted:after': ProviderEventBase & { config: SubspaceProviderConfig };

  'provider.auth_config.created:before': ProviderEventBase;
  'provider.auth_config.created:after': ProviderEventBase & { authConfig: SubspaceProviderAuthConfig };
  'provider.auth_config.updated:before': ProviderEventBase;
  'provider.auth_config.updated:after': ProviderEventBase & { authConfig: SubspaceProviderAuthConfig };
  'provider.auth_config.deleted:before': ProviderEventBase;
  'provider.auth_config.deleted:after': ProviderEventBase & { authConfig: SubspaceProviderAuthConfig };

  'provider.auth_credentials.created:before': ProviderEventBase;
  'provider.auth_credentials.created:after': ProviderEventBase & { authCredentials: SubspaceProviderAuthCredentials };
  'provider.auth_credentials.updated:before': ProviderEventBase;
  'provider.auth_credentials.updated:after': ProviderEventBase & { authCredentials: SubspaceProviderAuthCredentials };
  'provider.auth_credentials.deleted:before': ProviderEventBase;
  'provider.auth_credentials.deleted:after': ProviderEventBase & { authCredentials: SubspaceProviderAuthCredentials };

  'provider.auth_export.created:before': ProviderEventBase;
  'provider.auth_export.created:after': ProviderEventBase & { authExport: SubspaceProviderAuthExport };

  'provider.auth_import.created:before': ProviderEventBase;
  'provider.auth_import.created:after': ProviderEventBase & { authImport: SubspaceProviderAuthImport };

  'provider.config_vault.created:before': ProviderEventBase;
  'provider.config_vault.created:after': ProviderEventBase & { configVault: SubspaceProviderConfigVault };
  'provider.config_vault.updated:before': ProviderEventBase;
  'provider.config_vault.updated:after': ProviderEventBase & { configVault: SubspaceProviderConfigVault };
  'provider.config_vault.deleted:before': ProviderEventBase;
  'provider.config_vault.deleted:after': ProviderEventBase & { configVault: SubspaceProviderConfigVault };

  'provider.integration.created:before': ProviderEventBase;
  'provider.integration.created:after': ProviderEventBase & { integration: SubspaceIntegration };
  'provider.integration.deleted:before': ProviderEventBase;
  'provider.integration.deleted:after': ProviderEventBase & { integration: SubspaceIntegration };

  'provider.integration_instance.created:before': ProviderEventBase;
  'provider.integration_instance.created:after': ProviderEventBase & { integrationInstance: SubspaceIntegrationInstance };
  'provider.integration_instance.deleted:before': ProviderEventBase;
  'provider.integration_instance.deleted:after': ProviderEventBase & { integrationInstance: SubspaceIntegrationInstance };

  'provider.setup_session.created:before': ProviderEventBase;
  'provider.setup_session.created:after': ProviderEventBase & { setupSession: SubspaceProviderSetupSession };
  'provider.setup_session.updated:before': ProviderEventBase;
  'provider.setup_session.updated:after': ProviderEventBase & { setupSession: SubspaceProviderSetupSession };

  'provider.callback.created:before': ProviderEventBase;
  'provider.callback.created:after': ProviderEventBase & { callback: SubspaceCallback };
  'provider.callback.archived:before': ProviderEventBase;
  'provider.callback.archived:after': ProviderEventBase & { callback: SubspaceCallback };

  'provider.callback_instance.attached:before': ProviderEventBase;
  'provider.callback_instance.attached:after': ProviderEventBase & { callbackInstance: SubspaceCallbackInstance };
  'provider.callback_instance.detached:before': ProviderEventBase;
  'provider.callback_instance.detached:after': ProviderEventBase & { callbackInstance: SubspaceCallbackInstance };

  'provider.callback_destination.created:before': ProviderEventBase;
  'provider.callback_destination.created:after': ProviderEventBase & { callbackDestination: SubspaceCallbackDestination };
  'provider.callback_destination.archived:before': ProviderEventBase;
  'provider.callback_destination.archived:after': ProviderEventBase & { callbackDestination: SubspaceCallbackDestination };

  'provider.session.created:before': ProviderEventBase;
  'provider.session.created:after': ProviderEventBase & { session: SubspaceSession };
  'provider.session.updated:before': ProviderEventBase;
  'provider.session.updated:after': ProviderEventBase & { session: SubspaceSession };
  'provider.session.deleted:before': ProviderEventBase;
  'provider.session.deleted:after': ProviderEventBase & { session: SubspaceSession };

  'provider.session.provider.created:before': ProviderEventBase;
  'provider.session.provider.created:after': ProviderEventBase & { sessionProvider: SubspaceSessionProvider };
  'provider.session.provider.updated:before': ProviderEventBase;
  'provider.session.provider.updated:after': ProviderEventBase & { sessionProvider: SubspaceSessionProvider };
  'provider.session.provider.deleted:before': ProviderEventBase;
  'provider.session.provider.deleted:after': ProviderEventBase & { sessionProvider: SubspaceSessionProvider };

  'provider.session_template.created:before': ProviderEventBase;
  'provider.session_template.created:after': ProviderEventBase & { sessionTemplate: SubspaceSessionTemplate };
  'provider.session_template.updated:before': ProviderEventBase;
  'provider.session_template.updated:after': ProviderEventBase & { sessionTemplate: SubspaceSessionTemplate };
  'provider.session_template.deleted:before': ProviderEventBase;
  'provider.session_template.deleted:after': ProviderEventBase & { sessionTemplate: SubspaceSessionTemplate };

  'provider.session_template.provider.created:before': ProviderEventBase;
  'provider.session_template.provider.created:after': ProviderEventBase & { sessionTemplateProvider: SubspaceSessionTemplateProvider };
  'provider.session_template.provider.updated:before': ProviderEventBase;
  'provider.session_template.provider.updated:after': ProviderEventBase & { sessionTemplateProvider: SubspaceSessionTemplateProvider };
  'provider.session_template.provider.deleted:before': ProviderEventBase;
  'provider.session_template.provider.deleted:after': ProviderEventBase & { sessionTemplateProvider: SubspaceSessionTemplateProvider };

  'provider.session_message.created:before': ProviderEventBase;
  'provider.tool_call.created:before': ProviderEventBase;
  'provider.tool_call.created:after': ProviderEventBase & { toolCall: SubspaceToolCall };

  'provider.custom_provider.created:before': ProviderEventBase;
  'provider.custom_provider.created:after': ProviderEventBase & { customProvider: SubspaceCustomProvider };
  'provider.custom_provider.updated:before': ProviderEventBase;
  'provider.custom_provider.updated:after': ProviderEventBase & { customProvider: SubspaceCustomProvider };
  'provider.custom_provider.archived:before': ProviderEventBase;
  'provider.custom_provider.archived:after': ProviderEventBase & { customProvider: SubspaceCustomProvider };

  'provider.custom_provider.version.created:before': ProviderEventBase;
  'provider.custom_provider.version.created:after': ProviderEventBase & { customProviderVersion: SubspaceCustomProviderVersion };

  'provider.custom_provider.commit.created:before': ProviderEventBase;
  'provider.custom_provider.commit.created:after': ProviderEventBase & { customProviderCommit: SubspaceCustomProviderCommit };

  'provider.provider_listing_group.created:before': ProviderEventBase;
  'provider.provider_listing_group.created:after': ProviderEventBase & { providerGroup: SubspaceProviderListingGroup };
  'provider.provider_listing_group.deleted:before': ProviderEventBase;
  'provider.provider_listing_group.deleted:after': ProviderEventBase & { providerGroup: SubspaceProviderListingGroup };

  'instance.network.firewall.created:before': ProviderEventBase;
  'instance.network.firewall.created:after': ProviderEventBase & { firewall: SubspaceFirewall };
  'instance.network.firewall.updated:before': ProviderEventBase;
  'instance.network.firewall.updated:after': ProviderEventBase & { firewall: SubspaceFirewall };
  'instance.network.firewall.deleted:before': ProviderEventBase;
  'instance.network.firewall.deleted:after': ProviderEventBase & { firewall: SubspaceFirewall };
  'instance.network.firewall.network_policy.attached:before': ProviderEventBase;
  'instance.network.firewall.network_policy.attached:after': ProviderEventBase & { firewall: SubspaceFirewall };
  'instance.network.firewall.network_policy.detached:before': ProviderEventBase;
  'instance.network.firewall.network_policy.detached:after': ProviderEventBase & { firewall: SubspaceFirewall };

  'instance.network.firewall_binding.created:before': ProviderEventBase;
  'instance.network.firewall_binding.created:after': ProviderEventBase & { firewallBinding: SubspaceFirewallBinding };
  'instance.network.firewall_binding.deleted:before': ProviderEventBase;
  'instance.network.firewall_binding.deleted:after': ProviderEventBase & { firewallBinding: SubspaceFirewallBinding };

  'instance.network.network_policy.created:before': ProviderEventBase;
  'instance.network.network_policy.created:after': ProviderEventBase & { networkPolicy: SubspaceNetworkPolicy };
  'instance.network.network_policy.updated:before': ProviderEventBase;
  'instance.network.network_policy.updated:after': ProviderEventBase & { networkPolicy: SubspaceNetworkPolicy };
  'instance.network.network_policy.deleted:before': ProviderEventBase;
  'instance.network.network_policy.deleted:after': ProviderEventBase & { networkPolicy: SubspaceNetworkPolicy };
  'instance.network.network_policy.rule.created:before': ProviderEventBase;
  'instance.network.network_policy.rule.created:after': ProviderEventBase & { networkPolicy: SubspaceNetworkPolicy; rule: SubspaceNetworkPolicyRule };
  'instance.network.network_policy.rule.updated:before': ProviderEventBase;
  'instance.network.network_policy.rule.updated:after': ProviderEventBase & { networkPolicy: SubspaceNetworkPolicy; rule: SubspaceNetworkPolicyRule };
  'instance.network.network_policy.rule.deleted:before': ProviderEventBase;
  'instance.network.network_policy.rule.deleted:after': ProviderEventBase & { networkPolicy: SubspaceNetworkPolicy };
}
