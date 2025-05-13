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
  MachineAccess,
  Organization,
  OrganizationActor,
  OrganizationInvite,
  OrganizationMember,
  Project,
  Secret,
  SecretType,
  Server,
  ServerConfig,
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
      currentVersion: (ServerVersion & { config: ServerConfig }) | null;
    })[];
  };
}>()('server');

export let serverListingCategoryType = PresentableType.create<{
  category: ServerListingCategory;
}>()('server_listing_category');

export let serverListingCollectionType = PresentableType.create<{
  collection: ServerListingCollection;
}>()('server_listing_collection');

export let serverVariantType = PresentableType.create<{
  serverVariant: ServerVariant & {
    currentVersion: (ServerVersion & { config: ServerConfig }) | null;
    server: Server;
  };
}>()('server_variant');

export let serverVersionType = PresentableType.create<{
  serverVersion: ServerVersion & {
    server: Server;
    serverVariant: ServerVariant;
    config: ServerConfig;
  };
}>()('server_version');

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
    };
  };
}>()('server_listing');
