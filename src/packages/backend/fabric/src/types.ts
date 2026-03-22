import { Context } from '@metorial/context';
import {
  ApiKey,
  Instance,
  MachineAccess,
  OAuthApplication,
  OAuthAuthorization,
  OAuthAuthorizationRequest,
  OAuthInstallation,
  OAuthToken,
  Organization,
  OrganizationActor,
  OrganizationInvite,
  OrganizationInviteJoin,
  OrganizationMember,
  Project,
  ServiceAccount,
  ServiceAccountCredential,
  Team,
  TeamMember,
  TeamProject,
  TeamRole,
  User,
  UserSession
} from '@metorial/db';
import type {
  SubspaceCustomProvider,
  SubspaceCustomProviderCommit,
  SubspaceCustomProviderVersion,
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
  type: 'user_facing' | 'server_side';
  accessLevel: 'organization' | 'global';
  name: string;
  description?: string;
  websiteUrl?: string;
  privacyPolicyUrl?: string;
  termsOfServiceUrl?: string;
  scopes: string[];
  image?: PrismaJson.EntityImage;
};

export type OAuthApplicationUpdateInput = {
  name?: string;
  description?: string | null;
  websiteUrl?: string | null;
  privacyPolicyUrl?: string | null;
  termsOfServiceUrl?: string | null;
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
  'organization.project.deleted:before': { organization: Organization, project: Project, performedBy: OrganizationActor; context?: Context };
  'organization.project.deleted:after': { organization: Organization, project: Project, performedBy: OrganizationActor; context?: Context };

  'organization.project.instance.created:before': { organization: Organization, project: Project, performedBy: OrganizationActor; context?: Context };
  'organization.project.instance.created:after': { organization: Organization, project: Project; instance: Instance, performedBy: OrganizationActor; context?: Context };
  'organization.project.instance.updated:before': { organization: Organization, project: Project; instance: Instance, performedBy: OrganizationActor; context?: Context };
  'organization.project.instance.updated:after': { organization: Organization, project: Project; instance: Instance, performedBy: OrganizationActor; context?: Context };
  'organization.project.instance.deleted:before': { organization: Organization, project: Project; instance: Instance, performedBy: OrganizationActor; context?: Context };
  'organization.project.instance.deleted:after': { organization: Organization, project: Project; instance: Instance, performedBy: OrganizationActor; context?: Context };

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

  'organization.team.role.created:before': { organization: Organization, performedBy: OrganizationActor; context?: Context };
  'organization.team.role.created:after': { organization: Organization, role: TeamRole, performedBy: OrganizationActor; context?: Context };
  'organization.team.role.updated:before': { organization: Organization, role: TeamRole, performedBy: OrganizationActor; context?: Context };
  'organization.team.role.updated:after': { organization: Organization, role: TeamRole, performedBy: OrganizationActor; context?: Context };
  'organization.team.role.deleted:before': { organization: Organization, role: TeamRole, performedBy: OrganizationActor; context?: Context };
  'organization.team.role.deleted:after': { organization: Organization, role: TeamRole, performedBy: OrganizationActor; context?: Context };

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
  
  'machine_access.oauth_application.created:before': { organization: Organization; performedBy: OrganizationActor; context: Context; input: OAuthApplicationCreateInput; serverSideMachineAccess: MachineAccess | null; };
  'machine_access.oauth_application.created:after': { organization: Organization; performedBy: OrganizationActor; context: Context; input: OAuthApplicationCreateInput; serverSideMachineAccess: MachineAccess | null; oauthApplication: OAuthApplication; };
  'machine_access.oauth_application.updated:before': { oauthApplication: OAuthApplication; organization: Organization; performedBy: OrganizationActor; context: Context; input: OAuthApplicationUpdateInput; };
  'machine_access.oauth_application.updated:after': { oauthApplication: OAuthApplication; organization: Organization; performedBy: OrganizationActor; context: Context; input: OAuthApplicationUpdateInput; };
  'machine_access.oauth_application.archived:before': { oauthApplication: OAuthApplication; organization: Organization; performedBy: OrganizationActor; context: Context; };
  'machine_access.oauth_application.archived:after': { oauthApplication: OAuthApplication; organization: Organization; performedBy: OrganizationActor; context: Context; };
  
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
  
  'machine_access.oauth_authorization_request.accepted:before': { oauthApplication: OAuthApplication; oauthAuthorizationRequest: OAuthAuthorizationRequest; organization: Organization; member: OrganizationMember; performedBy: OrganizationActor; context?: Context; };
  'machine_access.oauth_authorization_request.accepted:after': { oauthApplication: OAuthApplication; oauthAuthorizationRequest: OAuthAuthorizationRequest; organization: Organization; member: OrganizationMember; performedBy: OrganizationActor; context?: Context; };
  'machine_access.oauth_authorization_request.denied:before': { oauthApplication: OAuthApplication; oauthAuthorizationRequest: OAuthAuthorizationRequest; organization: Organization; member: OrganizationMember; performedBy: OrganizationActor; context?: Context; };
  'machine_access.oauth_authorization_request.denied:after': { oauthApplication: OAuthApplication; oauthAuthorizationRequest: OAuthAuthorizationRequest; organization: Organization; member: OrganizationMember; performedBy: OrganizationActor; context?: Context; };
  
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

  'provider.deployment.created:before': ProviderEventBase;
  'provider.deployment.created:after': ProviderEventBase & { deployment: SubspaceProviderDeployment };
  'provider.deployment.updated:before': ProviderEventBase;
  'provider.deployment.updated:after': ProviderEventBase & { deployment: SubspaceProviderDeployment };

  'provider.config.created:before': ProviderEventBase;
  'provider.config.created:after': ProviderEventBase & { config: SubspaceProviderConfig };
  'provider.config.updated:before': ProviderEventBase;
  'provider.config.updated:after': ProviderEventBase & { config: SubspaceProviderConfig };

  'provider.auth_config.created:before': ProviderEventBase;
  'provider.auth_config.created:after': ProviderEventBase & { authConfig: SubspaceProviderAuthConfig };
  'provider.auth_config.updated:before': ProviderEventBase;
  'provider.auth_config.updated:after': ProviderEventBase & { authConfig: SubspaceProviderAuthConfig };

  'provider.auth_credentials.created:before': ProviderEventBase;
  'provider.auth_credentials.created:after': ProviderEventBase & { authCredentials: SubspaceProviderAuthCredentials };
  'provider.auth_credentials.updated:before': ProviderEventBase;
  'provider.auth_credentials.updated:after': ProviderEventBase & { authCredentials: SubspaceProviderAuthCredentials };

  'provider.auth_export.created:before': ProviderEventBase;
  'provider.auth_export.created:after': ProviderEventBase & { authExport: SubspaceProviderAuthExport };

  'provider.auth_import.created:before': ProviderEventBase;
  'provider.auth_import.created:after': ProviderEventBase & { authImport: SubspaceProviderAuthImport };

  'provider.config_vault.created:before': ProviderEventBase;
  'provider.config_vault.created:after': ProviderEventBase & { configVault: SubspaceProviderConfigVault };
  'provider.config_vault.updated:before': ProviderEventBase;
  'provider.config_vault.updated:after': ProviderEventBase & { configVault: SubspaceProviderConfigVault };

  'provider.setup_session.created:before': ProviderEventBase;
  'provider.setup_session.created:after': ProviderEventBase & { setupSession: SubspaceProviderSetupSession };
  'provider.setup_session.updated:before': ProviderEventBase;
  'provider.setup_session.updated:after': ProviderEventBase & { setupSession: SubspaceProviderSetupSession };

  'provider.session.created:before': ProviderEventBase;
  'provider.session.created:after': ProviderEventBase & { session: SubspaceSession };
  'provider.session.updated:before': ProviderEventBase;
  'provider.session.updated:after': ProviderEventBase & { session: SubspaceSession };

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

  'provider.custom_provider.version.created:before': ProviderEventBase;
  'provider.custom_provider.version.created:after': ProviderEventBase & { customProviderVersion: SubspaceCustomProviderVersion };

  'provider.custom_provider.commit.created:before': ProviderEventBase;
  'provider.custom_provider.commit.created:after': ProviderEventBase & { customProviderCommit: SubspaceCustomProviderCommit };

  'provider.provider_listing_group.created:before': ProviderEventBase;
  'provider.provider_listing_group.created:after': ProviderEventBase & { providerGroup: SubspaceProviderListingGroup };
}
