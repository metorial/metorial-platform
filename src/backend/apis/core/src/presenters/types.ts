import {
  ApiKey,
  ApiKeySecret,
  Consumer,
  ConsumerAccess,
  ConsumerAccessRequest,
  ConsumerGroup,
  ConsumerProfile,
  ConsumerProfileGroup,
  ConsumerSession,
  ConsumerSurface,
  File,
  FileLink,
  FilePurpose,
  Instance,
  MachineAccess,
  MagicMcpGroup,
  MagicMcpGroupToken,
  MagicMcpServer,
  MagicMcpServerAlias,
  MagicMcpServerSubspaceSession,
  MagicMcpToken,
  Organization,
  OrganizationActor,
  OrganizationInvite,
  OrganizationMember,
  Portal,
  Profile,
  Project,
  ProviderTemplate,
  Secret,
  SecretType,
  Team,
  TeamMember,
  TeamProject,
  TeamProjectRoleAssignment,
  TeamRole,
  User
} from '@metorial/db';
import {
  ConsumerAresApp,
  ConsumerAresSsoConnection,
  ConsumerAresSsoTenant,
  ConsumerAresSsoTenantSetup,
  ConsumerProviderCatalogEntry
} from '@metorial/module-consumer';
import { Flags } from '@metorial/module-flags';
import {
  SubspaceBucket,
  SubspaceCallback,
  SubspaceCallbackDestination,
  SubspaceCallbackEvent,
  SubspaceCallbackInstance,
  SubspaceCallbackNotification,
  SubspaceCustomProvider,
  SubspaceCustomProviderCommit,
  SubspaceCustomProviderDeployment,
  SubspaceCustomProviderDeploymentLogs,
  SubspaceCustomProviderEnvironment,
  SubspaceCustomProviderVersion,
  SubspaceIdentity,
  SubspaceIdentityActor,
  SubspaceIdentityCredential,
  SubspaceIdentityDelegation,
  SubspaceIdentityDelegationConfig,
  SubspaceIdentityDelegationRequest,
  SubspaceProvider,
  SubspaceProviderAuthConfig,
  SubspaceProviderAuthConfigSchema,
  SubspaceProviderAuthCredentials,
  SubspaceProviderAuthExport,
  SubspaceProviderAuthImport,
  SubspaceProviderAuthImportSchema,
  SubspaceProviderAuthMethod,
  SubspaceProviderConfig,
  SubspaceProviderConfigSchema,
  SubspaceProviderConfigVault,
  SubspaceProviderDeployment,
  SubspaceProviderListing,
  SubspaceProviderListingCategory,
  SubspaceProviderListingCollection,
  SubspaceProviderListingGroup,
  SubspaceProviderOAuthSetup,
  SubspaceProviderRun,
  SubspaceProviderRunLogs,
  SubspaceProviderSetupSession,
  SubspaceProviderSpecification,
  SubspaceProviderTool,
  SubspaceProviderTrigger,
  SubspaceProviderType,
  SubspaceProviderVersion,
  SubspacePublisher,
  SubspaceScmAccountPreviews,
  SubspaceScmConnection,
  SubspaceScmConnectionSetupSession,
  SubspaceScmProvider,
  SubspaceScmProviderSetupSession,
  SubspaceScmRepository,
  SubspaceScmRepositoryPreviews,
  SubspaceSession,
  SubspaceSessionConnection,
  SubspaceSessionError,
  SubspaceSessionErrorGroup,
  SubspaceSessionEvent,
  SubspaceSessionMessage,
  SubspaceSessionParticipant,
  SubspaceSessionProvider,
  SubspaceSessionTemplate,
  SubspaceSessionTemplateProvider,
  SubspaceSessionWarning,
  SubspaceToolCall
} from '@metorial/module-subspace';
import { PresentableType } from '@metorial/presenter';

export let bootType = PresentableType.create<{
  user: User;
  organizations: (Organization & {
    member: OrganizationMember & {
      actor: OrganizationActor & {
        teams: (TeamMember & {
          team: Team;
        })[];
      };
    };
  })[];
  projects: (Project & { organization: Organization })[];
  instances: (Instance & { project: Project; organization: Organization })[];
}>()('boot');

export let userType = PresentableType.create<{
  user: User;
}>()('user');

export let projectType = PresentableType.create<{
  project: Project & { organization: Organization };
}>()('project');

export let projectBrandType = PresentableType.create<{
  projectBrand: ProjectBrandOverride;
}>()('projectBrand');

