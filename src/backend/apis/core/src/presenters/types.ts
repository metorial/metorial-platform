import {
  ApiKey,
  ApiKeySecret,
  File,
  FileLink,
  FilePurpose,
  Instance,
  MachineAccess,
  Organization,
  OrganizationActor,
  OrganizationInvite,
  OrganizationMember,
  Profile,
  Project,
  Secret,
  SecretType,
  Team,
  TeamMember,
  TeamProject,
  TeamProjectRoleAssignment,
  TeamRole,
  User
} from '@metorial/db';
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

// export let magicMcpServerType = PresentableType.create<{
//   magicMcpServer: MagicMcpServer & {
//     serverDeployment:
//       | (MagicMcpServerDeployment & {
//           serverDeployment: ServerDeployment & {
//             server: Server;
//           };
//         })
//       | null;
//     aliases: MagicMcpServerAlias[];
//     defaultServerOauthSession: ServerOAuthSession | null;
//   };
// }>()('magic_mcp.server');

// export let magicMcpSessionType = PresentableType.create<{
//   magicMcpSession: MagicMcpSession & {
//     session: Session & {
//       serverSessions: ServerSession[];
//     };
//     magicMcpServer: MagicMcpServer;
//   };
// }>()('magic_mcp.session');

// export let magicMcpTokenType = PresentableType.create<{
//   magicMcpToken: MagicMcpToken & {
//     groups: (MagicMcpGroupToken & {
//       magicMcpGroup: MagicMcpGroup;
//     })[];
//   };
// }>()('magic_mcp.token');

// export let magicMcpGroupType = PresentableType.create<{
//   magicMcpGroup: MagicMcpGroup;
// }>()('magic_mcp.group');

// export let callbackType = PresentableType.create<{
//   callback: Callback & {
//     hooks: CallbackHook[];
//     schedule: CallbackSchedule | null;
//   };
// }>()('callback');

// export let callbackEventType = PresentableType.create<{
//   callbackEvent: CallbackEvent & {
//     processingAttempts: CallbackEventProcessingAttempt[];
//   };
// }>()('callback.event');

// export let callbackDestinationType = PresentableType.create<{
//   callbackDestination: CallbackDestination & {
//     callbacks: (CallbackDestinationCallback & {
//       callback: Callback;
//     })[];
//   };
// }>()('callback.destination');

// export let callbackNotificationType = PresentableType.create<{
//   callbackNotification: CallbackNotification & {
//     destination: CallbackDestination;
//     event: CallbackEvent;
//     attempts: CallbackNotificationAttempt[];
//   };
// }>()('callback.notification');

// export let portalType = PresentableType.create<{
//   portal: Portal & {
//     surface: ConsumerSurface;
//   };
//   portalUrl: string;
// }>()('portal');

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
  permissions: string[];
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

