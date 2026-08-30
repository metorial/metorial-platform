import type {
  SessionDataRetentionLevel as ProjectDataRetentionLevel,
  Callback as SubspaceCallback,
  CallbackDestination as SubspaceCallbackDestination,
  CallbackInstance as SubspaceCallbackInstance,
  CustomProvider as SubspaceCustomProvider,
  CustomProviderCommit as SubspaceCustomProviderCommit,
  CustomProviderVersion as SubspaceCustomProviderVersion,
  Firewall as SubspaceFirewall,
  FirewallBinding as SubspaceFirewallBinding,
  Integration as SubspaceIntegration,
  IntegrationInstance as SubspaceIntegrationInstance,
  IntegrationSetupSession as SubspaceIntegrationSetupSession,
  NetworkPolicy as SubspaceNetworkPolicy,
  ProviderAuthConfig as SubspaceProviderAuthConfig,
  ProviderAuthCredentials as SubspaceProviderAuthCredentials,
  ProviderAuthExport as SubspaceProviderAuthExport,
  ProviderAuthImport as SubspaceProviderAuthImport,
  ProviderConfig as SubspaceProviderConfig,
  ProviderConfigVault as SubspaceProviderConfigVault,
  ProviderDeployment as SubspaceProviderDeployment,
  ProviderListingGroup as SubspaceProviderListingGroup,
  ProviderSetupSession as SubspaceProviderSetupSession,
  Session as SubspaceSession,
  SessionProvider as SubspaceSessionProvider,
  SessionTemplate as SubspaceSessionTemplate,
  SessionTemplateProvider as SubspaceSessionTemplateProvider,
  ToolCall as SubspaceToolCall
} from '@metorial-subspace/db';
import type { AuditScope } from '@metorial/audit-scope';
import { Context } from '@metorial/context';
import {
  AccessPolicy,
  AccessPolicyAssignment,
  AccessPolicyInstance,
  AccessPolicyProject,
  AccessPolicyRole,
  AccessRole,
  ApiKey,
  AuditLogStream,
  Consumer,
  ConsumerAccess,
  ConsumerAccessListing,
  ConsumerAccessRequest,
  ConsumerGroup,
  ConsumerInvite,
  ConsumerProfile,
  ConsumerProfileGroup,
  ConsumerSession,
  ConsumerSurface,
  Document,
  File,
  FileUpload,
  Instance,
  InstanceConsumer,
  MachineAccess,
  MagicMcpEndpoint,
  MagicMcpGroup,
  MagicMcpServer,
  MagicMcpToken,
  OAuthApplication,
  OAuthApplicationClientSecret,
  OAuthAuthorization,
  OAuthInstallation,
  OAuthToken,
  Organization,
  OrganizationActor,
  OrganizationConfig,
  OrganizationInvite,
  OrganizationInviteJoin,
  OrganizationLayout,
  OrganizationMember,
  Portal,
  Project,
  ProjectBrand,
  ProviderTemplate,
  Sandbox,
  ServiceAccount,
  ServiceAccountCredential,
  Skill,
  SkillGroup,
  SkillMarketplace,
  SkillPlugin,
  SkillTemplate,
  Store,
  StoreItem,
  Team,
  TeamMember,
  TeamProject,
  User,
  UserSession,
  Workspace,
  WorkspaceGroup,
  WorkspaceGroupAssignment,
  WorkspaceInvite,
  WorkspacePolicy,
  WorkspacePolicyAssignment,
  WorkspaceProfile
} from '@metorial/db';
import type { OAuthAuthorizationRequestWithRelations } from '@metorial/module-machine-access';

export type MachineAccessInput =
  | {
      type: 'organization_management';
      organization: Organization;
      auditScope: AuditScope;
    }
  | {
      type: 'instance_secret' | 'instance_publishable';
      organization: Organization;
      instance: Instance;
      auditScope: AuditScope;
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
  auditScope?: AuditScope;
};

export type AuditSubspaceProviderAuthConfig = SubspaceProviderAuthConfig & {
  provider: { id: string; name: string };
  authMethod: { id: string; key: string; name: string; type: string };
  deployment?: { id: string } | null;
};

export type AuditSubspaceProviderAuthCredentials = SubspaceProviderAuthCredentials & {
  provider: { id: string; name: string };
};

export type AuditSubspaceProviderConfig = SubspaceProviderConfig & {
  provider: { id: string; name: string };
  deployment?: { id: string } | null;
};

export type AuditSubspaceProviderConfigVault = SubspaceProviderConfigVault;

export type AuditSubspaceProviderDeployment = SubspaceProviderDeployment & {
  provider: { id: string; name: string };
};

export type AuditSubspaceProviderSetupSession = SubspaceProviderSetupSession & {
  provider?: { id: string; name: string } | null;
};

export type AuditSubspaceProviderAuthExport = SubspaceProviderAuthExport & {
  authConfig: { id: string; provider: { id: string; name: string } };
};

export type AuditSubspaceProviderAuthImport = SubspaceProviderAuthImport & {
  authConfig: { id: string; provider: { id: string; name: string } };
};

export type AuditSubspaceSessionProvider = SubspaceSessionProvider & {
  session: { id: string };
  provider: { id: string; name: string };
  deployment?: { id: string } | null;
  config?: { id: string } | null;
  authConfig?: { id: string } | null;
};

export type AuditSubspaceSession = SubspaceSession & {
  identity?: { id: string } | null;
  identityActor?: { id: string } | null;
  providers?: AuditSubspaceSessionProvider[];
};

export type AuditSubspaceSessionTemplateProvider = SubspaceSessionTemplateProvider & {
  sessionTemplate: { id: string };
  provider: { id: string; name: string };
  deployment?: { id: string } | null;
  config?: { id: string } | null;
  authConfig?: { id: string } | null;
};

export type AuditSubspaceSessionTemplate = SubspaceSessionTemplate & {
  identity?: { id: string } | null;
  identityActor?: { id: string } | null;
  integrationInstance?: { id: string } | null;
  integrationInstanceGroup?: { id: string } | null;
  providers?: AuditSubspaceSessionTemplateProvider[];
};

export type AuditSubspaceIntegration = SubspaceIntegration & {
  currentVersion?: { id: string } | null;
};

export type AuditSubspaceIntegrationInstance = SubspaceIntegrationInstance & {
  integration: { id: string; name: string };
  identity?: { id: string } | null;
  identityActor?: { id: string } | null;
};

export type AuditSubspaceFirewall = SubspaceFirewall & {
  network: { id: string; name: string };
  networkPolicyLinks?: {
    position: number;
    networkPolicy: { id: string; name: string };
  }[];
};

export type AuditSubspaceFirewallBinding = SubspaceFirewallBinding & {
  firewall: { id: string; slug: string; name: string };
  enclave?: { id: string; slug: string; name: string } | null;
  provider?: { id: string; name: string } | null;
  network?: { id: string; name: string } | null;
};

export type AuditSubspaceNetworkPolicy = SubspaceNetworkPolicy & {
  currentVersion?: { id: string; version: number; rules: unknown } | null;
};

export type AuditSubspaceCustomProvider = SubspaceCustomProvider & {
  provider?: { id: string; name: string } | null;
};

export type AuditSubspaceCustomProviderVersion = SubspaceCustomProviderVersion & {
  customProvider: { id: string; name: string };
};

export type AuditSubspaceCustomProviderCommit = SubspaceCustomProviderCommit & {
  customProvider: { id: string; name: string };
  toEnvironment?: { id: string; branchName: string | null } | null;
  fromEnvironment?: { id: string; branchName: string | null } | null;
};

export type AuditSubspaceScmRepo = {
  id: string;
  provider: string;
  name: string;
  identifier: string;
  externalId: string;
  externalName: string;
  externalOwner: string;
  externalUrl: string;
  externalIsPrivate: boolean;
  defaultBranch: string;
};

export type AuditSubspaceCodeBucketFile = {
  bucket: { id: string };
  filename: string;
  byteSize: number | null;
};

export type AuditSubspaceIntegrationProvider = {
  id: string;
  status: string;
  integration: { id: string; name: string };
  provider: { id: string; name: string };
  currentVersion?: { id: string } | null;
};

export type AuditSubspaceIntegrationInstanceGroup = {
  id: string;
  status: string;
  name: string;
  description: string | null;
  isMagicMcpBacking?: boolean;
  identity?: { id: string } | null;
  identityActor?: { id: string } | null;
  archivedAt: Date | null;
};

export type AuditSubspaceIntegrationInstanceProvider = {
  id: string;
  status: string;
  integration?: { id: string; name: string } | null;
  integrationInstance?: { id: string; name: string } | null;
  integrationInstanceGroup?: { id: string; name: string } | null;
  integrationProvider?: { id: string; provider: { id: string; name: string } } | null;
};

export type AuditSubspaceIntegrationSetupSession = SubspaceIntegrationSetupSession & {
  integration?: { id: string; name: string } | null;
};

export type AuditSubspaceAgent = {
  id: string;
  status: string;
  type: string;
  name: string;
  description: string | null;
  slug: string;
};

export type AuditSubspaceAgentClient = {
  id: string;
  type: string;
  name: string;
};

export type AuditSubspaceIdentityActor = {
  id: string;
  type: string;
  status: string;
  name: string;
  description: string | null;
};

export type AuditSubspaceIdentity = {
  id: string;
  status: string;
  name: string | null;
  description: string | null;
  actor?: { id: string; name: string } | null;
};

export type AuditSubspaceIdentityCredential = {
  id: string;
  status: string;
  identity: { id: string; name: string | null };
  deployment?: { id: string } | null;
  config?: { id: string } | null;
  authConfig?: { id: string } | null;
};

export type AuditSubspaceIdentityDelegation = {
  id: string;
  status: string;
  delegationLevel: number;
  permissions: string[];
  deniedReason: string | null;
  note: string | null;
  wasCoveredByPreviousDelegationAndAutoApproved: boolean;
  identity: { id: string; name: string | null };
};

export type AuditSubspaceIdentityDelegationConfig = {
  id: string;
  status: string;
  isDefault: boolean;
  name: string | null;
  description: string | null;
};

export type AuditConsumerProviderDeployment = {
  providerTemplate: { id: string; name: string };
  provider: { id: string; name: string };
  magicMcpServer: { id: string; name: string | null };
  integrationInstanceId: string | null;
};

export type AuditConsumerSurfaceProviderGroup = {
  id: string;
  name: string;
  description: string | null;
  index: number;
};

export type FabricEnterprise = {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
};

export type FabricEnterpriseMemberRole = 'super_admin';