export let instanceType = PresentableType.create<{
  instance: Instance & { project: Project; organization: Organization };
}>()('instance');

export let organizationType = PresentableType.create<{
  organization: Organization;
}>()('organization');

export let organizationInviteType = PresentableType.create<{
  organizationInvite: OrganizationInvite & {
    organization: Organization;
    invitedBy: OrganizationActor;
  };
}>()('organization_invite');

export let organizationMemberType = PresentableType.create<{
  organizationMember: OrganizationMember & {
    organization: Organization;
    actor: OrganizationActor & {
      teams: (TeamMember & { team: Team })[];
    };
    user: User;
  };
}>()('organization_member');

export let organizationActorType = PresentableType.create<{
  organizationActor: OrganizationActor & {
    organization: Organization;
    teams?: (TeamMember & { team: Team })[] | null | undefined;
  };
}>()('organization_actor');

export let machineAccessType = PresentableType.create<{
  machineAccess: MachineAccess & {
    organization: Organization | null;
    actor: OrganizationActor | null;
    instance: (Instance & { project: Project }) | null;
    user: User | null;
  };
}>()('machine_access');

export let apiKeyType = PresentableType.create<{
  apiKey: ApiKey & {
    machineAccess: MachineAccess & {
      organization: Organization | null;
      actor: OrganizationActor | null;
      instance: (Instance & { project: Project }) | null;
      user: User | null;
    };
  };
  secret?: ApiKeySecret;
  canReveal: boolean;
}>()('api_key');

export let fileType = PresentableType.create<{
  file: File & { purpose: FilePurpose };
}>()('file');

export let fileLinkType = PresentableType.create<{
  fileLink: FileLink & { file: File };
}>()('fileLink');

export let secretType = PresentableType.create<{
  secret: Secret & { type: SecretType; organization: Organization; instance: Instance };
}>()('secret');

export let usageType = PresentableType.create<{
  timeline: {
    entityId: string;
    entityType: string;
    ownerId: string;
    entries: {
      ts: Date;
      count: number;
    }[];
  }[];
}>()('usage');

export let profileType = PresentableType.create<{
  profile: Profile;
}>()('profile');

export let flagsType = PresentableType.create<{
  flags: Flags;
}>()('flags');

export let magicMcpServerType = PresentableType.create<{
  magicMcpServer: MagicMcpServer & {
    aliases: MagicMcpServerAlias[];
    subspaceSession: MagicMcpServerSubspaceSession | null;
  };
}>()('magic_mcp.server');

export let magicMcpSessionType = PresentableType.create<{
  magicMcpSession: MagicMcpServerSubspaceSession & {
    magicMcpServer: MagicMcpServer & {
      aliases: MagicMcpServerAlias[];
      subspaceSession: MagicMcpServerSubspaceSession | null;
    };
  };
}>()('magic_mcp.session');

export let magicMcpTokenType = PresentableType.create<{
  magicMcpToken: MagicMcpToken & {
    groups: (MagicMcpGroupToken & {
      magicMcpGroup: MagicMcpGroup;
    })[];
  };
}>()('magic_mcp.token');

export let magicMcpGroupType = PresentableType.create<{
  magicMcpGroup: MagicMcpGroup;
}>()('magic_mcp.group');

export let consumerGroupType = PresentableType.create<{
  consumerGroup: ConsumerGroup;
}>()('consumer.group');

export let consumerAccessType = PresentableType.create<{
  consumerAccess: ConsumerAccess & {
    consumerGroup: ConsumerGroup;
    providerTemplate: ProviderTemplate | null;
    magicMcpServer: MagicMcpServer | null;
  };
}>()('consumer.access');

export let consumerAccessRequestType = PresentableType.create<{
  consumerAccessRequest: ConsumerAccessRequest & {
    consumerProfile: ConsumerProfile & {
      consumer: Consumer;
      personalConsumerGroup: ConsumerGroup;
    };
    providerTemplate: ProviderTemplate | null;
    magicMcpServer: MagicMcpServer | null;
  };
}>()('consumer.access_request');

export let consumerProfileType = PresentableType.create<{
  consumerProfile: ConsumerProfile & {
    consumer: Consumer;
    groups: (ConsumerProfileGroup & {
      group: ConsumerGroup;
    })[];
  };
  assignedConsumerGroups:
    | (ConsumerGroup & {
        assignedVia: 'default' | 'manual' | 'sso' | 'user';
      })[]
    | undefined;
}>()('consumer.profile');

export let consumerSessionType = PresentableType.create<{
  consumerSession: ConsumerSession;
}>()('consumer.session');

