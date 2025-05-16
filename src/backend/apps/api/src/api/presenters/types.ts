import {
  ApiKey,
  ApiKeySecret,
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
  Project,
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
  ServerVariant,
  ServerVersion,
  User
} from '@metorial/db';
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
  serverListing: ServerListing & {
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