export type FabricEnterpriseMember = {
  id: string;
  status: 'active' | 'inactive';
  roles: FabricEnterpriseMemberRole[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

export type FabricEnterpriseInvite = {
  id: string;
  email: string;
  status: 'pending' | 'accepted' | 'rejected' | 'deleted';
  roles: FabricEnterpriseMemberRole[];
  createdAt: Date;
  expiresAt: Date;
  deletedAt: Date | null;
  acceptedAt: Date | null;
  rejectedAt: Date | null;
};

export type FabricBillingPlan = {
  id: string;
};

export type FabricEnterpriseUser = {
  id: string;
};

export type FabricBillingAccount = {
  id: string;
  organizationId: string;
};

export type FabricOrganizationSubscription = {
  id: string;
  organizationId: string;
  planId: string;
};

export type FabricUserTenant = {
  oid: bigint;
  id: string;
  type: 'account_system_users' | 'account_managed_users' | 'account_sso_users';
  accountOid: bigint;
  canEditName: boolean;
  canEditEmail: boolean;
  canEditImage: boolean;
  canJoinOrganization: boolean;
  createdAt: Date;
  updatedAt: Date;
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

export type OrganizationUpdateInput = {
  name?: string;
  slug?: string;
  image?: PrismaJson.EntityImage;
  imageFileId?: string | null;
};

export type ProjectCreateInput = {
  name: string;
  magicMcpSessionDurationMinutes?: number;
};

export type ProjectUpdateInput = {
  name?: string;
  slug?: string;
  onlyAllowTrustedProviders?: boolean;
  magicMcpSessionDurationMinutes?: number;
};

export type InstanceCreateInput = {
  name: string;
  type: Instance['type'];
};

export type InstanceUpdateInput = {
  name?: string;
  slug?: string;
  type?: Instance['type'];
};

export type AuditProject = Project & {
  organization: Organization;
};

export type AuditInstance = Instance & {
  organization: Organization;
  project: Project;
  sandbox?: Sandbox | null;
};

export type AuditProjectBrand = ProjectBrand & {
  project: Project & { organization: Organization };
};

export type AuditAccessRole = AccessRole & {
  organization: Organization;
};

export type AuditAccessPolicy = AccessPolicy & {
  organization: Organization;
  accessPolicyRoles: (AccessPolicyRole & {
    accessRole: AccessRole;
  })[];
  accessPolicyProjects: (AccessPolicyProject & {
    project: Project;
  })[];
  accessPolicyInstances: (AccessPolicyInstance & {
    instance: Instance & {
      project: Project;
      organization: Organization;
    };
  })[];
};

export type AuditOrganizationActor = OrganizationActor & {
  organization: Organization;
  teams?: (TeamMember & { team: Team })[] | null;
  member?: OrganizationMember | null;
};

export type AuditOrganizationMember = OrganizationMember & {
  organization: Organization;
  actor: OrganizationActor & {
    teams: (TeamMember & { team: Team })[];
  };
  policies?: (AccessPolicyAssignment & {
    accessPolicy: AccessPolicy;
  })[];
  user: { id: string; email: string; name: string; image: PrismaJson.EntityImage };
};

export type AuditOrganizationInvite = OrganizationInvite & {
  organization: Organization;
  invitedBy: OrganizationActor;
};

export type AuditTeam = Team & {
  organization: Organization;
  projects: (TeamProject & { project: Project })[];
  policies?: (AccessPolicyAssignment & {
    accessPolicy: AccessPolicy;
  })[];
};

export type AuditServiceAccount = ServiceAccount & {
  organization: Organization;
  policies?: (AccessPolicyAssignment & {
    accessPolicy: AccessPolicy;
  })[];
  oauthApplication: OAuthApplication & {
    organization: Organization | null;
    clientSecrets?: OAuthApplicationClientSecret[] | null;
  };
};

export type AuditOAuthApplication = OAuthApplication & {
  organization: Organization | null;
  clientSecrets?: OAuthApplicationClientSecret[] | null;
};

export type FileFabricOwner = {
  instance?: { oid: bigint };
  organization?: { oid: bigint };
  fileSize: number;
  auditScope?: AuditScope;
};

export type AuditFile = File & {
  purpose: { slug: string };
};

export type AuditDocument = Document & {
  file: { id: string };
  parentDocument: { id: string } | null;
  currentVersion?: { id: string } | null;
  content: { content: string };
};

export type AuditStore = Store;

export type StoreItemFabricOperation = {
  type: 'add' | 'modify' | 'remove';
  kind: StoreItem['kind'];
  path: string;
  previousPath?: string;
  itemId?: string;
  fileId?: string;
  documentId?: string;
};

export type SkillStoreFabricOwner = {
  instance: { oid: bigint };
  storeSize: number;
};

export type AuditConsumerSurface = ConsumerSurface & {
  portal?: { id: string } | null;
};

export type AuditConsumerProfile = ConsumerProfile & {
  consumer: { id: string; email: string };
  surface: AuditConsumerSurface;
};

export type AuditInstanceConsumer = InstanceConsumer & {
  consumer: Consumer & {
    user: { id: string } | null;
    organizationMember: { id: string } | null;
  };
};

export type AuditConsumerSession = ConsumerSession & {
  consumerProfile: AuditConsumerProfile;
};

export type AuditPortal = Portal & {
  surface: { id: string };
};

export type AuditConsumerAccessTarget = {
  providerTemplate: ProviderTemplate | null;
  magicMcpServer: MagicMcpServer | null;
  skill: Skill | null;
  skillTemplate: SkillTemplate | null;
  skillGroup: SkillGroup | null;
  skillMarketplace: SkillMarketplace | null;
  skillPlugin: SkillPlugin | null;
};

export type AuditConsumerAccess = ConsumerAccess &
  AuditConsumerAccessTarget & {
    surface: { id: string };
    consumerGroup: ConsumerGroup;
    listing: ConsumerAccessListing | null;
  };

export type AuditConsumerAccessListing = ConsumerAccessListing &
  Omit<AuditConsumerAccessTarget, 'skillPlugin'> & {
    surface: { id: string };
    skillPlugin?: SkillPlugin | null;
  };

export type AuditConsumerAccessRequest = ConsumerAccessRequest & {
  surface: { id: string };
  consumerProfile: { id: string; email: string };
  providerTemplate: ProviderTemplate | null;
  magicMcpServer: MagicMcpServer | null;
};

export type AuditMagicMcpEndpoint = MagicMcpEndpoint & {
  consumerProfile: { id: string } | null;
  skillPlugin: { id: string } | null;
  servers: { magicMcpServer: { id: string; name: string | null } }[];
};

export type AuditMagicMcpGroup = MagicMcpGroup & {
  servers: { magicMcpServer: { id: string; name: string | null } }[];
};

export type AuditMagicMcpToken = MagicMcpToken & {
  magicMcpServer: { id: string } | null;
  magicMcpEndpoint: { id: string } | null;
  skillPlugin: { id: string } | null;
  groups: { magicMcpGroup: { id: string } }[];
};

export type MagicMcpServerMembershipFabricChange = {
  operation: 'add' | 'remove';
  servers: { id: string; name: string | null }[];
};

// prettier-ignore
export interface FabricEvents {
  'user.created:before': { context?: Context };
  'user.created:after': { user: User, performedBy: User; context?: Context };
  'user.updated:before': { user: User, performedBy: User; context?: Context };
  'user.updated:after': { user: User, performedBy: User; context?: Context };
  'user.deleted:before': { user: User, performedBy: User; context?: Context };
  'user.deleted:after': { user: User, performedBy: User; context?: Context };

  'user_tenant.created:after': { userTenant: FabricUserTenant };

  'enterprise.user.created:after': { user: FabricEnterpriseUser };
  'enterprise.user.updated:after': { user: FabricEnterpriseUser };
  'enterprise.user.deleted:after': { user: FabricEnterpriseUser };
  'enterprise.updated:after': { enterprise: FabricEnterprise };

  'user.session.created:before': { user: User, performedBy: User; context?: Context };
  'user.session.created:after': { user: User, session: UserSession, performedBy: User; context?: Context };
  'user.session.deleted:before': { user: User, session: UserSession, performedBy: User; context?: Context };
  'user.session.deleted:after': { user: User, session: UserSession, performedBy: User; context?: Context };

  'organization.created:before': { performedBy: User; context: Context };
  'organization.created:after': { organization: Organization, performedBy: User; context: Context };
  'organization.initialized:after': { organization: Organization; auditScope: AuditScope };
  'organization.updated:before': { organization: Organization; input: OrganizationUpdateInput; auditScope: AuditScope };
  'organization.updated:after': { organization: Organization; previousOrganization: Organization; input: OrganizationUpdateInput; auditScope: AuditScope };
  'organization.deleted:before': { organization: Organization; auditScope: AuditScope };
  'organization.deleted:after': { organization: Organization; auditScope: AuditScope };

  'organization.audit_log_stream.created:before': { organization: Organization; auditScope: AuditScope; input: { provider: AuditLogStream['provider'] } };
  'organization.audit_log_stream.created:after': { organization: Organization; auditScope: AuditScope; auditLogStream: AuditLogStream; input: { provider: AuditLogStream['provider'] } };
  'organization.audit_log_stream.updated:before': { organization: Organization; auditScope: AuditScope; auditLogStream: AuditLogStream; input: { provider?: AuditLogStream['provider']; status?: AuditLogStream['status'] } };
  'organization.audit_log_stream.updated:after': { organization: Organization; auditScope: AuditScope; auditLogStream: AuditLogStream; previousAuditLogStream: AuditLogStream; input: { provider?: AuditLogStream['provider']; status?: AuditLogStream['status'] } };
  'organization.audit_log_stream.deleted:before': { organization: Organization; auditScope: AuditScope; auditLogStream: AuditLogStream };
  'organization.audit_log_stream.deleted:after': { organization: Organization; auditScope: AuditScope; auditLogStream: AuditLogStream };
  'organization.audit_log_stream.paused:before': { organization: Organization; auditScope: AuditScope; auditLogStream: AuditLogStream };
  'organization.audit_log_stream.paused:after': { organization: Organization; auditScope: AuditScope; auditLogStream: AuditLogStream; previousAuditLogStream: AuditLogStream };
  'organization.audit_log_stream.resumed:before': { organization: Organization; auditScope: AuditScope; auditLogStream: AuditLogStream };
  'organization.audit_log_stream.resumed:after': { organization: Organization; auditScope: AuditScope; auditLogStream: AuditLogStream; previousAuditLogStream: AuditLogStream };

  'organization.actor.created:before': { organization: Organization; input: { type: OrganizationActor['type'] | 'primary_system'; name: string; email?: string; image?: PrismaJson.EntityImage }; auditScope: AuditScope };
  'organization.actor.created:after': { organization: Organization; actor: AuditOrganizationActor; auditScope: AuditScope };
  'organization.actor.updated:before': { organization: Organization; actor: OrganizationActor; input: { type?: OrganizationActor['type']; name?: string; email?: string; image?: PrismaJson.EntityImage }; auditScope: AuditScope };
  'organization.actor.updated:after': { organization: Organization; actor: AuditOrganizationActor; previousActor: OrganizationActor; input: { type?: OrganizationActor['type']; name?: string; email?: string; image?: PrismaJson.EntityImage }; auditScope: AuditScope };

  'organization.member.created:before': { organization: Organization; actor: OrganizationActor; user: User; auditScope: AuditScope };
  'organization.member.created:after': { organization: Organization; actor: OrganizationActor; user: User; member: AuditOrganizationMember; auditScope: AuditScope };
  'organization.member.updated:before': { organization: Organization; member: OrganizationMember; input: { role?: OrganizationMember['role'] }; auditScope: AuditScope };
  'organization.member.updated:after': { organization: Organization; member: AuditOrganizationMember; previousMember: OrganizationMember; input: { role?: OrganizationMember['role'] }; auditScope: AuditScope };
  'organization.member.deleted:before': { organization: Organization; member: OrganizationMember; auditScope: AuditScope };
  'organization.member.deleted:after': { organization: Organization; member: AuditOrganizationMember; auditScope: AuditScope };

  'organization.config.updated:before': { organization: Organization; user: User; config: OrganizationConfig; auditScope: AuditScope; input: { value: unknown } };
  'organization.config.updated:after': { organization: Organization; user: User; config: OrganizationConfig; previousConfig: OrganizationConfig; auditScope: AuditScope; input: { value: unknown } };
  'organization.layout.updated:before': { organization: Organization; user: User; layout: OrganizationLayout; auditScope: AuditScope; input: { value: unknown } };
  'organization.layout.updated:after': { organization: Organization; user: User; layout: OrganizationLayout; previousLayout: OrganizationLayout; auditScope: AuditScope; input: { value: unknown } };

  'organization.audit_log_retention.updated:before': { organization: Organization; auditScope: AuditScope; input: { auditLogRetentionInDays: number } };
  'organization.audit_log_retention.updated:after': { organization: Organization; previousOrganization: Organization; auditScope: AuditScope; input: { auditLogRetentionInDays: number } };

  'organization.invitation.created:before': { organization: Organization; input: { role: OrganizationMember['role'] } & ({ type: 'email'; email: string; message?: string } | { type: 'link' } | { type: 'onboarding'; email: string; message?: string }); auditScope: AuditScope };
  'organization.invitation.created:after': { organization: Organization; invite: AuditOrganizationInvite; input: { role: OrganizationMember['role'] } & ({ type: 'email'; email: string; message?: string } | { type: 'link' } | { type: 'onboarding'; email: string; message?: string }); auditScope: AuditScope };
  'organization.invitation.updated:before': { organization: Organization; invite: OrganizationInvite; input: { role: OrganizationMember['role'] }; auditScope: AuditScope };
  'organization.invitation.updated:after': { organization: Organization; invite: AuditOrganizationInvite; previousInvite: OrganizationInvite; input: { role: OrganizationMember['role'] }; auditScope: AuditScope };
  'organization.invitation.deleted:before': { organization: Organization; invite: OrganizationInvite; auditScope: AuditScope };
  'organization.invitation.deleted:after': { organization: Organization; invite: AuditOrganizationInvite; auditScope: AuditScope };

  'organization.invitation.accepted:before': { organization: Organization; invite: OrganizationInvite; user: User; auditScope: AuditScope };
  'organization.invitation.accepted:after': { organization: Organization; invite: AuditOrganizationInvite; previousInvite: OrganizationInvite; user: User; auditScope: AuditScope };
  'organization.invitation.rejected:before': { organization: Organization; invite: OrganizationInvite; user: User; auditScope: AuditScope };
  'organization.invitation.rejected:after': { organization: Organization; invite: AuditOrganizationInvite; previousInvite: OrganizationInvite; user: User; auditScope: AuditScope };

  'organization.invitation.join.created:before': { organization: Organization; member: OrganizationMember; invite: OrganizationInvite; auditScope: AuditScope };
  'organization.invitation.join.created:after': { organization: Organization; member: OrganizationMember; invite: OrganizationInvite; join: OrganizationInviteJoin; auditScope: AuditScope };

  'organization.project.created:before': { organization: Organization; input: ProjectCreateInput; auditScope: AuditScope };
  'organization.project.created:after': { organization: Organization; project: AuditProject; input: ProjectCreateInput; auditScope: AuditScope };
  'organization.project.updated:before': { organization: Organization; project: Project; input: ProjectUpdateInput; auditScope: AuditScope };
  'organization.project.updated:after': { organization: Organization; project: AuditProject; previousProject: Project; input: ProjectUpdateInput; auditScope: AuditScope };
  'organization.project.retention.updated:before': { organization: Organization; project: Project; auditScope: AuditScope; input: { logRetentionInDays?: number; enforceSessionExpiry?: boolean } };
  'organization.project.retention.updated:after': { organization: Organization; project: Project; previousProject: Project; auditScope: AuditScope; input: { logRetentionInDays?: number; enforceSessionExpiry?: boolean } };
  'organization.project.auth_config_configuration.updated:before': { organization: Organization; project: Project; auditScope: AuditScope; input: { allowAuthConfigExport?: boolean; allowAuthConfigImport?: boolean; consumerAuthClientRegistrationsPerHourLimit?: number; consumerAuthClientRegistrationsPerMinuteLimit?: number } };
  'organization.project.auth_config_configuration.updated:after': { organization: Organization; project: Project; previousProject: Project; auditScope: AuditScope; input: { allowAuthConfigExport?: boolean; allowAuthConfigImport?: boolean; consumerAuthClientRegistrationsPerHourLimit?: number; consumerAuthClientRegistrationsPerMinuteLimit?: number }; configuration: { allowAuthConfigExport: boolean; allowAuthConfigImport: boolean }; previousConfiguration: { allowAuthConfigExport: boolean; allowAuthConfigImport: boolean } };
  'organization.project.workforce_configuration.updated:before': { organization: Organization; project: Project; auditScope: AuditScope; input: { autoAddOrganizationMembersToPortals?: boolean } };
  'organization.project.workforce_configuration.updated:after': { organization: Organization; project: Project; previousProject: Project; auditScope: AuditScope; input: { autoAddOrganizationMembersToPortals?: boolean } };
  'organization.project.integration_naming_configuration.updated:before': { organization: Organization; project: Project; auditScope: AuditScope; input: { useIntegrationNames?: boolean } };
  'organization.project.integration_naming_configuration.updated:after': { organization: Organization; project: Project; auditScope: AuditScope; input: { useIntegrationNames?: boolean }; configuration: { useIntegrationNames: boolean }; previousConfiguration: { useIntegrationNames: boolean } };
  'organization.project.tool_calling_configuration.updated:before': { organization: Organization; project: Project; auditScope: AuditScope; input: { collectOperationDescriptionForToolCalls?: boolean, messageProcessingTimeoutMs?: number } };
  'organization.project.tool_calling_configuration.updated:after': { organization: Organization; project: Project; auditScope: AuditScope; input: { collectOperationDescriptionForToolCalls?: boolean, messageProcessingTimeoutMs?: number }; configuration: { collectOperationDescriptionForToolCalls: boolean, messageProcessingTimeoutMs: number }; previousConfiguration: { collectOperationDescriptionForToolCalls: boolean, messageProcessingTimeoutMs: number } };
  'organization.project.data_retention_configuration.updated:before': { organization: Organization; project: Project; auditScope: AuditScope; input: { dataRetentionLevel?: ProjectDataRetentionLevel, storeToolCallAttachments?: boolean, collectErrors?: boolean } };
  'organization.project.data_retention_configuration.updated:after': { organization: Organization; project: Project; auditScope: AuditScope; input: { dataRetentionLevel?: ProjectDataRetentionLevel, storeToolCallAttachments?: boolean, collectErrors?: boolean }; configuration: { dataRetentionLevel: ProjectDataRetentionLevel, storeToolCallAttachments: boolean, collectErrors: boolean }; previousConfiguration: { dataRetentionLevel: ProjectDataRetentionLevel, storeToolCallAttachments: boolean, collectErrors: boolean } };
  'organization.project.skill_sync_configuration.updated:before': { organization: Organization; project: Project; auditScope: AuditScope; input: { skillSyncGitLfsThresholdBytes?: number | null } };
  'organization.project.skill_sync_configuration.updated:after': { organization: Organization; project: Project; previousProject: Project; auditScope: AuditScope; input: { skillSyncGitLfsThresholdBytes?: number | null } };
  'organization.project.brand.updated:before': { organization: Organization; project: Project; brand: AuditProjectBrand; input: { name?: string; imageFileId?: string | null; image?: PrismaJson.EntityImage }; auditScope: AuditScope };
  'organization.project.brand.updated:after': { organization: Organization; project: Project; brand: AuditProjectBrand; previousBrand: AuditProjectBrand; input: { name?: string; imageFileId?: string | null; image?: PrismaJson.EntityImage }; auditScope: AuditScope };
  'organization.project.deleted:before': { organization: Organization; project: Project; auditScope: AuditScope };
  'organization.project.deleted:after': { organization: Organization; project: AuditProject; auditScope: AuditScope };

  'organization.project.instance.created:before': { organization: Organization; project: Project; input: InstanceCreateInput; auditScope: AuditScope };
  'organization.project.instance.created:after': { organization: Organization; project: Project; instance: AuditInstance; input: InstanceCreateInput; auditScope: AuditScope };
  'organization.project.instance.updated:before': { organization: Organization; project: Project; instance: Instance; input: InstanceUpdateInput; auditScope: AuditScope };
  'organization.project.instance.updated:after': { organization: Organization; project: Project; instance: AuditInstance; previousInstance: Instance; input: InstanceUpdateInput; auditScope: AuditScope };
  'organization.project.instance.deleted:before': { organization: Organization; project: Project; instance: Instance; auditScope: AuditScope };
  'organization.project.instance.deleted:after': { organization: Organization; project: Project; instance: AuditInstance; auditScope: AuditScope };

  'key_provider.imported:before': KeyProviderEventBase & { currentCount: number };
  'key_provider.imported:after': KeyProviderEventBase & { keyProvider: KeyProviderEventKeyProvider };
  'key_provider.managed.created:before': KeyProviderEventBase & { currentCount: number };
  'key_provider.managed.created:after': KeyProviderEventBase & { keyProvider: KeyProviderEventKeyProvider };
  'key_provider.default.set:after': KeyProviderEventBase & { keyProvider: KeyProviderEventKeyProvider };
  'key_provider.validated:after': KeyProviderEventBase & { keyProvider: KeyProviderEventKeyProvider, validation: KeyProviderEventValidation };

  'organization.team.created:before': { organization: Organization; input: { name: string; description?: string }; auditScope: AuditScope };
  'organization.team.created:after': { organization: Organization; team: AuditTeam; input: { name: string; description?: string }; auditScope: AuditScope };
  'organization.team.updated:before': { organization: Organization; team: Team; input: { name?: string; description?: string }; auditScope: AuditScope };
  'organization.team.updated:after': { organization: Organization; team: AuditTeam; previousTeam: Team; input: { name?: string; description?: string }; auditScope: AuditScope };
  'organization.team.deleted:before': { organization: Organization; team: Team; auditScope: AuditScope };
  'organization.team.deleted:after': { organization: Organization; team: AuditTeam; auditScope: AuditScope };

  'organization.team.member.added:before': { organization: Organization; team: Team; actor: OrganizationActor; auditScope: AuditScope };
  'organization.team.member.added:after': { organization: Organization; team: Team; actor: OrganizationActor; member: TeamMember; auditScope: AuditScope };
  'organization.team.member.removed:before': { organization: Organization; team: Team; actor: OrganizationActor; member: TeamMember; auditScope: AuditScope };
  'organization.team.member.removed:after': { organization: Organization; team: Team; actor: OrganizationActor; member: TeamMember; auditScope: AuditScope };

  'organization.team.project.assigned:before': { organization: Organization; team: Team; project: Project; auditScope: AuditScope };
  'organization.team.project.assigned:after': { organization: Organization; team: Team; project: Project; teamProject: TeamProject; auditScope: AuditScope };
  'organization.team.project.unassigned:before': { organization: Organization; team: Team; project: Project; teamProject: TeamProject; auditScope: AuditScope };
  'organization.team.project.unassigned:after': { organization: Organization; team: Team; project: Project; teamProject: TeamProject; auditScope: AuditScope };

  'organization.access_role.created:before': { organization: Organization; auditScope: AuditScope; input: { name: string; description?: string; scopes?: string[]; isAdmin?: boolean; message?: string; } };
  'organization.access_role.created:after': { organization: Organization; auditScope: AuditScope; input: { name: string; description?: string; scopes?: string[]; isAdmin?: boolean; message?: string; }; accessRole: AuditAccessRole };
  'organization.access_role.updated:before': { organization: Organization; auditScope: AuditScope; accessRole: AccessRole; input: { name?: string; description?: string | null; scopes?: string[]; message?: string; } };
  'organization.access_role.updated:after': { organization: Organization; auditScope: AuditScope; accessRole: AuditAccessRole; previousAccessRole: AccessRole; input: { name?: string; description?: string | null; scopes?: string[]; message?: string; } };
  'organization.access_role.deleted:before': { organization: Organization; auditScope: AuditScope; accessRole: AccessRole };
  'organization.access_role.deleted:after': { organization: Organization; auditScope: AuditScope; accessRole: AuditAccessRole };

  'organization.access_policy.created:before': { organization: Organization; auditScope: AuditScope; input: { name: string; description?: string; document: PrismaJson.PolicyDocument; type?: AccessPolicy['type']; message?: string; } };
  'organization.access_policy.created:after': { organization: Organization; auditScope: AuditScope; input: { name: string; description?: string; document: PrismaJson.PolicyDocument; type?: AccessPolicy['type']; message?: string; }; accessPolicy: AuditAccessPolicy };
  'organization.access_policy.updated:before': { organization: Organization; auditScope: AuditScope; accessPolicy: AccessPolicy; input: { name?: string; description?: string | null; document?: PrismaJson.PolicyDocument; message?: string; } };
  'organization.access_policy.updated:after': { organization: Organization; auditScope: AuditScope; accessPolicy: AuditAccessPolicy; previousAccessPolicy: AccessPolicy; input: { name?: string; description?: string | null; document?: PrismaJson.PolicyDocument; message?: string; } };
  'organization.access_policy.deleted:before': { organization: Organization; auditScope: AuditScope; accessPolicy: AccessPolicy };
  'organization.access_policy.deleted:after': { organization: Organization; auditScope: AuditScope; accessPolicy: AuditAccessPolicy };
  'organization.access_policy.assignment.team.created:before': { organization: Organization; team: Team; accessPolicy: AccessPolicy; auditScope: AuditScope };
  'organization.access_policy.assignment.team.created:after': { organization: Organization; team: Team; accessPolicy: AccessPolicy; accessPolicyAssignment: AccessPolicyAssignment; auditScope: AuditScope };
  'organization.access_policy.assignment.team.deleted:before': { organization: Organization; team: Team; accessPolicy: AccessPolicy; accessPolicyAssignment: AccessPolicyAssignment; auditScope: AuditScope };
  'organization.access_policy.assignment.team.deleted:after': { organization: Organization; team: Team; accessPolicy: AccessPolicy; accessPolicyAssignment: AccessPolicyAssignment; auditScope: AuditScope };
  'organization.access_policy.assignment.member.created:before': { organization: Organization; member: OrganizationMember; accessPolicy: AccessPolicy; auditScope: AuditScope };
  'organization.access_policy.assignment.member.created:after': { organization: Organization; member: OrganizationMember; accessPolicy: AccessPolicy; accessPolicyAssignment: AccessPolicyAssignment; auditScope: AuditScope };
  'organization.access_policy.assignment.member.deleted:before': { organization: Organization; member: OrganizationMember; accessPolicy: AccessPolicy; accessPolicyAssignment: AccessPolicyAssignment; auditScope: AuditScope };
  'organization.access_policy.assignment.member.deleted:after': { organization: Organization; member: OrganizationMember; accessPolicy: AccessPolicy; accessPolicyAssignment: AccessPolicyAssignment; auditScope: AuditScope };
  'organization.access_policy.assignment.service_account.created:before': { organization: Organization; serviceAccount: ServiceAccount; accessPolicy: AccessPolicy; auditScope: AuditScope };
  'organization.access_policy.assignment.service_account.created:after': { organization: Organization; serviceAccount: ServiceAccount; accessPolicy: AccessPolicy; accessPolicyAssignment: AccessPolicyAssignment; auditScope: AuditScope };
  'organization.access_policy.assignment.service_account.deleted:before': { organization: Organization; serviceAccount: ServiceAccount; accessPolicy: AccessPolicy; accessPolicyAssignment: AccessPolicyAssignment; auditScope: AuditScope };
  'organization.access_policy.assignment.service_account.deleted:after': { organization: Organization; serviceAccount: ServiceAccount; accessPolicy: AccessPolicy; accessPolicyAssignment: AccessPolicyAssignment; auditScope: AuditScope };

  'billing.plan.created:after': { plan: FabricBillingPlan };
  'billing.plan.updated:after': { plan: FabricBillingPlan };
  'billing.account.created:after': { account: FabricBillingAccount };
  'billing.subscription.updated:after': { subscription: FabricOrganizationSubscription };

  'machine_access.created:before': MachineAccessInput;
  'machine_access.created:after': MachineAccessInput & { machineAccess: MachineAccess };
  'machine_access.updated:before': { machineAccess: MachineAccess; organization: Organization; auditScope: AuditScope };
  'machine_access.updated:after': { machineAccess: MachineAccess; previousMachineAccess: MachineAccess; organization: Organization; auditScope: AuditScope };
  'machine_access.deleted:before': { machineAccess: MachineAccess; organization: Organization; auditScope: AuditScope };
  'machine_access.deleted:after': { machineAccess: MachineAccess; organization: Organization; auditScope: AuditScope };

  'machine_access.api_key.created:before': { machineAccess: MachineAccess; organization: Organization; auditScope: AuditScope };
  'machine_access.api_key.created:after': { machineAccess: MachineAccess; apiKey: ApiKey; organization: Organization; auditScope: AuditScope };
  'machine_access.api_key.updated:before': { machineAccess: MachineAccess; apiKey: ApiKey; organization: Organization; auditScope: AuditScope };
  'machine_access.api_key.updated:after': { machineAccess: MachineAccess; apiKey: ApiKey; previousApiKey: ApiKey; organization: Organization; auditScope: AuditScope };
  'machine_access.api_key.revoked:before': { machineAccess: MachineAccess; apiKey: ApiKey; organization: Organization; auditScope: AuditScope };
  'machine_access.api_key.revoked:after': { machineAccess: MachineAccess; apiKey: ApiKey; previousApiKey: ApiKey; organization: Organization; auditScope: AuditScope };
  'machine_access.api_key.rotated:before': { machineAccess: MachineAccess; apiKey: ApiKey; organization: Organization; auditScope: AuditScope };
  'machine_access.api_key.rotated:after': { machineAccess: MachineAccess; apiKey: ApiKey; previousApiKey: ApiKey; organization: Organization; auditScope: AuditScope };
  'machine_access.api_key.expired:before': { machineAccess: MachineAccess; apiKey: ApiKey; organization: Organization; auditScope: AuditScope };
  'machine_access.api_key.expired:after': { machineAccess: MachineAccess; apiKey: ApiKey; previousApiKey: ApiKey; organization: Organization; auditScope: AuditScope };
  'machine_access.api_key:revealed': { machineAccess: MachineAccess; apiKey: ApiKey; organization: Organization; auditScope: AuditScope };

  'machine_access.oauth_application.created:before': { organization: Organization | null; auditScope: AuditScope | null; input: OAuthApplicationCreateInput; serverSideMachineAccess: MachineAccess | null; };
  'machine_access.oauth_application.created:after': { organization: Organization | null; auditScope: AuditScope | null; input: OAuthApplicationCreateInput; serverSideMachineAccess: MachineAccess | null; oauthApplication: OAuthApplication; };
  'machine_access.oauth_application.updated:before': { oauthApplication: OAuthApplication; organization: Organization | null; auditScope: AuditScope | null; input: OAuthApplicationUpdateInput; };
  'machine_access.oauth_application.updated:after': { oauthApplication: OAuthApplication; previousOAuthApplication: OAuthApplication; organization: Organization | null; auditScope: AuditScope | null; input: OAuthApplicationUpdateInput; };
  'machine_access.oauth_application.archived:before': { oauthApplication: OAuthApplication; organization: Organization | null; auditScope: AuditScope | null; };
  'machine_access.oauth_application.archived:after': { oauthApplication: OAuthApplication; organization: Organization | null; auditScope: AuditScope | null; };
  'machine_access.oauth_application.client_secret.create:after': { oauthApplication: OAuthApplication; oauthApplicationClientSecret: OAuthApplicationClientSecret; auditScope?: AuditScope | null };
  'machine_access.oauth_application.client_secret.revoked:after': { oauthApplication: OAuthApplication; oauthApplicationClientSecret: OAuthApplicationClientSecret; auditScope?: AuditScope | null };

  'machine_access.oauth_installation.created:before': { oauthApplication: OAuthApplication; organization: Organization; auditScope?: AuditScope };
  'machine_access.oauth_installation.created:after': { oauthApplication: OAuthApplication; oauthInstallation: OAuthInstallation; organization: Organization; appActor: OrganizationActor | null; auditScope?: AuditScope };
  'machine_access.oauth_installation.updated:before': { oauthApplication: OAuthApplication; organization: Organization; auditScope?: AuditScope };
  'machine_access.oauth_installation.updated:after': { oauthApplication: OAuthApplication; oauthInstallation: OAuthInstallation; previousOAuthInstallation: OAuthInstallation; organization: Organization; appActor: OrganizationActor | null; auditScope?: AuditScope };
  'machine_access.oauth_installation.revoked:before': { oauthApplication: OAuthApplication; oauthInstallation: OAuthInstallation; organization: Organization; auditScope: AuditScope };
  'machine_access.oauth_installation.revoked:after': { oauthApplication: OAuthApplication; oauthInstallation: OAuthInstallation; previousOAuthInstallation: OAuthInstallation; organization: Organization; appActor: OrganizationActor | null; auditScope: AuditScope };

  'machine_access.oauth_authorization.created:before': { oauthApplication: OAuthApplication; oauthInstallation: OAuthInstallation; organization: Organization; auditScope?: AuditScope };
  'machine_access.oauth_authorization.created:after': { oauthApplication: OAuthApplication; oauthInstallation: OAuthInstallation; oauthAuthorization: OAuthAuthorization; organization: Organization; appActor: OrganizationActor | null; auditScope?: AuditScope };
  'machine_access.oauth_authorization.updated:before': { oauthApplication: OAuthApplication; oauthInstallation: OAuthInstallation; organization: Organization; auditScope?: AuditScope };
  'machine_access.oauth_authorization.updated:after': { oauthApplication: OAuthApplication; oauthInstallation: OAuthInstallation; oauthAuthorization: OAuthAuthorization; previousOAuthAuthorization: OAuthAuthorization; organization: Organization; appActor: OrganizationActor | null; auditScope?: AuditScope };
  'machine_access.oauth_authorization.revoked:before': { oauthApplication: OAuthApplication; oauthInstallation: OAuthInstallation; oauthAuthorization: OAuthAuthorization; organization: Organization; appActor: OrganizationActor | null; auditScope: AuditScope };
  'machine_access.oauth_authorization.revoked:after': { oauthApplication: OAuthApplication; oauthInstallation: OAuthInstallation; oauthAuthorization: OAuthAuthorization; previousOAuthAuthorization: OAuthAuthorization; organization: Organization; appActor: OrganizationActor | null; auditScope: AuditScope };

  'machine_access.oauth_authorization_request.accepted:before': { oauthApplication: OAuthApplication; oauthAuthorizationRequest: OAuthAuthorizationRequestWithRelations; organization: Organization; member: OrganizationMember; auditScope: AuditScope };
  'machine_access.oauth_authorization_request.accepted:after': { oauthApplication: OAuthApplication; oauthAuthorizationRequest: OAuthAuthorizationRequestWithRelations; previousOAuthAuthorizationRequest: OAuthAuthorizationRequestWithRelations; organization: Organization; member: OrganizationMember; auditScope: AuditScope };
  'machine_access.oauth_authorization_request.denied:before': { oauthApplication: OAuthApplication; oauthAuthorizationRequest: OAuthAuthorizationRequestWithRelations; organization: Organization; member: OrganizationMember; auditScope: AuditScope };
  'machine_access.oauth_authorization_request.denied:after': { oauthApplication: OAuthApplication; oauthAuthorizationRequest: OAuthAuthorizationRequestWithRelations; previousOAuthAuthorizationRequest: OAuthAuthorizationRequestWithRelations; organization: Organization; member: OrganizationMember; auditScope: AuditScope };

  'machine_access.oauth_token.created:before': { oauthApplication: OAuthApplication; oauthInstallation: OAuthInstallation; oauthAuthorization: OAuthAuthorization; organization: Organization; appActor: OrganizationActor | null; auditScope?: AuditScope };
  'machine_access.oauth_token.created:after': { oauthApplication: OAuthApplication; oauthInstallation: OAuthInstallation; oauthAuthorization: OAuthAuthorization; oauthToken: OAuthToken; organization: Organization; appActor: OrganizationActor | null; auditScope?: AuditScope };
  'machine_access.oauth_token.refreshed:before': { oauthApplication: OAuthApplication; oauthInstallation: OAuthInstallation; oauthAuthorization: OAuthAuthorization; oauthToken: OAuthToken; organization: Organization; appActor: OrganizationActor | null; auditScope?: AuditScope };
  'machine_access.oauth_token.refreshed:after': { oauthApplication: OAuthApplication; oauthInstallation: OAuthInstallation; oauthAuthorization: OAuthAuthorization; oauthToken: OAuthToken; organization: Organization; appActor: OrganizationActor | null; auditScope?: AuditScope };

  'machine_access.service_account.created:before': { organization: Organization; auditScope: AuditScope; input: ServiceAccountCreateInput; };
  'machine_access.service_account.created:after': { organization: Organization; auditScope: AuditScope; input: ServiceAccountCreateInput; serviceAccount: AuditServiceAccount; oauthApplication: AuditOAuthApplication; };
  'machine_access.service_account.updated:before': { serviceAccount: ServiceAccount; oauthApplication: OAuthApplication; organization: Organization; auditScope: AuditScope; input: ServiceAccountUpdateInput; };
  'machine_access.service_account.updated:after': { serviceAccount: AuditServiceAccount; previousServiceAccount: AuditServiceAccount; oauthApplication: AuditOAuthApplication; organization: Organization; auditScope: AuditScope; input: ServiceAccountUpdateInput; };
  'machine_access.service_account.archived:before': { serviceAccount: ServiceAccount; oauthApplication: OAuthApplication; organization: Organization; auditScope: AuditScope; };
  'machine_access.service_account.archived:after': { serviceAccount: AuditServiceAccount; oauthApplication: AuditOAuthApplication; organization: Organization; auditScope: AuditScope; };
  'machine_access.service_account_credential.created:before': { serviceAccount: ServiceAccount; oauthApplication: OAuthApplication; oauthInstallation: OAuthInstallation; oauthAuthorization: OAuthAuthorization; organization: Organization; appActor: OrganizationActor | null; auditScope?: AuditScope };
  'machine_access.service_account_credential.created:after': { serviceAccount: ServiceAccount; serviceAccountCredential: ServiceAccountCredential; oauthApplication: OAuthApplication; oauthInstallation: OAuthInstallation; oauthAuthorization: OAuthAuthorization; organization: Organization; appActor: OrganizationActor | null; auditScope?: AuditScope };

  'portal.created:before': { organization: Organization; instance: Instance; context: Context; auditScope: AuditScope; isDefaultPortal: boolean; input: { name: string; description?: string; sessionExpiryTimeInSeconds?: number; } };
  'portal.created:after': { organization: Organization; instance: Instance; portal: AuditPortal; context: Context; auditScope: AuditScope; input: { name: string; description?: string; sessionExpiryTimeInSeconds?: number; } };
  'portal.updated:before': { portal: Portal; auditScope: AuditScope; input: { name?: string; description?: string; sessionExpiryTimeInSeconds?: number; } };
  'portal.updated:after': { portal: AuditPortal; previousPortal: AuditPortal; auditScope: AuditScope; input: { name?: string; description?: string; sessionExpiryTimeInSeconds?: number; } };
  'portal.archived:before': { portal: Portal; auditScope: AuditScope };
  'portal.archived:after': { portal: AuditPortal; auditScope: AuditScope };

  'workspace.created:before':
    | { organization: Organization }
    | { portal: Portal }
    | { enterprise: FabricEnterprise };
  'workspace.created:after':
    | { workspace: Workspace; organization: Organization }
    | { workspace: Workspace; portal: Portal }
    | { workspace: Workspace; enterprise: FabricEnterprise };
  'workspace.updated:before':
    | { workspace: Workspace; organization: Organization }
    | { workspace: Workspace; portal: Portal }
    | { workspace: Workspace; enterprise: FabricEnterprise };
  'workspace.updated:after':
    | { workspace: Workspace; organization: Organization }
    | { workspace: Workspace; portal: Portal }
    | { workspace: Workspace; enterprise: FabricEnterprise };
  'workspace.deleted:before':
    | { workspace: Workspace; organization: Organization }
    | { workspace: Workspace; portal: Portal }
    | { workspace: Workspace };
  'workspace.deleted:after':
    | { workspace: Workspace; organization: Organization }
    | { workspace: Workspace; portal: Portal }
    | { workspace: Workspace };

  'workspace_profile.created:before':
    | { consumerProfile: ConsumerProfile }
    | { organizationMember: OrganizationMember }
    | { enterpriseMember: FabricEnterpriseMember };
  'workspace_profile.created:after':
    | { workspaceProfile: WorkspaceProfile; consumerProfile: ConsumerProfile }
    | { workspaceProfile: WorkspaceProfile; organizationMember: OrganizationMember }
    | { workspaceProfile: WorkspaceProfile; enterpriseMember: FabricEnterpriseMember };
  'workspace_profile.updated:before':
    | { workspaceProfile: WorkspaceProfile; consumerProfile: ConsumerProfile }
    | { workspaceProfile: WorkspaceProfile; organizationMember: OrganizationMember }
    | { workspaceProfile: WorkspaceProfile; enterpriseMember: FabricEnterpriseMember };
  'workspace_profile.updated:after':
    | { workspaceProfile: WorkspaceProfile; consumerProfile: ConsumerProfile }
    | { workspaceProfile: WorkspaceProfile; organizationMember: OrganizationMember }
    | { workspaceProfile: WorkspaceProfile; enterpriseMember: FabricEnterpriseMember };
  'workspace_profile.deleted:before':
    | { workspaceProfile: WorkspaceProfile; consumerProfile: ConsumerProfile }
    | { workspaceProfile: WorkspaceProfile; organizationMember: OrganizationMember }
    | { workspaceProfile: WorkspaceProfile; enterpriseMember: FabricEnterpriseMember };
  'workspace_profile.deleted:after':
    | { workspaceProfile: WorkspaceProfile; consumerProfile: ConsumerProfile }
    | { workspaceProfile: WorkspaceProfile; organizationMember: OrganizationMember }
    | { workspaceProfile: WorkspaceProfile; enterpriseMember: FabricEnterpriseMember };

  'workspace_group.created:before':
    | { team: Team }
    | { consumerGroup: ConsumerGroup };
  'workspace_group.created:after':
    | { workspaceGroup: WorkspaceGroup; team: Team }
    | { workspaceGroup: WorkspaceGroup; consumerGroup: ConsumerGroup };
  'workspace_group.updated:before':
    | { workspaceGroup: WorkspaceGroup; team: Team }
    | { workspaceGroup: WorkspaceGroup; consumerGroup: ConsumerGroup };
  'workspace_group.updated:after':
    | { workspaceGroup: WorkspaceGroup; team: Team }
    | { workspaceGroup: WorkspaceGroup; consumerGroup: ConsumerGroup };
  'workspace_group.deleted:before':
    | { workspaceGroup: WorkspaceGroup; team: Team }
    | { workspaceGroup: WorkspaceGroup; consumerGroup: ConsumerGroup };
  'workspace_group.deleted:after':
    | { workspaceGroup: WorkspaceGroup; team: Team }
    | { workspaceGroup: WorkspaceGroup; consumerGroup: ConsumerGroup };

  'workspace_policy.created:before': { accessPolicy: AccessPolicy } | { enterpriseId: string; role: FabricEnterpriseMemberRole };
  'workspace_policy.created:after': { workspacePolicy: WorkspacePolicy; accessPolicy: AccessPolicy } | { workspacePolicy: WorkspacePolicy; enterpriseId: string; role: FabricEnterpriseMemberRole };
  'workspace_policy.updated:before': { workspacePolicy: WorkspacePolicy; accessPolicy: AccessPolicy } | { workspacePolicy: WorkspacePolicy; enterpriseId: string; role: FabricEnterpriseMemberRole };
  'workspace_policy.updated:after': { workspacePolicy: WorkspacePolicy; accessPolicy: AccessPolicy } | { workspacePolicy: WorkspacePolicy; enterpriseId: string; role: FabricEnterpriseMemberRole };
  'workspace_policy.deleted:before': { workspacePolicy: WorkspacePolicy; };
  'workspace_policy.deleted:after': { workspacePolicy: WorkspacePolicy; };

  'workspace_group_assignment.created:before':
    | { workspaceGroup: WorkspaceGroup; workspaceProfile: WorkspaceProfile; teamMember: TeamMember }
    | { workspaceGroup: WorkspaceGroup; workspaceProfile: WorkspaceProfile; consumerGroup: ConsumerGroup; consumerProfileGroup: ConsumerProfileGroup };
  'workspace_group_assignment.created:after':
    | { workspaceGroup: WorkspaceGroup; workspaceProfile: WorkspaceProfile; teamMember: TeamMember; workspaceGroupAssignment: WorkspaceGroupAssignment }
    | { workspaceGroup: WorkspaceGroup; workspaceProfile: WorkspaceProfile; consumerGroup: ConsumerGroup; consumerProfileGroup: ConsumerProfileGroup; workspaceGroupAssignment: WorkspaceGroupAssignment };
  'workspace_group_assignment.deleted:before':
    | { workspaceGroup: WorkspaceGroup; workspaceProfile: WorkspaceProfile; workspaceGroupAssignment: WorkspaceGroupAssignment }
    | { workspaceGroup: WorkspaceGroup; workspaceProfile: WorkspaceProfile; consumerGroup: ConsumerGroup; };
  'workspace_group_assignment.deleted:after':
    | { workspaceGroup: WorkspaceGroup; workspaceProfile: WorkspaceProfile; workspaceGroupAssignment: WorkspaceGroupAssignment }
    | { workspaceGroup: WorkspaceGroup; workspaceProfile: WorkspaceProfile; consumerGroup: ConsumerGroup; };

  'workspace_policy_assignment.created:before':
    | { accessPolicyAssignment: AccessPolicyAssignment; workspacePolicy: WorkspacePolicy; workspaceGroup?: WorkspaceGroup; workspaceProfile?: WorkspaceProfile }
    | { enterpriseMember: FabricEnterpriseMember; workspacePolicy: WorkspacePolicy; workspaceProfile?: WorkspaceProfile };
  'workspace_policy_assignment.created:after':
    | { accessPolicyAssignment: AccessPolicyAssignment; workspacePolicy: WorkspacePolicy; workspacePolicyAssignment: WorkspacePolicyAssignment; workspaceGroup?: WorkspaceGroup; workspaceProfile?: WorkspaceProfile }
    | { enterpriseMember: FabricEnterpriseMember; workspacePolicy: WorkspacePolicy; workspacePolicyAssignment: WorkspacePolicyAssignment; workspaceProfile?: WorkspaceProfile };
  'workspace_policy_assignment.deleted:before': { workspacePolicy: WorkspacePolicy; workspacePolicyAssignment: WorkspacePolicyAssignment; workspaceGroup?: WorkspaceGroup; workspaceProfile?: WorkspaceProfile };
  'workspace_policy_assignment.deleted:after': { workspacePolicy: WorkspacePolicy; workspacePolicyAssignment: WorkspacePolicyAssignment; workspaceGroup?: WorkspaceGroup; workspaceProfile?: WorkspaceProfile };

  'consumer.profile.created:before': { surface: ConsumerSurface };
  'consumer.profile.created:after': { consumerProfile: AuditConsumerProfile, surface: ConsumerSurface, auditScope: AuditScope };
  'consumer.profile.updated:before': { consumerProfile: ConsumerProfile, surface: ConsumerSurface };
  'consumer.profile.updated:after': { consumerProfile: AuditConsumerProfile, previousConsumerProfile: AuditConsumerProfile, surface: ConsumerSurface, auditScope: AuditScope };
  'consumer.profile.deleted:before': { consumerProfile: ConsumerProfile, surface: ConsumerSurface };
  'consumer.profile.deleted:after': { consumerProfile: AuditConsumerProfile, surface: ConsumerSurface, auditScope: AuditScope };
  'consumer.profile.group.added:before': { consumerProfile: ConsumerProfile, consumerGroup: ConsumerGroup };
  'consumer.profile.group.added:after': { consumerProfile: ConsumerProfile, consumerGroup: ConsumerGroup, consumerProfileGroup: ConsumerProfileGroup, auditScope: AuditScope };
  'consumer.profile.group.removed:before': { consumerProfile: ConsumerProfile, consumerGroup: ConsumerGroup, consumerProfileGroup: ConsumerProfileGroup };
  'consumer.profile.group.removed:after': { consumerProfile: ConsumerProfile, consumerGroup: ConsumerGroup, consumerProfileGroup: ConsumerProfileGroup, auditScope: AuditScope };

  'consumer.created:after': { consumer: Consumer; instanceConsumer: InstanceConsumer };
  'consumer.updated:after': { consumer: Consumer };
  'consumer.deleted:after': { consumerId: string };

  'consumer.identity.created:after': { instanceConsumer: AuditInstanceConsumer; auditScope: AuditScope };
  'consumer.identity.updated:after': { instanceConsumer: AuditInstanceConsumer; previousInstanceConsumer: AuditInstanceConsumer; auditScope: AuditScope };

  'consumer.session.created:after': { consumerSession: AuditConsumerSession; auditScope: AuditScope };
  'consumer.session.revoked:after': { consumerSession: AuditConsumerSession; auditScope: AuditScope };

  'consumer.surface.created:after': { organization: Organization; instance: Instance; consumerSurface: ConsumerSurface; auditScope: AuditScope };
  'consumer.surface.updated:after': { consumerSurface: ConsumerSurface; previousConsumerSurface: ConsumerSurface; auditScope: AuditScope };
  'consumer.surface.archived:after': { consumerSurface: ConsumerSurface; auditScope: AuditScope };

  'consumer.group.created:before': { consumerSurface: ConsumerSurface, input: { name: string; description?: string; ssoGroupIds?: string[]; isDefault?: boolean } };
  'consumer.group.created:after': { consumerSurface: ConsumerSurface, consumerGroup: ConsumerGroup, auditScope: AuditScope, input: { name: string; description?: string; ssoGroupIds?: string[]; isDefault?: boolean } };
  'consumer.group.updated:before': { consumerGroup: ConsumerGroup, input: { name?: string; description?: string; ssoGroupIds?: string[]; isDefault?: boolean } };
  'consumer.group.updated:after': { consumerSurface: ConsumerSurface, consumerGroup: ConsumerGroup, previousConsumerGroup: ConsumerGroup, auditScope: AuditScope, input: { name?: string; description?: string; ssoGroupIds?: string[]; isDefault?: boolean } };
  'consumer.group.archived:before': { organization: Organization, consumerGroup: ConsumerGroup };
  'consumer.group.archived:after': { organization: Organization, consumerSurface: ConsumerSurface, consumerGroup: ConsumerGroup, auditScope: AuditScope };

  'consumer.invite.created:before': { consumerProfile: ConsumerProfile, consumerSurface: ConsumerSurface, performedBy: OrganizationActor };
  'consumer.invite.created:after': { consumerInvite: ConsumerInvite, consumerProfile: ConsumerProfile, consumerSurface: ConsumerSurface, performedBy: OrganizationActor, auditScope: AuditScope };
  'consumer.invite.updated:before': { consumerProfile: ConsumerProfile, consumerSurface: ConsumerSurface, performedBy: OrganizationActor, consumerInviteId: string };
  'consumer.invite.updated:after': { consumerInvite: ConsumerInvite, consumerProfile: ConsumerProfile, consumerSurface: ConsumerSurface, performedBy: OrganizationActor, auditScope?: AuditScope };
  'consumer.invite.deleted:after': { consumerInvite: ConsumerInvite, consumerProfile: ConsumerProfile, consumerSurface: ConsumerSurface, auditScope: AuditScope };

  'consumer.access.created:after': { consumerAccess: AuditConsumerAccess; auditScope: AuditScope };
  'consumer.access.updated:after': { consumerAccess: AuditConsumerAccess; previousConsumerAccess: AuditConsumerAccess; auditScope: AuditScope };
  'consumer.access.deleted:after': { consumerAccess: AuditConsumerAccess; auditScope: AuditScope };

  'consumer.access_listing.created:after': { consumerAccessListing: AuditConsumerAccessListing; auditScope: AuditScope };
  'consumer.access_listing.updated:after': { consumerAccessListing: AuditConsumerAccessListing; previousConsumerAccessListing: AuditConsumerAccessListing; auditScope: AuditScope };
  'consumer.access_listing.deleted:after': { consumerAccessListing: AuditConsumerAccessListing; auditScope: AuditScope };

  'consumer.access_request.created:after': { consumerAccessRequest: AuditConsumerAccessRequest; auditScope: AuditScope };
  'consumer.access_request.reviewed:after': { consumerAccessRequest: AuditConsumerAccessRequest; previousConsumerAccessRequest: AuditConsumerAccessRequest; auditScope: AuditScope };

  'workspace_invite.created:before':
    | { consumerInvite: ConsumerInvite }
    | { organizationInvite: OrganizationInvite }
    | { enterpriseInvite: FabricEnterpriseInvite };
  'workspace_invite.created:after':
    | { workspaceInvite: WorkspaceInvite; consumerInvite: ConsumerInvite }
    | { workspaceInvite: WorkspaceInvite; organizationInvite: OrganizationInvite }
    | { workspaceInvite: WorkspaceInvite; enterpriseInvite: FabricEnterpriseInvite };
  'workspace_invite.updated:before':
    | { workspaceInvite: WorkspaceInvite; consumerInvite: ConsumerInvite }
    | { workspaceInvite: WorkspaceInvite; organizationInvite: OrganizationInvite }
    | { workspaceInvite: WorkspaceInvite; enterpriseInvite: FabricEnterpriseInvite };
  'workspace_invite.updated:after':
    | { workspaceInvite: WorkspaceInvite; consumerInvite: ConsumerInvite }
    | { workspaceInvite: WorkspaceInvite; organizationInvite: OrganizationInvite }
    | { workspaceInvite: WorkspaceInvite; enterpriseInvite: FabricEnterpriseInvite };
  'workspace_invite.deleted:before':
    | { workspaceInvite: WorkspaceInvite; organizationInvite: OrganizationInvite }
    | { workspaceInvite: WorkspaceInvite; enterpriseInvite: FabricEnterpriseInvite };
  'workspace_invite.deleted:after':
    | { workspaceInvite: WorkspaceInvite; organizationInvite: OrganizationInvite }
    | { workspaceInvite: WorkspaceInvite; enterpriseInvite: FabricEnterpriseInvite };


  'consumer.provider.deployed:before': { instance: Instance; auditScope: AuditScope };
  'consumer.provider.deployed:after': { instance: Instance; auditScope: AuditScope; deployment: AuditConsumerProviderDeployment };

  'consumer.surface_provider_group.created:after': { auditScope: AuditScope; consumerSurface: ConsumerSurface; consumerSurfaceProviderGroup: AuditConsumerSurfaceProviderGroup };
  'consumer.surface_provider_group.updated:after': { auditScope: AuditScope; consumerSurface: ConsumerSurface; consumerSurfaceProviderGroup: AuditConsumerSurfaceProviderGroup; previousConsumerSurfaceProviderGroup: AuditConsumerSurfaceProviderGroup };
  'consumer.surface_provider_group.deleted:after': { auditScope: AuditScope; consumerSurface: ConsumerSurface; consumerSurfaceProviderGroup: AuditConsumerSurfaceProviderGroup };
  'consumer.surface_provider_group.listing.added:after': { auditScope: AuditScope; consumerSurfaceProviderGroup: AuditConsumerSurfaceProviderGroup; consumerAccessListing: { id: string } };
  'consumer.surface_provider_group.listing.removed:after': { auditScope: AuditScope; consumerSurfaceProviderGroup: AuditConsumerSurfaceProviderGroup; consumerAccessListing: { id: string } };

  'consumer.integration_setup_session.created:before': { instance: Instance };
  'consumer.integration_setup_session.created:after': { instance: Instance; setupSession: SubspaceIntegrationSetupSession; binding: { id: string }; consumerSurface: ConsumerSurface; consumerProfile: ConsumerProfile; providerTemplate: ProviderTemplate; auditScope: AuditScope };

  'magic_mcp.server.created:before': { organization: Organization; instance: Instance };
  'magic_mcp.server.created:after': { organization: Organization; instance: Instance; magicMcpServer: MagicMcpServer; auditScope: AuditScope };
  'magic_mcp.server.updated:after': { instance: Instance; magicMcpServer: MagicMcpServer; previousMagicMcpServer: MagicMcpServer; auditScope: AuditScope };
  'magic_mcp.server.archived:after': { organization: Organization; instance: Instance; magicMcpServer: MagicMcpServer; auditScope: AuditScope };
  'magic_mcp.endpoint.created:before': { instance: Instance };
  'magic_mcp.endpoint.created:after': { instance: Instance; magicMcpEndpoint: AuditMagicMcpEndpoint; auditScope: AuditScope };
  'magic_mcp.endpoint.updated:after': { instance: Instance; magicMcpEndpoint: AuditMagicMcpEndpoint; previousMagicMcpEndpoint: AuditMagicMcpEndpoint; auditScope: AuditScope };
  'magic_mcp.endpoint.archived:after': { instance: Instance; magicMcpEndpoint: AuditMagicMcpEndpoint; auditScope: AuditScope };
  'magic_mcp.endpoint.servers.modified:after': { magicMcpEndpoint: AuditMagicMcpEndpoint; auditScope: AuditScope } & MagicMcpServerMembershipFabricChange;

  'magic_mcp.group.created:after': { instance: Instance; magicMcpGroup: AuditMagicMcpGroup; auditScope: AuditScope };
  'magic_mcp.group.updated:after': { instance: Instance; magicMcpGroup: AuditMagicMcpGroup; previousMagicMcpGroup: AuditMagicMcpGroup; auditScope: AuditScope };
  'magic_mcp.group.deleted:after': { magicMcpGroup: AuditMagicMcpGroup; auditScope: AuditScope };
  'magic_mcp.group.servers.modified:after': { magicMcpGroup: AuditMagicMcpGroup; auditScope: AuditScope } & MagicMcpServerMembershipFabricChange;

  'magic_mcp.token.created:after': { instance: Instance; magicMcpToken: AuditMagicMcpToken; auditScope: AuditScope };
  'magic_mcp.token.updated:after': { magicMcpToken: AuditMagicMcpToken; previousMagicMcpToken: AuditMagicMcpToken; auditScope: AuditScope };
  'magic_mcp.token.rotated:after': { magicMcpToken: AuditMagicMcpToken; auditScope: AuditScope };
  'magic_mcp.token.deleted:after': { magicMcpToken: AuditMagicMcpToken; auditScope: AuditScope };

  'magic_mcp.provider_template.created:after': { organization: Organization; instance: Instance; providerTemplate: ProviderTemplate; auditScope: AuditScope };
  'magic_mcp.provider_template.updated:after': { instance: Instance; providerTemplate: ProviderTemplate; previousProviderTemplate: ProviderTemplate; auditScope: AuditScope };
  'magic_mcp.provider_template.archived:after': { instance: Instance; providerTemplate: ProviderTemplate; auditScope: AuditScope };

  'skill.created:before': { instance: Instance };
  'skill.created:after': { instance: Instance; skill: Skill };
  'skill.updated:after': { instance: Instance; skill: Skill };
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

  'skill.store.size:before': SkillStoreFabricOwner;

  'file.upload.created:before': FileFabricOwner;
  'file.upload.created:after': FileFabricOwner & { fileUpload: FileUpload };
  'file.upload.completed:before': FileFabricOwner & { fileUpload: FileUpload };
  'file.upload.completed:after': FileFabricOwner & { fileUpload: FileUpload; file: File };

  'file.created:before': FileFabricOwner;
  'file.created:after': FileFabricOwner & { file: AuditFile };
  'file.deleted:after': FileFabricOwner & { file: AuditFile };

  'document.created:after': { auditScope: AuditScope; document: AuditDocument };
  'document.deleted:after': { auditScope: AuditScope; document: AuditDocument };
  'document.version.sealed:after': { document: { id: string; title: string }; version: { id: string; versionNumber: number; byteSize: number; editedAt: Date }; previousVersionId: string | null; editors: { auditScope: AuditScope }[] };

  'store.created:after': { auditScope: AuditScope; store: AuditStore };
  'store.updated:after': { auditScope: AuditScope; store: AuditStore; previousStore: AuditStore };
  'store.deleted:after': { auditScope: AuditScope; store: AuditStore };
  'store.items.modified:after': { auditScope: AuditScope; store: AuditStore; skill: { id: string } | null; operations: StoreItemFabricOperation[]; counts: { add: number; modify: number; remove: number }; truncated: boolean };

  'provider.deployment.created:before': ProviderEventBase;
  'provider.deployment.created:after': ProviderEventBase & { deployment: AuditSubspaceProviderDeployment };
  'provider.deployment.updated:before': ProviderEventBase;
  'provider.deployment.updated:after': ProviderEventBase & { deployment: AuditSubspaceProviderDeployment; previousDeployment: AuditSubspaceProviderDeployment };
  'provider.deployment.deleted:before': ProviderEventBase;
  'provider.deployment.deleted:after': ProviderEventBase & { deployment: AuditSubspaceProviderDeployment };

  'provider.config.created:before': ProviderEventBase;
  'provider.config.created:after': ProviderEventBase & { config: AuditSubspaceProviderConfig };
  'provider.config.updated:before': ProviderEventBase;
  'provider.config.updated:after': ProviderEventBase & { config: AuditSubspaceProviderConfig; previousConfig: AuditSubspaceProviderConfig };
  'provider.config.deleted:before': ProviderEventBase;
  'provider.config.deleted:after': ProviderEventBase & { config: AuditSubspaceProviderConfig };

  'provider.auth_config.created:before': ProviderEventBase;
  'provider.auth_config.created:after': ProviderEventBase & { authConfig: AuditSubspaceProviderAuthConfig };
  'provider.auth_config.updated:before': ProviderEventBase;
  'provider.auth_config.updated:after': ProviderEventBase & { authConfig: AuditSubspaceProviderAuthConfig; previousAuthConfig: AuditSubspaceProviderAuthConfig };
  'provider.auth_config.deleted:before': ProviderEventBase;
  'provider.auth_config.deleted:after': ProviderEventBase & { authConfig: AuditSubspaceProviderAuthConfig };

  'provider.auth_credentials.created:before': ProviderEventBase;
  'provider.auth_credentials.created:after': ProviderEventBase & { authCredentials: AuditSubspaceProviderAuthCredentials };
  'provider.auth_credentials.updated:before': ProviderEventBase;
  'provider.auth_credentials.updated:after': ProviderEventBase & { authCredentials: AuditSubspaceProviderAuthCredentials; previousAuthCredentials: AuditSubspaceProviderAuthCredentials };
  'provider.auth_credentials.managed_created:after': { auditScope: AuditScope; authCredentials: AuditSubspaceProviderAuthCredentials };
  'provider.auth_credentials.managed_updated:after': { auditScope: AuditScope; authCredentials: AuditSubspaceProviderAuthCredentials; previousAuthCredentials: AuditSubspaceProviderAuthCredentials };

  'provider.auth_credentials.deleted:before': ProviderEventBase;
  'provider.auth_credentials.deleted:after': ProviderEventBase & { authCredentials: AuditSubspaceProviderAuthCredentials };

  'provider.auth_export.created:before': ProviderEventBase;
  'provider.auth_export.created:after': ProviderEventBase & { authExport: AuditSubspaceProviderAuthExport };

  'provider.auth_import.created:before': ProviderEventBase;
  'provider.auth_import.created:after': ProviderEventBase & { authImport: AuditSubspaceProviderAuthImport };

  'provider.config_vault.created:before': ProviderEventBase;
  'provider.config_vault.created:after': ProviderEventBase & { configVault: AuditSubspaceProviderConfigVault };
  'provider.config_vault.updated:before': ProviderEventBase;
  'provider.config_vault.updated:after': ProviderEventBase & { configVault: AuditSubspaceProviderConfigVault; previousConfigVault: AuditSubspaceProviderConfigVault };
  'provider.config_vault.deleted:before': ProviderEventBase;
  'provider.config_vault.deleted:after': ProviderEventBase & { configVault: AuditSubspaceProviderConfigVault };

  'provider.integration.created:before': ProviderEventBase;
  'provider.integration.created:after': ProviderEventBase & { integration: AuditSubspaceIntegration };
  'provider.integration.updated:before': ProviderEventBase;
  'provider.integration.updated:after': ProviderEventBase & { integration: AuditSubspaceIntegration; previousIntegration: AuditSubspaceIntegration };
  'provider.integration.deleted:before': ProviderEventBase;
  'provider.integration.deleted:after': ProviderEventBase & { integration: AuditSubspaceIntegration };

  'provider.integration_instance.created:before': ProviderEventBase;
  'provider.integration_instance.created:after': ProviderEventBase & { integrationInstance: AuditSubspaceIntegrationInstance };
  'provider.integration_instance.updated:before': ProviderEventBase;
  'provider.integration_instance.updated:after': ProviderEventBase & { integrationInstance: AuditSubspaceIntegrationInstance; previousIntegrationInstance: AuditSubspaceIntegrationInstance };
  'provider.integration_instance.deleted:before': ProviderEventBase;
  'provider.integration_instance.deleted:after': ProviderEventBase & { integrationInstance: AuditSubspaceIntegrationInstance };

  'provider.integration_provider.created:before': ProviderEventBase;
  'provider.integration_provider.created:after': ProviderEventBase & { integrationProvider: AuditSubspaceIntegrationProvider };
  'provider.integration_provider.updated:before': ProviderEventBase;
  'provider.integration_provider.updated:after': ProviderEventBase & { integrationProvider: AuditSubspaceIntegrationProvider; previousIntegrationProvider: AuditSubspaceIntegrationProvider };
  'provider.integration_provider.deleted:before': ProviderEventBase;
  'provider.integration_provider.deleted:after': ProviderEventBase & { integrationProvider: AuditSubspaceIntegrationProvider };

  'provider.integration_instance_group.created:before': ProviderEventBase;
  'provider.integration_instance_group.created:after': ProviderEventBase & { integrationInstanceGroup: AuditSubspaceIntegrationInstanceGroup };
  'provider.integration_instance_group.updated:before': ProviderEventBase;
  'provider.integration_instance_group.updated:after': ProviderEventBase & { integrationInstanceGroup: AuditSubspaceIntegrationInstanceGroup; previousIntegrationInstanceGroup: AuditSubspaceIntegrationInstanceGroup };
  'provider.integration_instance_group.deleted:before': ProviderEventBase;
  'provider.integration_instance_group.deleted:after': ProviderEventBase & { integrationInstanceGroup: AuditSubspaceIntegrationInstanceGroup };

  'provider.integration_instance_provider.set:before': ProviderEventBase;
  'provider.integration_instance_provider.set:after': ProviderEventBase & { integrationInstanceProvider: AuditSubspaceIntegrationInstanceProvider };

  'provider.integration_instance_group_provider.set:before': ProviderEventBase;
  'provider.integration_instance_group_provider.set:after': ProviderEventBase & { integrationInstanceGroupProvider: AuditSubspaceIntegrationInstanceProvider };
  'provider.integration_instance_group_provider.deleted:before': ProviderEventBase;
  'provider.integration_instance_group_provider.deleted:after': ProviderEventBase & { integrationInstanceGroupProvider: AuditSubspaceIntegrationInstanceProvider };

  'identity.agent.created:before': ProviderEventBase;
  'identity.agent.created:after': ProviderEventBase & { agent: AuditSubspaceAgent };
  'identity.agent.updated:before': ProviderEventBase;
  'identity.agent.updated:after': ProviderEventBase & { agent: AuditSubspaceAgent; previousAgent: AuditSubspaceAgent };
  'identity.agent.deleted:before': ProviderEventBase;
  'identity.agent.deleted:after': ProviderEventBase & { agent: AuditSubspaceAgent };

  'identity.agent_client.created:before': ProviderEventBase;
  'identity.agent_client.created:after': ProviderEventBase & { agentClient: AuditSubspaceAgentClient };

  'identity.actor.created:before': ProviderEventBase;
  'identity.actor.created:after': ProviderEventBase & { identityActor: AuditSubspaceIdentityActor };

  'identity.created:before': ProviderEventBase;
  'identity.created:after': ProviderEventBase & { identity: AuditSubspaceIdentity };
  'identity.updated:before': ProviderEventBase;
  'identity.updated:after': ProviderEventBase & { identity: AuditSubspaceIdentity; previousIdentity: AuditSubspaceIdentity };

  'identity.credential.created:before': ProviderEventBase;
  'identity.credential.created:after': ProviderEventBase & { identityCredential: AuditSubspaceIdentityCredential };
  'identity.credential.updated:before': ProviderEventBase;
  'identity.credential.updated:after': ProviderEventBase & { identityCredential: AuditSubspaceIdentityCredential; previousIdentityCredential: AuditSubspaceIdentityCredential };
  'identity.credential.deleted:before': ProviderEventBase;
  'identity.credential.deleted:after': ProviderEventBase & { identityCredential: AuditSubspaceIdentityCredential };

  'identity.delegation.created:before': ProviderEventBase;
  'identity.delegation.created:after': ProviderEventBase & { identityDelegation: AuditSubspaceIdentityDelegation };
  'identity.delegation.revoked:before': ProviderEventBase;
  'identity.delegation.revoked:after': ProviderEventBase & { identityDelegation: AuditSubspaceIdentityDelegation };

  'identity.delegation_config.created:before': ProviderEventBase;
  'identity.delegation_config.created:after': ProviderEventBase & { identityDelegationConfig: AuditSubspaceIdentityDelegationConfig };
  'identity.delegation_config.updated:before': ProviderEventBase;
  'identity.delegation_config.updated:after': ProviderEventBase & { identityDelegationConfig: AuditSubspaceIdentityDelegationConfig; previousIdentityDelegationConfig: AuditSubspaceIdentityDelegationConfig };
  'identity.delegation_config.deleted:before': ProviderEventBase;
  'identity.delegation_config.deleted:after': ProviderEventBase & { identityDelegationConfig: AuditSubspaceIdentityDelegationConfig };

  'provider.integration_setup_session.created:before': ProviderEventBase;
  'provider.integration_setup_session.created:after': ProviderEventBase & { setupSession: AuditSubspaceIntegrationSetupSession };

  'provider.setup_session.created:before': ProviderEventBase;
  'provider.setup_session.created:after': ProviderEventBase & { setupSession: AuditSubspaceProviderSetupSession };
  'provider.setup_session.updated:before': ProviderEventBase;
  'provider.setup_session.updated:after': ProviderEventBase & { setupSession: AuditSubspaceProviderSetupSession; previousSetupSession: AuditSubspaceProviderSetupSession };

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
  'provider.session.created:after': ProviderEventBase & { session: AuditSubspaceSession };
  'provider.session.updated:before': ProviderEventBase;
  'provider.session.updated:after': ProviderEventBase & { session: AuditSubspaceSession; previousSession: AuditSubspaceSession };
  /**
   * A session created or rotated for an ephemeral managed session. The managed session
   * itself is not audited -- it is the mechanism -- but the sessions it stands up are
   * real sessions and belong in the log, attributed to the system actor that made them.
   */
  'provider.session.ephemeral_created:after': { auditScope: AuditScope; session: AuditSubspaceSession };

  'provider.session.deleted:before': ProviderEventBase;
  'provider.session.deleted:after': ProviderEventBase & { session: AuditSubspaceSession };

  'provider.session.provider.created:before': ProviderEventBase;
  'provider.session.provider.created:after': ProviderEventBase & { sessionProvider: AuditSubspaceSessionProvider };
  'provider.session.provider.updated:before': ProviderEventBase;
  'provider.session.provider.updated:after': ProviderEventBase & { sessionProvider: AuditSubspaceSessionProvider; previousSessionProvider: AuditSubspaceSessionProvider };
  'provider.session.provider.deleted:before': ProviderEventBase;
  'provider.session.provider.deleted:after': ProviderEventBase & { sessionProvider: AuditSubspaceSessionProvider };

  'provider.session_template.created:before': ProviderEventBase;
  'provider.session_template.created:after': ProviderEventBase & { sessionTemplate: AuditSubspaceSessionTemplate };
  'provider.session_template.updated:before': ProviderEventBase;
  'provider.session_template.updated:after': ProviderEventBase & { sessionTemplate: AuditSubspaceSessionTemplate; previousSessionTemplate: AuditSubspaceSessionTemplate };
  'provider.session_template.deleted:before': ProviderEventBase;
  'provider.session_template.deleted:after': ProviderEventBase & { sessionTemplate: AuditSubspaceSessionTemplate };

  'provider.session_template.provider.created:before': ProviderEventBase;
  'provider.session_template.provider.created:after': ProviderEventBase & { sessionTemplateProvider: AuditSubspaceSessionTemplateProvider };
  'provider.session_template.provider.updated:before': ProviderEventBase;
  'provider.session_template.provider.updated:after': ProviderEventBase & { sessionTemplateProvider: AuditSubspaceSessionTemplateProvider; previousSessionTemplateProvider: AuditSubspaceSessionTemplateProvider };
  'provider.session_template.provider.deleted:before': ProviderEventBase;
  'provider.session_template.provider.deleted:after': ProviderEventBase & { sessionTemplateProvider: AuditSubspaceSessionTemplateProvider };

  'provider.session_message.created:before': ProviderEventBase;
  'provider.tool_call.created:before': ProviderEventBase;
  'provider.tool_call.created:after': ProviderEventBase & { toolCall: SubspaceToolCall };

  'provider.custom_provider.created:before': ProviderEventBase;
  'provider.custom_provider.created:after': ProviderEventBase & { customProvider: AuditSubspaceCustomProvider };
  'provider.custom_provider.updated:before': ProviderEventBase;
  'provider.custom_provider.updated:after': ProviderEventBase & { customProvider: AuditSubspaceCustomProvider; previousCustomProvider: AuditSubspaceCustomProvider };
  'provider.custom_provider.archived:before': ProviderEventBase;
  'provider.custom_provider.archived:after': ProviderEventBase & { customProvider: AuditSubspaceCustomProvider };

  'provider.custom_provider.version.created:before': ProviderEventBase;
  'provider.custom_provider.version.created:after': ProviderEventBase & { customProviderVersion: AuditSubspaceCustomProviderVersion };

  'provider.custom_provider.commit.created:before': ProviderEventBase;
  'provider.custom_provider.commit.created:after': ProviderEventBase & { customProviderCommit: AuditSubspaceCustomProviderCommit };

  'provider.scm_repository.created:before': ProviderEventBase;
  'provider.scm_repository.created:after': ProviderEventBase & { scmRepository: AuditSubspaceScmRepo };
  'provider.scm_repository.linked:before': ProviderEventBase;
  'provider.scm_repository.linked:after': ProviderEventBase & { scmRepository: AuditSubspaceScmRepo; customProvider?: { id: string; name: string } | null };

  'provider.custom_provider.code_bucket.file.written:before': ProviderEventBase;
  'provider.custom_provider.code_bucket.file.written:after': ProviderEventBase & { file: AuditSubspaceCodeBucketFile };
  'provider.custom_provider.code_bucket.file.deleted:before': ProviderEventBase;
  'provider.custom_provider.code_bucket.file.deleted:after': ProviderEventBase & { file: AuditSubspaceCodeBucketFile };

  'provider.provider_listing_group.created:before': ProviderEventBase;
  'provider.provider_listing_group.created:after': ProviderEventBase & { providerGroup: SubspaceProviderListingGroup };
  'provider.provider_listing_group.updated:before': ProviderEventBase;
  'provider.provider_listing_group.updated:after': ProviderEventBase & { providerGroup: SubspaceProviderListingGroup; previousProviderGroup: SubspaceProviderListingGroup };
  'provider.provider_listing_group.listing.added:before': ProviderEventBase;
  'provider.provider_listing_group.listing.added:after': ProviderEventBase & { providerGroup: SubspaceProviderListingGroup; providerListing: { id: string; provider: { id: string; name: string } } };
  'provider.provider_listing_group.listing.removed:before': ProviderEventBase;
  'provider.provider_listing_group.listing.removed:after': ProviderEventBase & { providerGroup: SubspaceProviderListingGroup; providerListing: { id: string; provider: { id: string; name: string } } };
  'provider.provider_listing_group.deleted:before': ProviderEventBase;
  'provider.provider_listing_group.deleted:after': ProviderEventBase & { providerGroup: SubspaceProviderListingGroup };

  'instance.network.firewall.created:before': ProviderEventBase;
  'instance.network.firewall.created:after': ProviderEventBase & { firewall: AuditSubspaceFirewall };
  'instance.network.firewall.updated:before': ProviderEventBase;
  'instance.network.firewall.updated:after': ProviderEventBase & { firewall: AuditSubspaceFirewall; previousFirewall: AuditSubspaceFirewall };
  'instance.network.firewall.deleted:before': ProviderEventBase;
  'instance.network.firewall.deleted:after': ProviderEventBase & { firewall: AuditSubspaceFirewall };
  'instance.network.firewall.network_policy.attached:before': ProviderEventBase;
  'instance.network.firewall.network_policy.attached:after': ProviderEventBase & { firewall: AuditSubspaceFirewall; previousFirewall: AuditSubspaceFirewall };
  'instance.network.firewall.network_policy.detached:before': ProviderEventBase;
  'instance.network.firewall.network_policy.detached:after': ProviderEventBase & { firewall: AuditSubspaceFirewall; previousFirewall: AuditSubspaceFirewall };

  'instance.network.firewall_binding.created:before': ProviderEventBase;
  'instance.network.firewall_binding.created:after': ProviderEventBase & { firewallBinding: AuditSubspaceFirewallBinding };
  'instance.network.firewall_binding.deleted:before': ProviderEventBase;
  'instance.network.firewall_binding.deleted:after': ProviderEventBase & { firewallBinding: AuditSubspaceFirewallBinding };

  'instance.network.network_policy.created:before': ProviderEventBase;
  'instance.network.network_policy.created:after': ProviderEventBase & { networkPolicy: AuditSubspaceNetworkPolicy };
  'instance.network.network_policy.updated:before': ProviderEventBase;
  'instance.network.network_policy.updated:after': ProviderEventBase & { networkPolicy: AuditSubspaceNetworkPolicy; previousNetworkPolicy: AuditSubspaceNetworkPolicy };
  'instance.network.network_policy.deleted:before': ProviderEventBase;
  'instance.network.network_policy.deleted:after': ProviderEventBase & { networkPolicy: AuditSubspaceNetworkPolicy };
  'instance.network.network_policy.rule.created:before': ProviderEventBase;
  'instance.network.network_policy.rule.created:after': ProviderEventBase & { networkPolicy: AuditSubspaceNetworkPolicy; previousNetworkPolicy: AuditSubspaceNetworkPolicy; rule: PrismaJson.NetworkPolicyRule };
  'instance.network.network_policy.rule.updated:before': ProviderEventBase;
  'instance.network.network_policy.rule.updated:after': ProviderEventBase & { networkPolicy: AuditSubspaceNetworkPolicy; previousNetworkPolicy: AuditSubspaceNetworkPolicy; rule: PrismaJson.NetworkPolicyRule };
  'instance.network.network_policy.rule.deleted:before': ProviderEventBase;
  'instance.network.network_policy.rule.deleted:after': ProviderEventBase & { networkPolicy: AuditSubspaceNetworkPolicy; previousNetworkPolicy: AuditSubspaceNetworkPolicy; ruleId: string };
}