export let consumerProviderType = PresentableType.create<{
  consumerProvider: ConsumerProviderCatalogEntry;
}>()('consumer.provider');

export let callbackType = PresentableType.create<{
  callback: SubspaceCallback;
}>()('callback');

export let callbackEventType = PresentableType.create<{
  callbackEvent: SubspaceCallbackEvent;
}>()('callback.event');

export let callbackDestinationType = PresentableType.create<{
  callbackDestination: SubspaceCallbackDestination;
}>()('callback.destination');

export let callbackNotificationType = PresentableType.create<{
  callbackNotification: SubspaceCallbackNotification;
}>()('callback.notification');

export let callbackInstanceType = PresentableType.create<{
  callbackInstance: SubspaceCallbackInstance;
}>()('callback.instance');

export let portalType = PresentableType.create<{
  portal: Portal & {
    surface: ConsumerSurface;
    organization: Organization;
  };
  portalUrl: string;
}>()('portal');

export let providerTemplateType = PresentableType.create<{
  providerTemplate: ProviderTemplate;
}>()('provider.template');

export let portalAuthAppType = PresentableType.create<{
  app: ConsumerAresApp;
}>()('portal.auth.app');

export let portalAuthSsoTenantType = PresentableType.create<{
  ssoTenant: ConsumerAresSsoTenant;
}>()('portal.auth.sso_tenant');

export let portalAuthSsoConnectionType = PresentableType.create<{
  ssoConnection: ConsumerAresSsoConnection;
}>()('portal.auth.sso_connection');

export let portalAuthSsoTenantSetupType = PresentableType.create<{
  ssoTenantSetup: ConsumerAresSsoTenantSetup;
}>()('portal.auth.sso_tenant_setup');

// export let consumerAuthFactorType = PresentableType.create<{
//   consumerAuthFactor: ConsumerSurfaceAuthFactor;
// }>()('consumer.auth_factor');

// export let consumerGroupType = PresentableType.create<{
//   consumerGroup: ConsumerGroup;
// }>()('consumer.group');

// export let consumerAccessType = PresentableType.create<{
//   consumerAccess: ConsumerAccess & {
//     consumerGroup: ConsumerGroup;
//     serverDeploymentTemplate: (ServerDeploymentTemplate & { server: Server }) | null;
//   };
// }>()('consumer.access');

// export let consumerServerRequestType = PresentableType.create<{
//   consumerServerRequest: ConsumerServerRequest & {
//     server: Server;
//     consumerProfile: ConsumerProfile;
//   };
// }>()('consumer.server_request');

// export let consumerProfileType = PresentableType.create<{
//   consumerProfile: ConsumerProfile & {
//     consumer: Consumer;
//     groups: (ConsumerProfileGroup & {
//       group: ConsumerGroup;
//     })[];
//   };
//   assignedConsumerGroups:
//     | (ConsumerGroup & {
//         assignedVia: 'default' | 'manual' | 'sso' | 'user';
//       })[]
//     | undefined;
// }>()('consumer.profile');

// export let consumerSessionType = PresentableType.create<{
//   consumerSession: ConsumerSession;
// }>()('consumer.session');

export let teamType = PresentableType.create<{
  team: Team & {
    organization: Organization;
    projects: (TeamProject & { project: Project })[];
    assignments: (TeamProjectRoleAssignment & {
      teamProject: TeamProject;
      teamRole: TeamRole;
      project: Project;
    })[];
  };
}>()('management.team');

export let teamRoleType = PresentableType.create<{
  teamRole: TeamRole & {
    organization: Organization;
  };
}>()('management.team.role');

export let teamRolePermissionsType = PresentableType.create<{
  permissions: {
    identifier: string;
    name: string;
    description: string;
    dependencies: string[];
  }[];
}>()('management.team.role_permissions');

// export let ssoTenantType = PresentableType.create<{
//   ssoTenant: SsoTenant;
// }>()('sso.tenant');

// export let ssoTenantSetupType = PresentableType.create<{
//   ssoTenantSetup: {
//     id: string;
//     status: 'pending' | 'completed';
//     tenantId: string;
//     connectionId: string | null | undefined;
//     clientSecret: string;
//     redirectUri: string;
//     url: string;
//     createdAt: NativeDate;
//     updatedAt: NativeDate;
//   };
// }>()('sso.tenant.setup');

// export let ssoUserType = PresentableType.create<{
//   ssoUser: SsoUser & {
//     profiles: SsoUserProfile[];
//     ssoTenant: SsoTenant;
//   };
// }>()('sso.user');