export interface SubspacePublisher {
  id: string;
  name: string;
  description: string | null;
  slug?: string;
  identifier?: string;
  source: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubspaceVersion {
  id: string;
  tag?: string | null;
  identifier?: string | null;
  isCurrent?: boolean;
  createdAt: Date | null;
  updatedAt: Date;
}

export interface SubspaceProvider {
  id: string;
  name?: string | null;
  description?: string | null;
  slug?: string | null;
  tag?: string | null;
  identifier?: string | null;
  entry?: { name?: string | null; description?: string | null };
  publisher: SubspacePublisher;
  currentVersion?: SubspaceVersion | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubspaceCategory {
  id: string;
  name: string;
  description: string | null;
  slug?: string;
  identifier?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubspaceCollection {
  id: string;
  name: string;
  description: string | null;
  slug?: string;
  identifier?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubspaceGroup {
  id: string;
  name: string;
  description: string | null;
  slug?: string;
  identifier?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubspaceProviderListing {
  id: string;
  isPublic?: boolean;
  isCustomized?: boolean;
  isMetorial?: boolean;
  isVerified?: boolean;
  isOfficial?: boolean;
  name: string;
  description: string | null;
  slug?: string;
  identifier?: string;
  image?: Record<string, unknown> | null;
  source?: Record<string, unknown> | null;
  readme?: string | null;
  skills?: string[];
  rank?: number;
  deploymentsCount?: number;
  providerSessionsCount?: number;
  providerMessagesCount?: number;
  provider?: { id: string };
  categories?: SubspaceCategory[];
  collections?: SubspaceCollection[];
  groups?: SubspaceGroup[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SubspaceAuthMethodScope {
  id: string;
  scope: string;
  name?: string;
  title?: string;
  description: string | null;
}

export interface SubspaceTool {
  id: string;
  name: string;
  title?: string | null;
  description: string | null;
  inputSchema?: Record<string, unknown> | null;
  inputJsonSchema?: Record<string, unknown> | null;
  outputSchema?: Record<string, unknown> | null;
  outputJsonSchema?: Record<string, unknown> | null;
  providerId?: string;
  providerSpecificationId?: string;
  specificationId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubspaceAuthMethod {
  id: string;
  type: string;
  name: string;
  description: string | null;
  inputSchema?: Record<string, unknown> | null;
  inputJsonSchema?: Record<string, unknown> | null;
  scopes?: SubspaceAuthMethodScope[] | null;
  providerId?: string;
  providerSpecificationId?: string;
  specificationId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubspaceSpecification {
  id: string;
  name: string;
  description: string | null;
  configSchema?: Record<string, unknown> | null;
  configJsonSchema?: Record<string, unknown> | null;
  tools?: SubspaceTool[];
  authMethods?: SubspaceAuthMethod[];
  providerId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubspaceConfig {
  id: string;
  isEphemeral?: boolean;
  isDefault?: boolean;
  name: string | null;
  description: string | null;
  metadata?: unknown;
  providerId: string;
  providerDeploymentId?: string | null;
  deploymentId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubspaceDeployment {
  id: string;
  isEphemeral?: boolean;
  isDefault?: boolean;
  name: string | null;
  description: string | null;
  metadata?: unknown;
  providerId: string;
  provider?: {
    id: string;
    name: string;
    slug?: string;
    identifier?: string;
    description?: string | null;
    tag?: string;
    metadata?: Record<string, unknown> | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  lockedVersion?: SubspaceVersion | null;
  defaultConfig?: SubspaceConfig | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubspaceConfigVault {
  id: string;
  name: string | null;
  description: string | null;
  metadata?: unknown;
  providerId: string;
  providerDeploymentId?: string | null;
  deploymentId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubspaceAuthConfig {
  id: string;
  isEphemeral?: boolean;
  type?: string;
  status?: string;
  name: string | null;
  description: string | null;
  metadata?: unknown;
  providerId: string;
  providerDeploymentId?: string | null;
  deploymentId?: string | null;
  providerAuthMethodId?: string;
  authMethodId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubspaceAuthCredentials {
  id: string;
  type?: string;
  name: string | null;
  description: string | null;
  metadata?: unknown;
  providerId: string;
  clientId?: string | null;
  scopes?: SubspaceAuthMethodScope[] | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubspaceSetupSession {
  id: string;
  type?: string;
  status?: string;
  name: string | null;
  description: string | null;
  metadata?: unknown;
  providerId: string;
  providerDeploymentId?: string | null;
  deploymentId?: string | null;
  providerAuthMethodId?: string;
  authMethodId?: string;
  uiMode?: string | null;
  redirectUrl?: string | null;
  setupUrl?: string | null;
  url?: string | null;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date | null;
  authConfig?: SubspaceAuthConfig | null;
}

export interface SubspaceAuthImport {
  id: string;
  note: string | null;
  metadata?: unknown;
  providerId?: string | null;
  providerDeploymentId?: string | null;
  deploymentId?: string | null;
  providerAuthConfigId?: string | null;
  authConfigId?: string | null;
  providerAuthMethodId?: string | null;
  authMethodId?: string | null;
  createdAt: Date;
}

export interface SubspaceAuthExport {
  id: string;
  note: string | null;
  metadata?: unknown;
  providerAuthConfigId?: string;
  authConfigId?: string;
  value?: Record<string, unknown>;
  createdAt: Date;
}

export let publisherType = PresentableType.create<{ publisher: SubspacePublisher }>()(
  'publisher'
);

export let versionType = PresentableType.create<{ version: SubspaceVersion }>()('version');

export let providerType = PresentableType.create<{ provider: SubspaceProvider }>()('provider');

export let categoryType = PresentableType.create<{ category: SubspaceCategory }>()('category');

export let collectionType = PresentableType.create<{ collection: SubspaceCollection }>()(
  'collection'
);

export let groupType = PresentableType.create<{ group: SubspaceGroup }>()('group');

export let providerListingType = PresentableType.create<{
  providerListing: SubspaceProviderListing;
}>()('providerListing');

export let toolType = PresentableType.create<{ tool: SubspaceTool }>()('tool');

export let authMethodType = PresentableType.create<{ authMethod: SubspaceAuthMethod }>()(
  'authMethod'
);

export let specificationType = PresentableType.create<{
  specification: SubspaceSpecification;
}>()('specification');

export let deploymentPreviewType = PresentableType.create<{
  deployment: SubspaceDeployment;
}>()('deploymentPreview');

export let configPreviewType = PresentableType.create<{
  config: SubspaceConfig;
}>()('configPreview');

export let deploymentType = PresentableType.create<{ deployment: SubspaceDeployment }>()(
  'deployment'
);

export let configVaultType = PresentableType.create<{ configVault: SubspaceConfigVault }>()(
  'configVault'
);

export let configType = PresentableType.create<{ config: SubspaceConfig }>()('config');

export let authConfigType = PresentableType.create<{ authConfig: SubspaceAuthConfig }>()(
  'authConfig'
);

export let authCredentialsType = PresentableType.create<{
  authCredentials: SubspaceAuthCredentials;
}>()('authCredentials');

export let setupSessionType = PresentableType.create<{ setupSession: SubspaceSetupSession }>()(
  'setupSession'
);

export let authImportType = PresentableType.create<{ authImport: SubspaceAuthImport }>()(
  'authImport'
);

export let authExportType = PresentableType.create<{ authExport: SubspaceAuthExport }>()(
  'authExport'
);

export interface SubspaceSessionTemplate {
  id: string;
  name: string | null;
  description: string | null;
  metadata?: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubspaceSessionTemplateProvider {
  id: string;
  name?: string | null;
  description?: string | null;
  metadata?: unknown;
  sessionTemplateId: string;
  providerId: string;
  providerDeploymentId?: string | null;
  deployment?: {
    id: string;
    name?: string | null;
    provider?: { name?: string | null };
  } | null;
  config?: { name?: string | null } | null;
  authConfig?: { name?: string | null } | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubspaceSessionProvider {
  id: string;
  name?: string | null;
  description?: string | null;
  status: string | null;
  metadata?: unknown;
  sessionId: string;
  providerId: string;
  providerDeploymentId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubspaceSessionParticipant {
  id: string;
  type: string | null;
  name: string | null;
  description?: string | null;
  metadata?: unknown;
  sessionId?: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface SubspaceSessionError {
  id: string;
  type?: string | null;
  name?: string | null;
  message: string | null;
  stack?: string | null;
  metadata?: unknown;
  sessionId: string;
  sessionErrorGroupId?: string | null;
  providerRunId: string | null;
  createdAt: Date;
}

export interface SubspaceSessionErrorGroup {
  id: string;
  type?: string | null;
  name?: string | null;
  message: string | null;
  count?: number;
  metadata?: unknown;
  sessionId?: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface SubspaceProviderRun {
  id: string;
  status: string | null;
  name?: string | null;
  description?: string | null;
  metadata?: unknown;
  sessionId: string;
  sessionProviderId: string | null;
  providerId: string | null;
  providerDeploymentId?: string | null;
  providerVersionId?: string | null;
  startedAt?: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

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

export let sessionErrorType = PresentableType.create<{
  sessionError: SubspaceSessionError;
}>()('sessionError');

export let sessionErrorGroupType = PresentableType.create<{
  sessionErrorGroup: SubspaceSessionErrorGroup;
}>()('sessionErrorGroup');

export let providerRunType = PresentableType.create<{
  providerRun: SubspaceProviderRun;
}>()('providerRun');

export interface SubspaceSessionProvider {
  id: string;
  status: string | null;
  providerId: string;
  sessionId: string;
  deployment?: {
    id: string;
    name: string | null;
    providerId: string;
    provider?: { id: string; name: string } | null;
  } | null;
  usage?: {
    totalProductiveClientMessageCount: number;
    totalProductiveServerMessageCount: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface SubspaceSession {
  id: string;
  name: string | null;
  description: string | null;
  connectionState: string | null;
  metadata?: unknown;
  usage?: {
    totalProductiveClientMessageCount: number;
    totalProductiveServerMessageCount: number;
  };
  providers?: SubspaceSessionProvider[];
  connectionUrl?: string;
  connectionKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

export let providerSessionType = PresentableType.create<{
  session: SubspaceSession;
}>()('providerSession');

export interface SubspaceSessionMessage {
  id: string;
  type: string | null;
  source: string | null;
  status?: string | null;
  sessionId: string;
  sessionProviderId: string | null;
  connectionId: string | null;
  providerRunId: string | null;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  transport?: {
    type: string;
    mcp?: {
      id: string;
      protocolVersion: string;
      transport: string;
    };
  } | null;
  senderParticipant?: {
    id: string;
    type: string | null;
    name: string | null;
    provider?: { id: string } | null;
  } | null;
  createdAt: Date;
}

export interface SubspaceSessionConnection {
  id: string;
  status: string | null;
  connectionState: string | null;
  mcpVersion?: string | null;
  mcpConnectionType?: string | null;
  clientInfo?: Record<string, unknown> | null;
  serverInfo?: Record<string, unknown> | null;
  clientCapabilities?: Record<string, unknown> | null;
  serverCapabilities?: Record<string, unknown> | null;
  metadata?: unknown;
  sessionId?: string;
  sessionProviderId?: string | null;
  startedAt?: Date | null;
  endedAt?: Date | null;
  createdAt: Date;
  updatedAt?: Date;
}

export interface SubspaceSessionEvent {
  id: string;
  type: string | null;
  name?: string | null;
  message?: string | null;
  data?: Record<string, unknown> | null;
  metadata?: unknown;
  sessionId: string;
  sessionProviderId?: string | null;
  providerRunId?: string | null;
  createdAt: Date;
}

export interface SubspaceProviderRunLogs {
  logs: Array<{
    timestamp?: Date | null;
    message: string;
    outputType: string;
  }>;
}

export interface SubspaceConfigSchema {
  schema: Record<string, unknown> | null;
}

export interface SubspaceAuthImportSchema {
  schema: Record<string, unknown> | null;
}

export let subspaceSessionMessageType = PresentableType.create<{
  sessionMessage: SubspaceSessionMessage;
}>()('subspaceSessionMessage');

export let subspaceSessionConnectionType = PresentableType.create<{
  sessionConnection: SubspaceSessionConnection;
}>()('subspaceSessionConnection');

export let subspaceSessionEventType = PresentableType.create<{
  sessionEvent: SubspaceSessionEvent;
}>()('subspaceSessionEvent');

export let providerRunLogsType = PresentableType.create<{
  logs: SubspaceProviderRunLogs;
}>()('providerRunLogs');

export let configSchemaType = PresentableType.create<{
  schema: SubspaceConfigSchema;
}>()('configSchema');

export let authImportSchemaType = PresentableType.create<{
  schema: SubspaceAuthImportSchema;
}>()('authImportSchema');

// =============================================================================
// Custom Provider Types
// =============================================================================

export interface SubspaceCustomProviderActor {
  id: string;
  name: string | null;
  type: string | null;
  organizationActorId: string | null;
}

export interface SubspaceCustomProvider {
  id: string;
  status: string | null;
  name: string | null;
  description: string | null;
  metadata?: unknown;
  provider?: SubspaceProvider | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubspaceCustomProviderDeploymentCommit {
  id: string;
  type: string | null;
  message: string | null;
  createdAt: Date;
}

export interface SubspaceCustomProviderDeployment {
  id: string;
  status: string | null;
  trigger: string | null;
  customProviderId: string;
  providerId?: string | null;
  customProviderVersionId?: string | null;
  commit?: SubspaceCustomProviderDeploymentCommit | null;
  actor?: SubspaceCustomProviderActor | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubspaceCustomProviderEnvironmentNested {
  id: string;
  isCurrentVersionForEnvironment?: boolean;
  environment: SubspaceCustomProviderEnvironment;
}

export interface SubspaceCustomProviderVersion {
  id: string;
  status: string | null;
  index?: number | null;
  identifier?: string | null;
  deployment?: SubspaceCustomProviderDeployment | null;
  environments?: SubspaceCustomProviderEnvironmentNested[];
  customProviderId: string;
  providerId?: string | null;
  actor?: SubspaceCustomProviderActor | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubspaceCustomProviderDeploymentLogs {
  logs?: Array<{
    type: string;
    line: string;
    timestamp?: Date | null;
  }>;
  steps?: Array<{
    id?: string | null;
    type?: string | null;
    status?: string | null;
    source?: {
      provider?: string | null;
      workflowRunId?: string | null;
      workflowId?: string | null;
      functionDeploymentId?: string | null;
    } | null;
    logs?: Array<{ type: string; line: string; timestamp?: Date | null }>;
    createdAt?: Date | null;
  }>;
}

export interface SubspaceCustomProviderCommitError {
  code: string;
  message: string;
}

export interface SubspaceCustomProviderCommit {
  id: string;
  status: string | null;
  trigger: string | null;
  error?: SubspaceCustomProviderCommitError | null;
  customProviderId: string;
  providerId?: string | null;
  customProviderDeploymentId?: string | null;
  toEnvironment?: SubspaceCustomProviderEnvironment | null;
  fromEnvironment?: SubspaceCustomProviderEnvironment | null;
  targetCustomProviderVersion?: SubspaceCustomProviderVersion | null;
  previousCustomProviderVersion?: SubspaceCustomProviderVersion | null;
  actor?: SubspaceCustomProviderActor | null;
  createdAt: Date;
  appliedAt?: Date | null;
}

export interface SubspaceCustomProviderEnvironment {
  id: string;
  customProviderId: string;
  providerId?: string | null;
  currentProviderVersionId?: string | null;
  instanceId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubspaceProviderOAuthSetupAuthConfig {
  id: string;
  status?: string | null;
  type?: string | null;
  name: string | null;
  description: string | null;
  metadata?: unknown;
  providerId: string;
  providerDeploymentId?: string | null;
  providerAuthMethodId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubspaceProviderOAuthSetupCredentials {
  id: string;
  type?: string | null;
  name: string | null;
  description: string | null;
  metadata?: unknown;
  providerId: string;
  clientId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubspaceProviderOAuthSetupDeployment {
  id: string;
  name: string | null;
  providerId: string;
}

export interface SubspaceProviderOAuthSetup {
  id: string;
  status: string | null;
  isEphemeral?: boolean;
  providerId: string;
  name: string | null;
  description: string | null;
  metadata?: unknown;
  redirectUrl?: string | null;
  url?: string | null;
  authConfig?: SubspaceProviderOAuthSetupAuthConfig | null;
  credentials?: SubspaceProviderOAuthSetupCredentials | null;
  authMethod?: SubspaceAuthMethod | null;
  deployment?: SubspaceProviderOAuthSetupDeployment | null;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date | null;
}

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

export let customServerCodeEditorTokenType = PresentableType.create<{
  id: string;
  token: string;
  expiresAt: Date;
}>()('customServerCodeEditorToken');

export let providerOAuthSetupType = PresentableType.create<{
  providerOAuthSetup: SubspaceProviderOAuthSetup;
}>()('providerOAuthSetup');

export interface ScmInstallation {
  id: string;
  provider: string;
  externalAccountId: string;
  externalAccountLogin: string;
  externalAccountName: string | null;
  externalAccountImageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export let scmInstallationType = PresentableType.create<{
  scmInstallation: ScmInstallation;
}>()('scmInstallation');

export let scmInstallationSetupType = PresentableType.create<{
  url: string;
  id: string;
}>()('scmInstallationSetup');

export interface ScmRepoPreview {
  provider: string;
  externalId: string;
  name: string;
  identifier: string;
  lastPushedAt?: Date | null;
  account?: { externalId: string; name: string; identifier: string; provider: string };
}

export let scmRepoPreviewType = PresentableType.create<{
  repoPreview: ScmRepoPreview;
}>()('scmRepoPreview');

export interface ScmRepo {
  id: string;
  provider: { type: string; id: string; name: string; owner: string };
  url: string;
  isPrivate: boolean;
  defaultBranch: string;
  createdAt: Date;
}

export let scmRepoType = PresentableType.create<{
  scmRepo: ScmRepo;
}>()('scmRepo');

export interface ScmAccountPreview {
  provider: string;
  externalId: string;
  name: string;
  identifier: string;
}

export let scmAccountPreviewType = PresentableType.create<{
  accountPreview: ScmAccountPreview;
}>()('scmAccountPreview');
