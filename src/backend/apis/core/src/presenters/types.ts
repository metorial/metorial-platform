import {
  ApiKey,
  ApiKeySecret,
  CustomServer,
  CustomServerEnvironment,
  CustomServerVersion,
  File,
  FileLink,
  FilePurpose,
  ImportedRepository,
  ImportedServer,
  ImportedServerVendor,
  Instance,
  InstanceServer,
  MachineAccess,
  Organization,
  OrganizationActor,
  OrganizationInvite,
  OrganizationMember,
  Profile,
  Project,
  ProviderOAuthConnection,
  ProviderOAuthConnectionAuthAttempt,
  ProviderOAuthConnectionEvent,
  ProviderOAuthConnectionProfile,
  ProviderOAuthConnectionTemplate,
  ProviderOAuthDiscoveryDocument,
  RemoteServerInstance,
  RemoteServerInstanceNotification,
  Secret,
  SecretType,
  Server,
  ServerConfigSchema,
  ServerDeployment,
  ServerDeploymentConfig,
  ServerImplementation,
  ServerListing,
  ServerListingCategory,
  ServerListingCollection,
  ServerRun,
  ServerRunError,
  ServerRunErrorGroup,
  ServerSession,
  ServerVariant,
  ServerVersion,
  Session,
  SessionConnection,
  SessionEvent,
  SessionMessage,
  User
} from '@metorial/db';
import { ServerCapabilities } from '@metorial/module-catalog';
import { PresentableType } from '@metorial/presenter';