// export let ssoUserProfileType = PresentableType.create<{
//   ssoUserProfile: SsoUserProfile & {
//     ssoUser: SsoUser & {
//       ssoTenant: SsoTenant;
//     };
//   };
// }>()('sso.user_profile');

export let publisherType = PresentableType.create<{ publisher: SubspacePublisher }>()(
  'publisher'
);

export let providerVersionType = PresentableType.create<{
  version: SubspaceProviderVersion;
}>()('version');

export let providerType = PresentableType.create<{ provider: SubspaceProvider }>()('provider');

export let identityType = PresentableType.create<{
  identity: SubspaceIdentity;
}>()('identity');

export let identityActorType = PresentableType.create<{
  identityActor: SubspaceIdentityActor;
}>()('identity.actor');

export let identityCredentialType = PresentableType.create<{
  identityCredential: SubspaceIdentityCredential;
}>()('identity.credential');

export let identityDelegationType = PresentableType.create<{
  identityDelegation: SubspaceIdentityDelegation;
}>()('identity.delegation');

export let identityDelegationConfigType = PresentableType.create<{
  identityDelegationConfig: SubspaceIdentityDelegationConfig;
}>()('identity.delegation_config');

export let identityDelegationRequestType = PresentableType.create<{
  identityDelegationRequest: SubspaceIdentityDelegationRequest;
}>()('identity.delegation_request');

export let providerTypeType = PresentableType.create<{
  providerType: SubspaceProviderType;
}>()('provider.type');

export let providerListingCategoryType = PresentableType.create<{
  category: SubspaceProviderListingCategory;
}>()('category');

export let providerListingCollectionType = PresentableType.create<{
  collection: SubspaceProviderListingCollection;
}>()('collection');

export let providerListingGroupType = PresentableType.create<{
  group: SubspaceProviderListingGroup;
}>()('group');

export let providerListingType = PresentableType.create<{
  providerListing: SubspaceProviderListing;
}>()('providerListing');

export let providerToolType = PresentableType.create<{ tool: SubspaceProviderTool }>()('tool');

export let providerTriggerType = PresentableType.create<{
  trigger: SubspaceProviderTrigger;
}>()('provider.capabilities.trigger');

export let providerAuthMethodType = PresentableType.create<{
  authMethod: SubspaceProviderAuthMethod;
}>()('provider.capabilities.auth_method');

export let providerSpecificationType = PresentableType.create<{
  specification: SubspaceProviderSpecification;
}>()('specification');

export let deploymentPreviewType = PresentableType.create<{
  deployment: NonNullable<SubspaceProviderAuthConfig['deploymentPreview']>;
}>()('deploymentPreview');

export let configPreviewType = PresentableType.create<{
  config: NonNullable<SubspaceProviderDeployment['defaultConfig']>;
}>()('configPreview');

export let authConfigPreviewType = PresentableType.create<{
  authConfig: NonNullable<SubspaceCallbackInstance['authConfig']>;
}>()('configPreview');

export let providerDeploymentType = PresentableType.create<{
  deployment: SubspaceProviderDeployment;
}>()('deployment');

export let providerConfigVaultType = PresentableType.create<{
  configVault: SubspaceProviderConfigVault;
}>()('configVault');

export let providerConfigType = PresentableType.create<{ config: SubspaceProviderConfig }>()(
  'config'
);

export let providerAuthConfigType = PresentableType.create<{
  authConfig: SubspaceProviderAuthConfig;
}>()('provider.auth_config');

export let providerAuthCredentialsType = PresentableType.create<{
  authCredentials: SubspaceProviderAuthCredentials;
}>()('provider.auth_credentials');

export let providerSetupSessionType = PresentableType.create<{
  setupSession: SubspaceProviderSetupSession;
}>()('setupSession');

export let providerAuthImportType = PresentableType.create<{
  authImport: SubspaceProviderAuthImport;
}>()('authImport');

export let providerAuthExportType = PresentableType.create<{
  authExport: SubspaceProviderAuthExport;
  value?: Record<string, any>;
}>()('authExport');

export let sessionTemplateType = PresentableType.create<{
  sessionTemplate: SubspaceSessionTemplate;
}>()('sessionTemplate');

export let sessionTemplateProviderType = PresentableType.create<{
  sessionTemplateProvider: SubspaceSessionTemplateProvider;
}>()('sessionTemplateProvider');

export let sessionProviderType = PresentableType.create<{
  sessionProvider: SubspaceSessionProvider;
}>()('sessionProvider');

export let sessionParticipantType = PresentableType.create<{
  sessionParticipant: SubspaceSessionParticipant;
}>()('sessionParticipant');

export let sessionWarningType = PresentableType.create<{
  sessionWarning: SubspaceSessionWarning;
}>()('sessionWarning');

export let sessionErrorType = PresentableType.create<{
  sessionError: SubspaceSessionError;
}>()('sessionError');

export let sessionErrorGroupType = PresentableType.create<{
  sessionErrorGroup: SubspaceSessionErrorGroup;
}>()('sessionErrorGroup');

export let providerRunType = PresentableType.create<{
  providerRun: SubspaceProviderRun;
}>()('providerRun');

export let providerRunLogsType = PresentableType.create<{
  logs: SubspaceProviderRunLogs;
}>()('providerRunLogs');

export let providerSessionType = PresentableType.create<{
  session: SubspaceSession;
}>()('providerSession');

export let sessionMessageType = PresentableType.create<{
  sessionMessage: SubspaceSessionMessage;
}>()('subspaceSessionMessage');

export let sessionConnectionType = PresentableType.create<{
  sessionConnection: SubspaceSessionConnection;
}>()('subspaceSessionConnection');

export let sessionEventType = PresentableType.create<{
  sessionEvent: SubspaceSessionEvent;
}>()('subspaceSessionEvent');

export let configSchemaType = PresentableType.create<{
  schema: SubspaceProviderConfigSchema;
}>()('configSchema');

export let authImportSchemaType = PresentableType.create<{
  schema: SubspaceProviderAuthImportSchema;
}>()('authImportSchema');

export let authConfigSchemaType = PresentableType.create<{
  schema: SubspaceProviderAuthConfigSchema;
}>()('authConfigSchema');

export let customProviderType = PresentableType.create<{
  customProvider: SubspaceCustomProvider;
}>()('customProvider');

export let customProviderVersionType = PresentableType.create<{
  customProviderVersion: SubspaceCustomProviderVersion;
}>()('customProviderVersion');

export let customProviderDeploymentType = PresentableType.create<{
  customProviderDeployment: SubspaceCustomProviderDeployment;
}>()('customProviderDeployment');

export let customProviderDeploymentLogsType = PresentableType.create<{
  logs: SubspaceCustomProviderDeploymentLogs;
}>()('customProviderDeploymentLogs');

export let customProviderCommitType = PresentableType.create<{
  customProviderCommit: SubspaceCustomProviderCommit;
}>()('customProviderCommit');

export let customProviderEnvironmentType = PresentableType.create<{
  customProviderEnvironment: SubspaceCustomProviderEnvironment;
}>()('customProviderEnvironment');

export let bucketEditorTokenType = PresentableType.create<{
  token: {
    id: string;
    url: string;
    expiresAt: Date;
  };
}>()('bucketEditorToken');

export let bucketType = PresentableType.create<{
  bucket: SubspaceBucket;
}>()('bucket');

export let actorPreviewType = PresentableType.create<{
  actor: SubspaceCustomProviderCommit['actor'];
}>()('actorPreview');

export let scmPushType = PresentableType.create<{
  scmPush: NonNullable<SubspaceCustomProviderCommit['scmPush']>;
}>()('scmPush');

export let providerOAuthSetupType = PresentableType.create<{
  providerOAuthSetup: SubspaceProviderOAuthSetup;
}>()('providerOAuthSetup');

export let toolCallType = PresentableType.create<{
  toolCall: SubspaceToolCall;
}>()('toolCall');

export let scmConnectionType = PresentableType.create<{
  scmConnection: SubspaceScmConnection;
}>()('scmConnection');

export let scmConnectionSetupType = PresentableType.create<{
  scmConnectionSetup: SubspaceScmConnectionSetupSession;
}>()('scmConnectionSetup');

export let scmProviderType = PresentableType.create<{
  scmProvider: SubspaceScmProvider;
}>()('scmProvider');

export let scmProviderSetupType = PresentableType.create<{
  scmProviderSetup: SubspaceScmProviderSetupSession;
}>()('scmProviderSetup');

export let scmRepoType = PresentableType.create<{
  scmRepo: SubspaceScmRepository;
}>()('scmRepo');

export type ScmRepo = SubspaceScmRepository;

export let scmRepoPreviewType = PresentableType.create<{
  repoPreviews: SubspaceScmRepositoryPreviews;
}>()('scmRepoPreview');

export let scmAccountPreviewType = PresentableType.create<{
  accountPreviews: SubspaceScmAccountPreviews;
}>()('scmAccountPreview');