export let bootType = PresentableType.create<{
  user: User;
  organizations: (Organization & {
    member: OrganizationMember & { actor: OrganizationActor };
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
    actor: OrganizationActor;
    user: User;
  };
}>()('organization_member');

export let organizationActorType = PresentableType.create<{
  organizationActor: OrganizationActor & {
    organization: Organization;
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

export let serverType = PresentableType.create<{
  server: Server & {
    importedServer: ImportedServer | null;
    variants: (ServerVariant & {
      currentVersion: (ServerVersion & { schema: ServerConfigSchema }) | null;
    })[];
  };
}>()('server');

export let serverListingCategoryType = PresentableType.create<{
  category: ServerListingCategory;
}>()('server_listing.category');

export let serverListingCollectionType = PresentableType.create<{
  collection: ServerListingCollection;
}>()('server_listing.collection');

export let serverVariantType = PresentableType.create<{
  serverVariant: ServerVariant & {
    currentVersion: (ServerVersion & { schema: ServerConfigSchema }) | null;
    server: Server;
  };
}>()('server.server_variant');

export let serverVersionType = PresentableType.create<{
  serverVersion: ServerVersion & {
    server: Server;
    serverVariant: ServerVariant;
    schema: ServerConfigSchema;
  };
}>()('server.server_version');

export let serverListingType = PresentableType.create<{
  serverListing: Omit<ServerListing, 'readme'> & {
    categories: ServerListingCategory[];
    server: Server & {
      importedServer:
        | (ImportedServer & {
            vendor: ImportedServerVendor;
            repository: ImportedRepository | null;
          })
        | null;

      instanceServers?: (InstanceServer & { instance: Instance })[];
    };
  };
  readme?: string | null;
}>()('server_listing');

export let serverImplementationType = PresentableType.create<{
  serverImplementation: ServerImplementation & {
    server: Server;
    serverVariant: ServerVariant;
  };
}>()('server.server_implementation');

export let serverDeploymentType = PresentableType.create<{
  serverDeployment: ServerDeployment & {
    serverImplementation: ServerImplementation & {
      server: Server;
      serverVariant: ServerVariant;
    };
    server: Server;
    config: ServerDeploymentConfig & {
      configSecret: Secret;
    };
  };
}>()('server.server_deployment');

export let serverDeploymentPreviewType = PresentableType.create<{
  serverDeployment: ServerDeployment & {
    server: Server;
  };
}>()('server.server_deployment#preview');

export let serverDeploymentConfigType = PresentableType.create<{
  config: ServerDeploymentConfig & {
    configSecret: Secret;
  };
}>()('server.server_deployment.config');

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

export let sessionType = PresentableType.create<{
  session: Session & {
    serverDeployments: (ServerDeployment & {
      server: Server;
    })[];

    serverSessions: ServerSession[];
  };
}>()('session');

export let serverSessionType = PresentableType.create<{
  session: Session;
  serverSession: ServerSession & {
    serverDeployment: ServerDeployment & {
      serverVariant: ServerVariant;
      server: Server;
    };
    sessionConnection: SessionConnection | null;
  };
}>()('session.server_session');

export let sessionConnectionType = PresentableType.create<{
  session: Session;
  sessionConnection: SessionConnection & {
    serverSession: ServerSession & {
      serverDeployment: ServerDeployment & {
        serverVariant: ServerVariant;
        server: Server;
      };
    };
  };
}>()('session.session_connection');

export let sessionMessageType = PresentableType.create<{
  session: Session;
  sessionMessage: SessionMessage & {
    serverSession: ServerSession;
  };
}>()('session.message');

export let sessionEventType = PresentableType.create<{
  session: Session;
  sessionEvent: SessionEvent & {
    serverRun:
      | (ServerRun & {
          serverVersion: ServerVersion;
          serverDeployment: ServerDeployment & { server: Server };
          serverSession: ServerSession;
        })
      | null;

    serverRunError:
      | (ServerRunError & {
          serverRun: ServerRun & {
            serverVersion: ServerVersion;
            serverDeployment: ServerDeployment & { server: Server };
            serverSession: ServerSession;
          };
        })
      | null;
  };
}>()('session.event');

export let serverRunType = PresentableType.create<{
  serverRun: ServerRun & {
    serverVersion: ServerVersion;
    serverDeployment: ServerDeployment & { server: Server };
    serverSession: ServerSession & { session: Session };
  };
}>()('server.server_run');

export let serverRunErrorType = PresentableType.create<{
  serverRunError: ServerRunError & {
    serverRun: ServerRun & {
      serverVersion: ServerVersion;
      serverDeployment: ServerDeployment & { server: Server };
      serverSession: ServerSession & { session: Session };
    };
  };
}>()('server.server_run.error');

export let serverRunErrorGroupType = PresentableType.create<{
  serverRunErrorGroup: ServerRunErrorGroup & {
    defaultServerRunError:
      | (ServerRunError & {
          serverRun: ServerRun & {
            serverVersion: ServerVersion;
            serverDeployment: ServerDeployment & { server: Server };
            serverSession: ServerSession & { session: Session };
          };
        })
      | null;
  };
}>()('server.server_run.error_group');

export let serverCapabilitiesType = PresentableType.create<{
  serverCapabilities: ServerCapabilities[];
}>()('server.capabilities');

export let profileType = PresentableType.create<{
  profile: Profile;
}>()('profile');

export let providerOauthConnectionType = PresentableType.create<{
  providerOauthConnection: ProviderOAuthConnection & {
    instance: Instance;
    template: ProviderOAuthConnectionTemplate | null;
  };
}>()('provider_oauth.connection');

export let providerOauthConnectionTemplateType = PresentableType.create<{
  providerOauthConnectionTemplate: ProviderOAuthConnectionTemplate & {
    profile: Profile;
  };
}>()('provider_oauth.connection_template');

export let providerOauthConnectionTemplateEvaluationType = PresentableType.create<{
  providerOauthConnectionTemplate: ProviderOAuthConnectionTemplate & {
    profile: Profile;
  };
  input: Record<string, any>;
  output: Record<string, any>;
}>()('provider_oauth.connection_template.evaluation');

export let providerOauthConnectionEventType = PresentableType.create<{
  providerOauthConnectionEvent: ProviderOAuthConnectionEvent & {
    connection: ProviderOAuthConnection;
  };
}>()('provider_oauth.connection.event');

export let providerOauthConnectionProfileType = PresentableType.create<{
  providerOauthConnectionProfile: ProviderOAuthConnectionProfile & {
    connection: ProviderOAuthConnection;
  };
}>()('provider_oauth.connection.profile');

export let providerOauthConnectionAuthenticationType = PresentableType.create<{
  providerOauthConnectionAuthAttempt: ProviderOAuthConnectionAuthAttempt & {
    connection: ProviderOAuthConnection;
    profile: ProviderOAuthConnectionProfile | null;
  };
}>()('provider_oauth.connection.authentication');

export let providerOauthConnectionDiscoveryType = PresentableType.create<{
  providerOauthDiscoveryDocument: ProviderOAuthDiscoveryDocument;
}>()('provider_oauth.discovery');

export let remoteServerType = PresentableType.create<{
  remoteServerInstance: RemoteServerInstance & {
    connection: ProviderOAuthConnection | null;
  };
}>()('custom_server.remote_server');

export let remoteServerNotificationType = PresentableType.create<{
  remoteServerInstanceNotification: RemoteServerInstanceNotification & {
    remoteServerInstance: RemoteServerInstance;
  };
}>()('custom_server.remote_server.notification');

export let customServerType = PresentableType.create<{
  customServer: CustomServer & {
    server: Server;
    environments: (CustomServerEnvironment & {
      customServer: CustomServer;
      instance: Instance;
      serverVariant: ServerVariant;
      currentVersion: CustomServerVersion | null;
    })[];
  };
}>()('custom_server');

export let customServerEnvironmentType = PresentableType.create<{
  customServerEnvironment: CustomServerEnvironment & {
    customServer: CustomServer;
    instance: Instance;
    serverVariant: ServerVariant;
    currentVersion: CustomServerVersion | null;
  };
  server: Server;
}>()('custom_server.environment');

export let customServerVersionType = PresentableType.create<{
  customServerVersion: CustomServerVersion & {
    customServer: CustomServer & {
      server: Server;
    };
    environment: CustomServerEnvironment & {
      serverVariant: ServerVariant;
    };
    instance: Instance;
    serverVersion: ServerVersion;
    currentVersionForServer: CustomServerEnvironment | null;
    remoteServerInstance:
      | (RemoteServerInstance & {
          connection: ProviderOAuthConnection | null;
        })
      | null;
  };
}>()('custom_server.version');
