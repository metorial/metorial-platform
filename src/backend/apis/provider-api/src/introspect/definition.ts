interface IntrospectedType {
  examples: any[];
  items?: IntrospectedType[];
  properties?: Record<string, IntrospectedType>;
  type: string;
  name?: string;
  description?: string;
  optional: boolean;
  nullable: boolean;
}

interface Controller {
  id: string;
  name: string;
  description: string;
}

interface Endpoint {
  id: string;
  controllerId: string;
  path: string;
  allPaths: { path: string; sdkPath: string }[];
  method: string;
  name: string;
  description: string;
  bodyId: string | null;
  queryId: string | null;
  outputId: string;
  hideInDocs?: boolean;
}

interface ApiType {
  id: string;
  name: string;
  type: IntrospectedType;
}

// Helper functions to create types
let str = (
  opts: { optional?: boolean; nullable?: boolean; description?: string; examples?: string[] } = {}
): IntrospectedType => ({
  type: 'string',
  examples: opts.examples || [],
  optional: opts.optional ?? false,
  nullable: opts.nullable ?? false,
  description: opts.description
});

let num = (
  opts: { optional?: boolean; nullable?: boolean; description?: string; examples?: number[] } = {}
): IntrospectedType => ({
  type: 'number',
  examples: opts.examples || [],
  optional: opts.optional ?? false,
  nullable: opts.nullable ?? false,
  description: opts.description
});

let bool = (
  opts: { optional?: boolean; nullable?: boolean; description?: string; examples?: boolean[] } = {}
): IntrospectedType => ({
  type: 'boolean',
  examples: opts.examples || [],
  optional: opts.optional ?? false,
  nullable: opts.nullable ?? false,
  description: opts.description
});

let date = (
  opts: { optional?: boolean; nullable?: boolean; description?: string; examples?: string[] } = {}
): IntrospectedType => ({
  type: 'datetime',
  examples: opts.examples || [],
  optional: opts.optional ?? false,
  nullable: opts.nullable ?? false,
  description: opts.description
});

let obj = (
  properties: Record<string, IntrospectedType>,
  opts: { optional?: boolean; nullable?: boolean; description?: string; examples?: object[] } = {}
): IntrospectedType => ({
  type: 'object',
  examples: opts.examples || [],
  properties,
  optional: opts.optional ?? false,
  nullable: opts.nullable ?? false,
  description: opts.description
});

let arr = (
  items: IntrospectedType,
  opts: { optional?: boolean; nullable?: boolean; description?: string; examples?: any[][] } = {}
): IntrospectedType => ({
  type: 'array',
  examples: opts.examples || [],
  items: [items],
  optional: opts.optional ?? false,
  nullable: opts.nullable ?? false,
  description: opts.description
});

let record = (
  opts: { optional?: boolean; nullable?: boolean; description?: string; examples?: object[] } = {}
): IntrospectedType => ({
  type: 'record',
  examples: opts.examples || [],
  optional: opts.optional ?? false,
  nullable: opts.nullable ?? false,
  description: opts.description || 'A key-value map'
});

let enumType = (
  values: string[],
  opts: { optional?: boolean; nullable?: boolean; description?: string } = {}
): IntrospectedType => ({
  type: 'enum',
  examples: values,
  optional: opts.optional ?? false,
  nullable: opts.nullable ?? false,
  description: opts.description
});

let union = (
  items: IntrospectedType[],
  opts: { optional?: boolean; nullable?: boolean; description?: string } = {}
): IntrospectedType => ({
  type: 'union',
  examples: [],
  items,
  optional: opts.optional ?? false,
  nullable: opts.nullable ?? false,
  description: opts.description
});

// Common types
let paginatorQuery: IntrospectedType = obj({
  limit: str({ optional: true, description: 'Maximum number of items to return (1-100)', examples: ['20'] }),
  after: str({ optional: true, description: 'Cursor for pagination - return items after this ID', examples: ['prov_abc123def456'] }),
  before: str({ optional: true, description: 'Cursor for pagination - return items before this ID', examples: ['prov_xyz789ghi012'] }),
  order: enumType(['asc', 'desc'], { optional: true, description: 'Sort order' })
});

let paginatedList = (itemType: IntrospectedType): IntrospectedType =>
  obj({
    object: str({ description: 'Always "list"' }),
    data: arr(itemType, { description: 'Array of items' }),
    hasMore: bool({ description: 'Whether there are more items available' })
  });

let deletedResponse = (objectType: string): IntrospectedType =>
  obj({
    id: str({ description: 'ID of the deleted object' }),
    object: str({ description: `Always "${objectType}"` }),
    deleted: bool({ description: 'Always true' })
  });

// Define all types
let types: ApiType[] = [];
let typeIndex = 0;

let addType = (name: string, type: IntrospectedType): string => {
  let id = `type_${typeIndex++}`;
  types.push({ id, name, type });
  return id;
};

// Common presenter types
let publisherType = obj({
  object: str({ description: 'Object type identifier', examples: ['publisher'] }),
  id: str({ description: 'Unique publisher identifier', examples: ['pub_abc123def456'] }),
  name: str({ description: 'Display name of the publisher', examples: ['Acme Corp', 'GitHub Inc'] }),
  description: str({ nullable: true, description: 'Brief description of the publisher and what they offer' }),
  slug: str({ description: 'URL-friendly identifier used in paths', examples: ['acme-corp', 'github-inc'] }),
  image: record({ nullable: true, description: 'Publisher logo/image metadata including URL and dimensions' }),
  createdAt: date({ description: 'Timestamp when the publisher was created', examples: ['2024-01-15T10:30:00Z'] }),
  updatedAt: date({ description: 'Timestamp when the publisher was last updated', examples: ['2024-06-20T14:45:00Z'] })
});

let categoryType = obj({
  object: str({ description: 'Object type identifier', examples: ['provider.category'] }),
  id: str({ description: 'Unique category identifier', examples: ['cat_abc123def456'] }),
  name: str({ description: 'Display name of the category', examples: ['Developer Tools', 'Data & Analytics', 'Communication'] }),
  description: str({ nullable: true, description: 'Description of what providers in this category do' }),
  slug: str({ description: 'URL-friendly identifier', examples: ['developer-tools', 'data-analytics'] }),
  createdAt: date({ description: 'Timestamp when the category was created' }),
  updatedAt: date({ description: 'Timestamp when the category was last updated' })
});

let collectionType = obj({
  object: str({ description: 'Object type identifier', examples: ['provider.collection'] }),
  id: str({ description: 'Unique collection identifier', examples: ['col_abc123def456'] }),
  name: str({ description: 'Display name of the collection', examples: ['Featured Providers', 'New Arrivals', 'Most Popular'] }),
  description: str({ nullable: true, description: 'Description of the collection and its purpose' }),
  slug: str({ description: 'URL-friendly identifier', examples: ['featured', 'new-arrivals', 'most-popular'] }),
  createdAt: date({ description: 'Timestamp when the collection was created' }),
  updatedAt: date({ description: 'Timestamp when the collection was last updated' })
});

let groupType = obj({
  object: str({ description: 'Object type identifier', examples: ['provider.group'] }),
  id: str({ description: 'Unique group identifier', examples: ['grp_abc123def456'] }),
  name: str({ description: 'Display name of the user-defined group', examples: ['My Favorites', 'Production Tools', 'Testing'] }),
  description: str({ nullable: true, description: 'Description of the group and its purpose' }),
  slug: str({ description: 'URL-friendly identifier', examples: ['my-favorites', 'production-tools'] }),
  createdAt: date({ description: 'Timestamp when the group was created' }),
  updatedAt: date({ description: 'Timestamp when the group was last updated' })
});

let versionType = obj({
  object: str({ description: 'Object type identifier', examples: ['provider.version'] }),
  id: str({ description: 'Unique version identifier', examples: ['ver_abc123def456'] }),
  version: str({ description: 'Semantic version string', examples: ['1.0.0', '2.1.3', '0.5.0-beta'] }),
  status: str({ description: 'Version status', examples: ['released', 'draft', 'deprecated'] }),
  releasedAt: date({ nullable: true, description: 'Timestamp when this version was released' }),
  createdAt: date({ description: 'Timestamp when the version was created' }),
  updatedAt: date({ description: 'Timestamp when the version was last updated' })
});

let specificationMetaType = obj({
  object: str({ description: 'Object type identifier', examples: ['provider.specification'] }),
  id: str({ description: 'Unique specification identifier', examples: ['spec_abc123def456'] }),
  name: str({ description: 'Display name of the specification', examples: ['Default Configuration', 'Advanced Mode'] }),
  description: str({ nullable: true, description: 'Description of what this specification provides' }),
  createdAt: date({ description: 'Timestamp when the specification was created' }),
  updatedAt: date({ description: 'Timestamp when the specification was last updated' })
});

let providerType = obj({
  object: str({ description: 'Object type identifier', examples: ['provider'] }),
  id: str({ description: 'Unique provider identifier', examples: ['prov_abc123def456'] }),
  name: str({ description: 'Display name of the provider', examples: ['GitHub', 'Slack', 'Notion'] }),
  description: str({ nullable: true, description: 'Brief description of what the provider does' }),
  slug: str({ description: 'URL-friendly identifier used in paths', examples: ['github', 'slack', 'notion'] }),
  publisher: publisherType,
  currentVersion: obj({ ...versionType.properties }, { nullable: true, description: 'The currently active version of this provider' }),
  createdAt: date({ description: 'Timestamp when the provider was created' }),
  updatedAt: date({ description: 'Timestamp when the provider was last updated' })
});

let providerListingType = obj({
  object: str({ description: 'Object type identifier', examples: ['provider.listing'] }),
  id: str({ description: 'Unique listing identifier', examples: ['lst_abc123def456'] }),
  isPublic: bool({ description: 'Whether the provider is publicly visible in the marketplace', examples: [true] }),
  isCustomized: bool({ description: 'Whether the provider has custom configuration applied', examples: [false] }),
  isMetorial: bool({ description: 'Whether this is a Metorial-maintained provider', examples: [true] }),
  isVerified: bool({ description: 'Whether the provider has been verified for quality and security', examples: [true] }),
  isOfficial: bool({ description: 'Whether this is an official integration from the service provider', examples: [true] }),
  name: str({ description: 'Display name of the provider listing', examples: ['GitHub', 'Slack', 'Notion'] }),
  description: str({ nullable: true, description: 'Full description of the provider and its capabilities' }),
  slug: str({ description: 'URL-friendly identifier used in paths', examples: ['github', 'slack', 'notion'] }),
  image: record({ nullable: true, description: 'Provider logo/icon metadata including URL and dimensions' }),
  readme: str({ nullable: true, description: 'Full README content in markdown format' }),
  skills: arr(str({ description: 'Skill or capability tag', examples: ['code-review', 'issue-tracking', 'ci-cd'] }), { description: 'List of provider capabilities and feature tags' }),
  rank: num({ description: 'Popularity ranking score based on usage metrics', examples: [95, 42, 78] }),
  deploymentsCount: num({ description: 'Total number of active deployments using this provider', examples: [1250, 42, 5000] }),
  providerSessionsCount: num({ description: 'Total number of MCP sessions created with this provider', examples: [50000, 1200, 100000] }),
  providerMessagesCount: num({ description: 'Total number of messages exchanged via this provider', examples: [500000, 25000, 1000000] }),
  providerId: str({ description: 'ID of the associated provider', examples: ['prov_abc123def456'] }),
  categories: arr(categoryType, { description: 'Categories this provider belongs to' }),
  collections: arr(collectionType, { description: 'Curated collections featuring this provider' }),
  groups: arr(groupType, { description: 'User-defined groups containing this provider' }),
  createdAt: date({ description: 'Timestamp when the listing was created' }),
  updatedAt: date({ description: 'Timestamp when the listing was last updated' })
});

let specificationPreviewType = obj({
  object: str({ description: 'Object type identifier', examples: ['provider.specification'] }),
  id: str({ description: 'Unique specification identifier', examples: ['spec_abc123def456'] }),
  name: str({ description: 'Display name of the specification', examples: ['Default Configuration', 'Advanced Mode'] }),
  description: str({ nullable: true, description: 'Description of what this specification provides' }),
  createdAt: date({ description: 'Timestamp when the specification was created' }),
  updatedAt: date({ description: 'Timestamp when the specification was last updated' })
});

let specificationFullType = obj({
  object: str({ description: 'Object type identifier', examples: ['provider.specification'] }),
  id: str({ description: 'Unique specification identifier', examples: ['spec_abc123def456'] }),
  name: str({ description: 'Display name of the specification', examples: ['Default Configuration', 'Advanced Mode'] }),
  description: str({ nullable: true, description: 'Description of what this specification provides' }),
  configSchema: record({ nullable: true, description: 'JSON Schema for configuration options' }),
  tools: arr(toolType, { description: 'Tools provided by this specification' }),
  authMethods: arr(authMethodType, { description: 'Authentication methods available in this specification' }),
  providerId: str({ description: 'ID of the provider this specification belongs to', examples: ['prov_abc123def456'] }),
  createdAt: date({ description: 'Timestamp when the specification was created' }),
  updatedAt: date({ description: 'Timestamp when the specification was last updated' })
});

let toolType = obj({
  object: str({ description: 'Object type identifier', examples: ['provider.tool'] }),
  id: str({ description: 'Unique tool identifier', examples: ['tool_abc123def456'] }),
  name: str({ description: 'Display name of the tool', examples: ['Create Issue', 'Search Repositories', 'Send Message'] }),
  description: str({ nullable: true, description: 'Description of what the tool does and how to use it' }),
  inputSchema: record({ nullable: true, description: 'JSON Schema defining the tool input parameters' }),
  outputSchema: record({ nullable: true, description: 'JSON Schema defining the tool output format' }),
  providerId: str({ description: 'ID of the provider this tool belongs to', examples: ['prov_abc123def456'] }),
  providerSpecificationId: str({ description: 'ID of the specification this tool is defined in', examples: ['spec_abc123def456'] }),
  createdAt: date({ description: 'Timestamp when the tool was created' }),
  updatedAt: date({ description: 'Timestamp when the tool was last updated' })
});

let authMethodType = obj({
  object: str({ description: 'Object type identifier', examples: ['provider.auth_method'] }),
  id: str({ description: 'Unique auth method identifier', examples: ['auth_abc123def456'] }),
  type: str({ description: 'Authentication type', examples: ['oauth2', 'api_key', 'basic', 'bearer'] }),
  name: str({ description: 'Display name of the auth method', examples: ['OAuth 2.0', 'API Key', 'Basic Auth'] }),
  description: str({ nullable: true, description: 'Description of the auth method and requirements' }),
  inputSchema: record({ nullable: true, description: 'JSON Schema for the authentication input fields' }),
  scopes: arr(obj({
    object: str({ description: 'Object type identifier', examples: ['provider.auth_method.scope'] }),
    id: str({ description: 'Unique scope identifier', examples: ['scope_abc123def456'] }),
    scope: str({ description: 'OAuth scope string', examples: ['repo', 'user:email', 'read:org'] }),
    name: str({ description: 'Display name of the scope', examples: ['Repository Access', 'User Email', 'Read Organization'] }),
    description: str({ nullable: true, description: 'Description of what this scope grants access to' })
  }), { nullable: true, description: 'Available OAuth scopes for this auth method' }),
  providerId: str({ description: 'ID of the provider this auth method belongs to', examples: ['prov_abc123def456'] }),
  providerSpecificationId: str({ description: 'ID of the specification this auth method is defined in', examples: ['spec_abc123def456'] }),
  createdAt: date({ description: 'Timestamp when the auth method was created' }),
  updatedAt: date({ description: 'Timestamp when the auth method was last updated' })
});

let deploymentConfigPreviewType = obj({
  object: str({ description: 'Object type identifier', examples: ['provider.deployment_config'] }),
  id: str({ description: 'Unique deployment config identifier', examples: ['dcfg_abc123def456'] }),
  isEphemeral: bool({ description: 'Whether this is a temporary config that auto-deletes after expiration', examples: [false] }),
  isDefault: bool({ description: 'Whether this is the default configuration used when none is specified', examples: [true] }),
  name: str({ nullable: true, description: 'Display name of the deployment config', examples: ['Production Config', 'Development Config'] }),
  description: str({ nullable: true, description: 'Description of this deployment configuration' }),
  metadata: record({ nullable: true, description: 'Custom key-value metadata for the deployment config' }),
  providerId: str({ description: 'ID of the provider this config belongs to', examples: ['prov_abc123def456'] }),
  createdAt: date({ description: 'Timestamp when the deployment config was created' }),
  updatedAt: date({ description: 'Timestamp when the deployment config was last updated' })
});

let deploymentType = obj({
  object: str({ description: 'Object type identifier', examples: ['provider.deployment'] }),
  id: str({ description: 'Unique deployment identifier', examples: ['dep_abc123def456'] }),
  isEphemeral: bool({ description: 'Whether this is a temporary deployment that auto-deletes after expiration', examples: [false] }),
  isDefault: bool({ description: 'Whether this is the default deployment used when none is specified', examples: [true] }),
  name: str({ nullable: true, description: 'Display name of the deployment', examples: ['Production', 'Development', 'Staging'] }),
  description: str({ nullable: true, description: 'Description of this deployment and its purpose' }),
  metadata: record({ nullable: true, description: 'Custom key-value metadata for the deployment' }),
  providerId: str({ description: 'ID of the provider this deployment is for', examples: ['prov_abc123def456'] }),
  lockedVersion: obj({ ...versionType.properties }, { nullable: true, description: 'Specific version the deployment is locked to, or null for latest' }),
  defaultConfig: obj({ ...deploymentConfigPreviewType.properties }, { nullable: true, description: 'The default configuration for this deployment' }),
  createdAt: date({ description: 'Timestamp when the deployment was created' }),
  updatedAt: date({ description: 'Timestamp when the deployment was last updated' })
});

let configType = obj({
  object: str({ description: 'Object type identifier', examples: ['provider.config'] }),
  id: str({ description: 'Unique config identifier', examples: ['cfg_abc123def456'] }),
  isEphemeral: bool({ description: 'Whether this is a temporary config that auto-deletes after expiration', examples: [false] }),
  isDefault: bool({ description: 'Whether this is the default configuration', examples: [true] }),
  name: str({ nullable: true, description: 'Display name of the configuration', examples: ['Production Settings', 'Dev Settings'] }),
  description: str({ nullable: true, description: 'Description of this configuration' }),
  metadata: record({ nullable: true, description: 'Custom key-value metadata for the config' }),
  providerId: str({ description: 'ID of the provider this config belongs to', examples: ['prov_abc123def456'] }),
  providerDeploymentId: str({ nullable: true, description: 'ID of the deployment this config is associated with', examples: ['dep_abc123def456'] }),
  createdAt: date({ description: 'Timestamp when the config was created' }),
  updatedAt: date({ description: 'Timestamp when the config was last updated' })
});

let configVaultType = obj({
  object: str({ description: 'Object type identifier', examples: ['provider.config_vault'] }),
  id: str({ description: 'Unique config vault identifier', examples: ['vault_abc123def456'] }),
  name: str({ nullable: true, description: 'Display name of the vault', examples: ['Production Secrets', 'API Keys'] }),
  description: str({ nullable: true, description: 'Description of what this vault stores' }),
  metadata: record({ nullable: true, description: 'Custom key-value metadata for the vault' }),
  providerId: str({ description: 'ID of the provider this vault belongs to', examples: ['prov_abc123def456'] }),
  providerDeploymentId: str({ nullable: true, description: 'ID of the deployment this vault is associated with', examples: ['dep_abc123def456'] }),
  createdAt: date({ description: 'Timestamp when the vault was created' }),
  updatedAt: date({ description: 'Timestamp when the vault was last updated' })
});

let authConfigType = obj({
  object: str({ description: 'Object type identifier', examples: ['provider.auth_config'] }),
  id: str({ description: 'Unique auth config identifier', examples: ['acfg_abc123def456'] }),
  isEphemeral: bool({ description: 'Whether this is a temporary auth config that auto-deletes', examples: [false] }),
  status: str({ description: 'Authentication status', examples: ['active', 'pending', 'expired', 'error'] }),
  name: str({ nullable: true, description: 'Display name of the auth config', examples: ['Production OAuth', 'Dev API Key'] }),
  description: str({ nullable: true, description: 'Description of this auth configuration' }),
  metadata: record({ nullable: true, description: 'Custom key-value metadata for the auth config' }),
  providerId: str({ description: 'ID of the provider this auth config is for', examples: ['prov_abc123def456'] }),
  providerDeploymentId: str({ nullable: true, description: 'ID of the deployment this auth config is associated with', examples: ['dep_abc123def456'] }),
  providerAuthMethodId: str({ description: 'ID of the auth method used for this config', examples: ['auth_abc123def456'] }),
  createdAt: date({ description: 'Timestamp when the auth config was created' }),
  updatedAt: date({ description: 'Timestamp when the auth config was last updated' })
});

let authCredentialsType = obj({
  object: str({ description: 'Object type identifier', examples: ['provider.auth_credentials'] }),
  id: str({ description: 'Unique credentials identifier', examples: ['cred_abc123def456'] }),
  isEphemeral: bool({ description: 'Whether these credentials are temporary', examples: [false] }),
  name: str({ nullable: true, description: 'Display name of the credentials', examples: ['GitHub Token', 'Slack Bot Token'] }),
  description: str({ nullable: true, description: 'Description of these credentials' }),
  metadata: record({ nullable: true, description: 'Custom key-value metadata for the credentials' }),
  providerId: str({ description: 'ID of the provider these credentials are for', examples: ['prov_abc123def456'] }),
  providerAuthMethodId: str({ description: 'ID of the auth method these credentials use', examples: ['auth_abc123def456'] }),
  createdAt: date({ description: 'Timestamp when the credentials were created' }),
  updatedAt: date({ description: 'Timestamp when the credentials were last updated' })
});

let setupSessionType = obj({
  object: str({ description: 'Object type identifier', examples: ['provider.setup_session'] }),
  id: str({ description: 'Unique setup session identifier', examples: ['sess_abc123def456'] }),
  status: str({ description: 'Session status', examples: ['pending', 'in_progress', 'completed', 'failed', 'expired'] }),
  name: str({ nullable: true, description: 'Display name of the setup session', examples: ['GitHub OAuth Setup'] }),
  description: str({ nullable: true, description: 'Description of this setup session' }),
  metadata: record({ nullable: true, description: 'Custom key-value metadata for the session' }),
  providerId: str({ description: 'ID of the provider this session is setting up', examples: ['prov_abc123def456'] }),
  providerDeploymentId: str({ nullable: true, description: 'ID of the target deployment', examples: ['dep_abc123def456'] }),
  providerAuthMethodId: str({ description: 'ID of the auth method being configured', examples: ['auth_abc123def456'] }),
  uiMode: str({ nullable: true, description: 'UI mode for the setup flow', examples: ['popup', 'redirect'] }),
  redirectUrl: str({ nullable: true, description: 'URL to redirect to after authentication completes', examples: ['https://app.example.com/callback'] }),
  setupUrl: str({ nullable: true, description: 'URL where the user should complete authentication', examples: ['https://auth.example.com/setup/sess_abc123'] }),
  createdAt: date({ description: 'Timestamp when the setup session was created' }),
  updatedAt: date({ description: 'Timestamp when the setup session was last updated' })
});

let authExportType = obj({
  object: str({ description: 'Object type identifier', examples: ['provider.auth_export'] }),
  id: str({ description: 'Unique auth export identifier', examples: ['exp_abc123def456'] }),
  note: str({ description: 'Note explaining the reason for exporting', examples: ['Backup before migration', 'Transfer to new account'] }),
  metadata: record({ nullable: true, description: 'Custom key-value metadata for the export' }),
  providerAuthConfigId: str({ description: 'ID of the auth config that was exported', examples: ['acfg_abc123def456'] }),
  createdAt: date({ description: 'Timestamp when the export was created' })
});

let authImportType = obj({
  object: str({ description: 'Object type identifier', examples: ['provider.auth_import'] }),
  id: str({ description: 'Unique auth import identifier', examples: ['imp_abc123def456'] }),
  note: str({ description: 'Note explaining the import', examples: ['Restored from backup', 'Migrated from old system'] }),
  metadata: record({ nullable: true, description: 'Custom key-value metadata for the import' }),
  providerId: str({ nullable: true, description: 'ID of the provider for the imported auth', examples: ['prov_abc123def456'] }),
  providerDeploymentId: str({ nullable: true, description: 'ID of the target deployment', examples: ['dep_abc123def456'] }),
  providerAuthConfigId: str({ nullable: true, description: 'ID of the auth config that was updated or created', examples: ['acfg_abc123def456'] }),
  providerAuthMethodId: str({ nullable: true, description: 'ID of the auth method used', examples: ['auth_abc123def456'] }),
  createdAt: date({ description: 'Timestamp when the import was created' })
});

// Register all types
let providerListTypeId = addType('ProviderList', paginatedList(providerType));
let providerTypeId = addType('Provider', providerType);

let providerListingListTypeId = addType('ProviderListingList', paginatedList(providerListingType));
let providerListingTypeId = addType('ProviderListing', providerListingType);

let categoryListTypeId = addType('CategoryList', paginatedList(categoryType));
let categoryTypeId = addType('Category', categoryType);

let collectionListTypeId = addType('CollectionList', paginatedList(collectionType));
let collectionTypeId = addType('Collection', collectionType);

let groupListTypeId = addType('GroupList', paginatedList(groupType));
let groupTypeId = addType('Group', groupType);
let groupCreateBodyTypeId = addType('GroupCreateBody', obj({
  name: str({ description: 'Name of the group' }),
  description: str({ optional: true, description: 'Description of the group' }),
  slug: str({ description: 'URL-friendly slug' }),
  metadata: record({ optional: true, description: 'Custom metadata' })
}));
let groupUpdateBodyTypeId = addType('GroupUpdateBody', obj({
  name: str({ optional: true, description: 'Name of the group' }),
  description: str({ optional: true, description: 'Description of the group' }),
  slug: str({ optional: true, description: 'URL-friendly slug' }),
  metadata: record({ optional: true, description: 'Custom metadata' })
}));

let publisherListTypeId = addType('PublisherList', paginatedList(publisherType));
let publisherTypeId = addType('Publisher', publisherType);

let versionListTypeId = addType('VersionList', paginatedList(versionType));
let versionTypeId = addType('Version', versionType);
let versionQueryTypeId = addType('VersionQuery', obj({
  ...paginatorQuery.properties,
  provider_id: str({ optional: true, description: 'Filter by provider ID', examples: ['prov_abc123def456'] })
}));

let specificationListTypeId = addType('SpecificationList', paginatedList(specificationFullType));
let specificationTypeId = addType('Specification', specificationFullType);
let specificationQueryTypeId = addType('SpecificationQuery', obj({
  ...paginatorQuery.properties,
  provider_id: str({ optional: true, description: 'Filter by provider ID', examples: ['prov_abc123def456'] })
}));

let toolListTypeId = addType('ToolList', paginatedList(toolType));
let toolTypeId = addType('Tool', toolType);
let toolQueryTypeId = addType('ToolQuery', obj({
  ...paginatorQuery.properties,
  provider_id: str({ optional: true, description: 'Filter by provider ID', examples: ['prov_abc123def456'] }),
  provider_specification_id: str({ optional: true, description: 'Filter by specification ID', examples: ['spec_abc123def456'] })
}));

let authMethodListTypeId = addType('AuthMethodList', paginatedList(authMethodType));
let authMethodTypeId = addType('AuthMethod', authMethodType);
let authMethodQueryTypeId = addType('AuthMethodQuery', obj({
  ...paginatorQuery.properties,
  provider_id: str({ optional: true, description: 'Filter by provider ID', examples: ['prov_abc123def456'] }),
  provider_specification_id: str({ optional: true, description: 'Filter by specification ID', examples: ['spec_abc123def456'] })
}));

let deploymentListTypeId = addType('DeploymentList', paginatedList(deploymentType));
let deploymentTypeId = addType('Deployment', deploymentType);
let deploymentQueryTypeId = addType('DeploymentQuery', obj({
  ...paginatorQuery.properties,
  provider_id: str({ optional: true, description: 'Filter by provider ID', examples: ['prov_abc123def456'] }),
  provider_version_id: str({ optional: true, description: 'Filter by version ID', examples: ['ver_abc123def456'] }),
  status: str({ optional: true, description: 'Filter by status (active, inactive, pending)', examples: ['active'] })
}));
let deploymentCreateBodyTypeId = addType('DeploymentCreateBody', obj({
  name: str({ description: 'Name of the deployment', examples: ['Production GitHub'] }),
  description: str({ optional: true, description: 'Description', examples: ['GitHub integration for production environment'] }),
  metadata: record({ optional: true, description: 'Custom metadata' }),
  isEphemeral: bool({ optional: true, description: 'Whether the deployment is ephemeral' }),
  providerId: str({ description: 'ID of the provider', examples: ['prov_abc123def456'] }),
  lockedProviderVersionId: str({ optional: true, description: 'Lock to specific version', examples: ['ver_abc123def456'] }),
  config: union([
    obj({ type: str({ description: 'No configuration', examples: ['none'] }) }),
    obj({ type: str({ description: 'Inline configuration data', examples: ['inline'] }), data: record({ description: 'Configuration key-value pairs' }) }),
    obj({ type: str({ description: 'Reference existing vault', examples: ['vault'] }), providerConfigVaultId: str({ description: 'ID of existing vault', examples: ['vault_abc123def456'] }) })
  ], { description: 'Configuration for the deployment' })
}));
let deploymentUpdateBodyTypeId = addType('DeploymentUpdateBody', obj({
  name: str({ optional: true, description: 'Name of the deployment' }),
  description: str({ optional: true, description: 'Description' }),
  metadata: record({ optional: true, description: 'Custom metadata' })
}));
let deploymentDeletedTypeId = addType('DeploymentDeleted', deletedResponse('provider.deployment'));

let configListTypeId = addType('ConfigList', paginatedList(configType));
let configTypeId = addType('Config', configType);
let configQueryTypeId = addType('ConfigQuery', obj({
  ...paginatorQuery.properties,
  provider_id: str({ optional: true, description: 'Filter by provider ID', examples: ['prov_abc123def456'] }),
  provider_deployment_id: str({ optional: true, description: 'Filter by deployment ID', examples: ['dep_abc123def456'] })
}));
let configCreateBodyTypeId = addType('ConfigCreateBody', obj({
  name: str({ description: 'Name of the config', examples: ['Development Config'] }),
  description: str({ optional: true, description: 'Description', examples: ['Configuration for development environment'] }),
  metadata: record({ optional: true, description: 'Custom metadata' }),
  isEphemeral: bool({ optional: true, description: 'Whether the config is ephemeral' }),
  providerId: str({ description: 'ID of the provider', examples: ['prov_abc123def456'] }),
  providerDeploymentId: str({ optional: true, description: 'ID of the deployment', examples: ['dep_abc123def456'] }),
  config: union([
    obj({ type: str({ description: 'Inline configuration data', examples: ['inline'] }), data: record({ description: 'Configuration key-value pairs' }) }),
    obj({ type: str({ description: 'Reference existing vault', examples: ['vault'] }), providerConfigVaultId: str({ description: 'ID of existing vault', examples: ['vault_abc123def456'] }) })
  ], { description: 'Configuration source' })
}));
let configUpdateBodyTypeId = addType('ConfigUpdateBody', obj({
  name: str({ optional: true, description: 'Name of the config' }),
  description: str({ optional: true, description: 'Description' }),
  metadata: record({ optional: true, description: 'Custom metadata' })
}));
let configDeletedTypeId = addType('ConfigDeleted', deletedResponse('provider.config'));

let configVaultListTypeId = addType('ConfigVaultList', paginatedList(configVaultType));
let configVaultTypeId = addType('ConfigVault', configVaultType);
let configVaultQueryTypeId = addType('ConfigVaultQuery', obj({
  ...paginatorQuery.properties,
  provider_id: str({ optional: true, description: 'Filter by provider ID', examples: ['prov_abc123def456'] }),
  provider_deployment_id: str({ optional: true, description: 'Filter by deployment ID', examples: ['dep_abc123def456'] })
}));
let configVaultCreateBodyTypeId = addType('ConfigVaultCreateBody', obj({
  name: str({ description: 'Name of the vault', examples: ['API Credentials Vault'] }),
  description: str({ optional: true, description: 'Description', examples: ['Secure storage for API credentials'] }),
  metadata: record({ optional: true, description: 'Custom metadata' }),
  isEphemeral: bool({ optional: true, description: 'Whether the vault is ephemeral' }),
  providerId: str({ description: 'ID of the provider', examples: ['prov_abc123def456'] }),
  providerDeploymentId: str({ optional: true, description: 'ID of the deployment', examples: ['dep_abc123def456'] }),
  data: record({ description: 'Configuration data to store in the vault' })
}));
let configVaultUpdateBodyTypeId = addType('ConfigVaultUpdateBody', obj({
  name: str({ optional: true, description: 'Name of the vault' }),
  description: str({ optional: true, description: 'Description' }),
  metadata: record({ optional: true, description: 'Custom metadata' })
}));
let configVaultDeletedTypeId = addType('ConfigVaultDeleted', deletedResponse('provider.config_vault'));

let authConfigListTypeId = addType('AuthConfigList', paginatedList(authConfigType));
let authConfigTypeId = addType('AuthConfig', authConfigType);
let authConfigQueryTypeId = addType('AuthConfigQuery', obj({
  ...paginatorQuery.properties,
  provider_id: str({ optional: true, description: 'Filter by provider ID', examples: ['prov_abc123def456'] }),
  provider_deployment_id: str({ optional: true, description: 'Filter by deployment ID', examples: ['dep_abc123def456'] }),
  provider_auth_method_id: str({ optional: true, description: 'Filter by auth method ID', examples: ['auth_abc123def456'] }),
  provider_auth_credentials_id: str({ optional: true, description: 'Filter by credentials ID', examples: ['cred_abc123def456'] }),
  status: str({ optional: true, description: 'Filter by status (active, pending, expired, error)', examples: ['active'] })
}));
let authConfigCreateBodyTypeId = addType('AuthConfigCreateBody', obj({
  name: str({ description: 'Name of the auth config', examples: ['My GitHub OAuth'] }),
  description: str({ optional: true, description: 'Description', examples: ['OAuth connection for my GitHub account'] }),
  metadata: record({ optional: true, description: 'Custom metadata' }),
  isEphemeral: bool({ optional: true, description: 'Whether the auth config is ephemeral' }),
  providerId: str({ description: 'ID of the provider', examples: ['prov_abc123def456'] }),
  providerDeploymentId: str({ optional: true, description: 'ID of the deployment', examples: ['dep_abc123def456'] }),
  providerAuthMethodId: str({ description: 'ID of the auth method', examples: ['auth_abc123def456'] }),
  credentials: union([
    obj({ type: str({ description: 'Inline credentials data', examples: ['inline'] }), data: record({ description: 'Credential key-value pairs' }) }),
    obj({ type: str({ description: 'Reference existing credentials', examples: ['existing'] }), providerAuthCredentialsId: str({ description: 'ID of existing credentials', examples: ['cred_abc123def456'] }) })
  ], { description: 'Credentials source - use inline for one-off credentials, or reference reusable credentials created via /auth-credentials' })
}));
let authConfigUpdateBodyTypeId = addType('AuthConfigUpdateBody', obj({
  name: str({ optional: true, description: 'Name of the auth config' }),
  description: str({ optional: true, description: 'Description' }),
  metadata: record({ optional: true, description: 'Custom metadata' })
}));
let authConfigDeletedTypeId = addType('AuthConfigDeleted', deletedResponse('provider.auth_config'));

let authCredentialsListTypeId = addType('AuthCredentialsList', paginatedList(authCredentialsType));
let authCredentialsTypeId = addType('AuthCredentials', authCredentialsType);
let authCredentialsQueryTypeId = addType('AuthCredentialsQuery', obj({
  ...paginatorQuery.properties,
  provider_id: str({ optional: true, description: 'Filter by provider ID', examples: ['prov_abc123def456'] }),
  provider_auth_method_id: str({ optional: true, description: 'Filter by auth method ID', examples: ['auth_abc123def456'] })
}));
let authCredentialsCreateBodyTypeId = addType('AuthCredentialsCreateBody', obj({
  name: str({ description: 'Name of the credentials', examples: ['Team API Key'] }),
  description: str({ optional: true, description: 'Description', examples: ['Shared API key for the engineering team'] }),
  metadata: record({ optional: true, description: 'Custom metadata' }),
  isEphemeral: bool({ optional: true, description: 'Whether the credentials are ephemeral' }),
  providerId: str({ description: 'ID of the provider', examples: ['prov_abc123def456'] }),
  providerAuthMethodId: str({ description: 'ID of the auth method', examples: ['auth_abc123def456'] }),
  credentials: record({ description: 'Credential data' })
}));
let authCredentialsUpdateBodyTypeId = addType('AuthCredentialsUpdateBody', obj({
  name: str({ optional: true, description: 'Name of the credentials' }),
  description: str({ optional: true, description: 'Description' }),
  metadata: record({ optional: true, description: 'Custom metadata' })
}));
let authCredentialsDeletedTypeId = addType('AuthCredentialsDeleted', deletedResponse('provider.auth_credentials'));

let setupSessionListTypeId = addType('SetupSessionList', paginatedList(setupSessionType));
let setupSessionTypeId = addType('SetupSession', setupSessionType);
let setupSessionQueryTypeId = addType('SetupSessionQuery', obj({
  ...paginatorQuery.properties,
  provider_id: str({ optional: true, description: 'Filter by provider ID', examples: ['prov_abc123def456'] }),
  provider_auth_method_id: str({ optional: true, description: 'Filter by auth method ID', examples: ['auth_abc123def456'] }),
  status: str({ optional: true, description: 'Filter by status (pending, completed, expired, error)', examples: ['pending'] })
}));
let setupSessionCreateBodyTypeId = addType('SetupSessionCreateBody', obj({
  name: str({ optional: true, description: 'Name of the session', examples: ['GitHub OAuth Setup'] }),
  description: str({ optional: true, description: 'Description', examples: ['OAuth setup for GitHub integration'] }),
  metadata: record({ optional: true, description: 'Custom metadata' }),
  providerId: str({ description: 'ID of the provider', examples: ['prov_abc123def456'] }),
  providerDeploymentId: str({ optional: true, description: 'ID of the deployment', examples: ['dep_abc123def456'] }),
  providerAuthMethodId: str({ description: 'ID of the auth method', examples: ['auth_abc123def456'] }),
  uiMode: enumType(['popup', 'redirect'], { optional: true, description: 'UI mode for the setup flow' }),
  redirectUrl: str({ optional: true, description: 'URL to redirect after setup', examples: ['https://myapp.com/callback'] })
}));
let setupSessionUpdateBodyTypeId = addType('SetupSessionUpdateBody', obj({
  name: str({ optional: true, description: 'Name of the session' }),
  description: str({ optional: true, description: 'Description' }),
  metadata: record({ optional: true, description: 'Custom metadata' })
}));
let setupSessionDeletedTypeId = addType('SetupSessionDeleted', deletedResponse('provider.setup_session'));

let authExportListTypeId = addType('AuthExportList', paginatedList(authExportType));
let authExportTypeId = addType('AuthExport', authExportType);
let authExportWithValueTypeId = addType('AuthExportWithValue', obj({
  ...authExportType.properties,
  value: record({ description: 'Decrypted auth config data' })
}));
let authExportQueryTypeId = addType('AuthExportQuery', obj({
  ...paginatorQuery.properties,
  provider_id: str({ optional: true, description: 'Filter by provider ID', examples: ['prov_abc123def456'] }),
  provider_auth_config_id: str({ optional: true, description: 'Filter by auth config ID', examples: ['acfg_abc123def456'] })
}));
let authExportCreateBodyTypeId = addType('AuthExportCreateBody', obj({
  note: str({ description: 'Note explaining the export reason', examples: ['Backup before migration'] }),
  metadata: record({ optional: true, description: 'Custom metadata' }),
  providerAuthConfigId: str({ description: 'ID of the auth config to export', examples: ['acfg_abc123def456'] })
}));

let authImportListTypeId = addType('AuthImportList', paginatedList(authImportType));
let authImportTypeId = addType('AuthImport', authImportType);
let authImportQueryTypeId = addType('AuthImportQuery', obj({
  ...paginatorQuery.properties,
  provider_id: str({ optional: true, description: 'Filter by provider ID', examples: ['prov_abc123def456'] }),
  provider_auth_config_id: str({ optional: true, description: 'Filter by auth config ID', examples: ['acfg_abc123def456'] }),
  provider_deployment_id: str({ optional: true, description: 'Filter by deployment ID', examples: ['dep_abc123def456'] })
}));
let authImportCreateBodyTypeId = addType('AuthImportCreateBody', obj({
  note: str({ description: 'Note explaining the import', examples: ['Restore from backup'] }),
  metadata: record({ optional: true, description: 'Custom metadata' }),
  providerId: str({ optional: true, description: 'ID of the provider', examples: ['prov_abc123def456'] }),
  providerDeploymentId: str({ optional: true, description: 'ID of the deployment', examples: ['dep_abc123def456'] }),
  providerAuthConfigId: str({ optional: true, description: 'ID of the auth config to update', examples: ['acfg_abc123def456'] }),
  providerAuthMethodId: str({ optional: true, description: 'ID of the auth method', examples: ['auth_abc123def456'] }),
  config: record({ description: 'Auth configuration data to import' })
}));

let paginatorQueryTypeId = addType('PaginatorQuery', paginatorQuery);
let providerQueryTypeId = addType('ProviderQuery', obj({
  ...paginatorQuery.properties,
  publisher_id: str({ optional: true, description: 'Filter by publisher ID', examples: ['pub_abc123def456'] })
}));
let providerListingQueryTypeId = addType('ProviderListingQuery', obj({
  ...paginatorQuery.properties,
  search: str({ optional: true, description: 'Search query to filter listings by name or description', examples: ['github'] }),
  provider_category_id: str({ optional: true, description: 'Filter by category ID', examples: ['cat_abc123def456'] }),
  provider_collection_id: str({ optional: true, description: 'Filter by collection ID', examples: ['col_abc123def456'] }),
  provider_group_id: str({ optional: true, description: 'Filter by group ID', examples: ['grp_abc123def456'] }),
  publisher_id: str({ optional: true, description: 'Filter by publisher ID', examples: ['pub_abc123def456'] }),
  is_public: str({ optional: true, description: 'Filter by public visibility (true/false)', examples: ['true'] }),
  is_verified: str({ optional: true, description: 'Filter by verification status (true/false)', examples: ['true'] }),
  is_official: str({ optional: true, description: 'Filter by official status (true/false)', examples: ['true'] }),
  is_metorial: str({ optional: true, description: 'Filter by Metorial-maintained status (true/false)', examples: ['false'] })
}));

// Define controllers
let controllers: Controller[] = [
  {
    id: 'controller_providers',
    name: 'Providers',
    description: 'Core provider data including publisher and version information.'
  },
  {
    id: 'controller_provider_listings',
    name: 'Provider Listings',
    description: 'Marketplace listings with categories, collections, and usage statistics.'
  },
  {
    id: 'controller_categories',
    name: 'Categories',
    description:
      'Manage provider categories. Categories group providers by functionality such as Developer Tools, Communication, or Data & Analytics.'
  },
  {
    id: 'controller_collections',
    name: 'Collections',
    description:
      'Manage curated provider collections. Collections are hand-picked groups like Featured Providers or Most Popular.'
  },
  {
    id: 'controller_groups',
    name: 'Groups',
    description:
      'Manage user-defined provider groups. Groups let you organize providers into personalized sets.'
  },
  {
    id: 'controller_publishers',
    name: 'Publishers',
    description: 'Manage publishers. Publishers are organizations or individuals that create and maintain providers.'
  },
  {
    id: 'controller_versions',
    name: 'Versions',
    description:
      'Manage provider versions. Each provider can have multiple versions with different capabilities and configurations.'
  },
  {
    id: 'controller_specifications',
    name: 'Specifications',
    description:
      'Manage provider specifications. Specifications define the MCP capabilities, tools, and configuration schema for a provider version.'
  },
  {
    id: 'controller_tools',
    name: 'Tools',
    description:
      'Browse provider tools. Tools are individual capabilities exposed by a provider that can be invoked by AI models.'
  },
  {
    id: 'controller_auth_methods',
    name: 'Auth Methods',
    description:
      'Manage authentication methods. Auth methods define how users authenticate with a provider (OAuth2, API key, etc.).'
  },
  {
    id: 'controller_deployments',
    name: 'Deployments',
    description:
      'Manage provider deployments. A deployment is an instance of a provider with specific configuration and version settings.'
  },
  {
    id: 'controller_configs',
    name: 'Configs',
    description:
      'Manage provider configurations. Configs store non-sensitive settings like environment preferences and feature flags.'
  },
  {
    id: 'controller_config_vaults',
    name: 'Config Vaults',
    description:
      'Manage configuration vaults. Vaults securely store sensitive configuration data with encryption at rest.'
  },
  {
    id: 'controller_auth_configs',
    name: 'Auth Configs',
    description:
      'Manage authentication configurations. Auth configs store the authenticated state and tokens for a provider connection.'
  },
  {
    id: 'controller_auth_credentials',
    name: 'Auth Credentials',
    description:
      'Manage authentication credentials. Credentials are reusable authentication tokens that can be shared across deployments.'
  },
  {
    id: 'controller_setup_sessions',
    name: 'Setup Sessions',
    description:
      'Create and manage OAuth/authentication setup flows. Setup sessions guide users through the provider authentication process.'
  },
  {
    id: 'controller_auth_exports',
    name: 'Auth Exports',
    description:
      'Export authentication configurations. Use exports to backup or transfer auth configs between environments.'
  },
  {
    id: 'controller_auth_imports',
    name: 'Auth Imports',
    description: 'Import authentication configurations. Use imports to restore or migrate auth configs from exports.'
  }
];

// Define endpoints
let endpoints: Endpoint[] = [
  // Providers
  {
    id: 'endpoint_providers_list',
    controllerId: 'controller_providers',
    path: '/providers',
    allPaths: [{ path: '/providers', sdkPath: 'providers.list' }],
    method: 'get',
    name: 'List Providers',
    description: 'Returns a paginated list of providers.',
    bodyId: null,
    queryId: providerQueryTypeId,
    outputId: providerListTypeId
  },
  {
    id: 'endpoint_providers_get',
    controllerId: 'controller_providers',
    path: '/providers/:providerId',
    allPaths: [{ path: '/providers/:providerId', sdkPath: 'providers.get' }],
    method: 'get',
    name: 'Get Provider',
    description: 'Retrieves a specific provider.',
    bodyId: null,
    queryId: null,
    outputId: providerTypeId
  },

  // Provider Listings
  {
    id: 'endpoint_provider_listings_list',
    controllerId: 'controller_provider_listings',
    path: '/provider-listings',
    allPaths: [{ path: '/provider-listings', sdkPath: 'providerListings.list' }],
    method: 'get',
    name: 'List Provider Listings',
    description: 'Returns a paginated list of provider listings.',
    bodyId: null,
    queryId: providerListingQueryTypeId,
    outputId: providerListingListTypeId
  },
  {
    id: 'endpoint_provider_listings_get',
    controllerId: 'controller_provider_listings',
    path: '/provider-listings/:providerId',
    allPaths: [{ path: '/provider-listings/:providerId', sdkPath: 'providerListings.get' }],
    method: 'get',
    name: 'Get Provider Listing',
    description: 'Retrieves a specific provider listing.',
    bodyId: null,
    queryId: null,
    outputId: providerListingTypeId
  },

  // Categories
  {
    id: 'endpoint_categories_list',
    controllerId: 'controller_categories',
    path: '/categories',
    allPaths: [{ path: '/categories', sdkPath: 'categories.list' }],
    method: 'get',
    name: 'List Categories',
    description: 'Returns a paginated list of provider categories.',
    bodyId: null,
    queryId: paginatorQueryTypeId,
    outputId: categoryListTypeId
  },
  {
    id: 'endpoint_categories_get',
    controllerId: 'controller_categories',
    path: '/categories/:providerCategoryId',
    allPaths: [{ path: '/categories/:providerCategoryId', sdkPath: 'categories.get' }],
    method: 'get',
    name: 'Get Category',
    description: 'Retrieves a specific category.',
    bodyId: null,
    queryId: null,
    outputId: categoryTypeId
  },

  // Collections
  {
    id: 'endpoint_collections_list',
    controllerId: 'controller_collections',
    path: '/collections',
    allPaths: [{ path: '/collections', sdkPath: 'collections.list' }],
    method: 'get',
    name: 'List Collections',
    description: 'Returns a paginated list of curated provider collections.',
    bodyId: null,
    queryId: paginatorQueryTypeId,
    outputId: collectionListTypeId
  },
  {
    id: 'endpoint_collections_get',
    controllerId: 'controller_collections',
    path: '/collections/:providerCollectionId',
    allPaths: [{ path: '/collections/:providerCollectionId', sdkPath: 'collections.get' }],
    method: 'get',
    name: 'Get Collection',
    description: 'Retrieves a specific collection.',
    bodyId: null,
    queryId: null,
    outputId: collectionTypeId
  },

  // Groups
  {
    id: 'endpoint_groups_list',
    controllerId: 'controller_groups',
    path: '/groups',
    allPaths: [{ path: '/groups', sdkPath: 'groups.list' }],
    method: 'get',
    name: 'List Groups',
    description: 'Returns a paginated list of your custom provider groups.',
    bodyId: null,
    queryId: paginatorQueryTypeId,
    outputId: groupListTypeId
  },
  {
    id: 'endpoint_groups_get',
    controllerId: 'controller_groups',
    path: '/groups/:providerGroupId',
    allPaths: [{ path: '/groups/:providerGroupId', sdkPath: 'groups.get' }],
    method: 'get',
    name: 'Get Group',
    description: 'Retrieves a specific group.',
    bodyId: null,
    queryId: null,
    outputId: groupTypeId
  },
  {
    id: 'endpoint_groups_create',
    controllerId: 'controller_groups',
    path: '/groups',
    allPaths: [{ path: '/groups', sdkPath: 'groups.create' }],
    method: 'post',
    name: 'Create Group',
    description: 'Creates a new custom provider group.',
    bodyId: groupCreateBodyTypeId,
    queryId: null,
    outputId: groupTypeId
  },
  {
    id: 'endpoint_groups_update',
    controllerId: 'controller_groups',
    path: '/groups/:providerGroupId',
    allPaths: [{ path: '/groups/:providerGroupId', sdkPath: 'groups.update' }],
    method: 'patch',
    name: 'Update Group',
    description: 'Updates an existing group.',
    bodyId: groupUpdateBodyTypeId,
    queryId: null,
    outputId: groupTypeId
  },

  // Publishers
  {
    id: 'endpoint_publishers_list',
    controllerId: 'controller_publishers',
    path: '/publishers',
    allPaths: [{ path: '/publishers', sdkPath: 'publishers.list' }],
    method: 'get',
    name: 'List Publishers',
    description: 'Returns a paginated list of publishers.',
    bodyId: null,
    queryId: paginatorQueryTypeId,
    outputId: publisherListTypeId
  },
  {
    id: 'endpoint_publishers_get',
    controllerId: 'controller_publishers',
    path: '/publishers/:publisherId',
    allPaths: [{ path: '/publishers/:publisherId', sdkPath: 'publishers.get' }],
    method: 'get',
    name: 'Get Publisher',
    description: 'Retrieves a specific publisher.',
    bodyId: null,
    queryId: null,
    outputId: publisherTypeId
  },

  // Versions
  {
    id: 'endpoint_versions_list',
    controllerId: 'controller_versions',
    path: '/versions',
    allPaths: [{ path: '/versions', sdkPath: 'versions.list' }],
    method: 'get',
    name: 'List Versions',
    description: 'Returns a paginated list of provider versions.',
    bodyId: null,
    queryId: versionQueryTypeId,
    outputId: versionListTypeId
  },
  {
    id: 'endpoint_versions_get',
    controllerId: 'controller_versions',
    path: '/versions/:providerVersionId',
    allPaths: [{ path: '/versions/:providerVersionId', sdkPath: 'versions.get' }],
    method: 'get',
    name: 'Get Version',
    description: 'Retrieves a specific provider version.',
    bodyId: null,
    queryId: null,
    outputId: versionTypeId
  },

  // Specifications
  {
    id: 'endpoint_specifications_list',
    controllerId: 'controller_specifications',
    path: '/specifications',
    allPaths: [{ path: '/specifications', sdkPath: 'specifications.list' }],
    method: 'get',
    name: 'List Specifications',
    description: 'Returns a paginated list of provider specifications.',
    bodyId: null,
    queryId: specificationQueryTypeId,
    outputId: specificationListTypeId
  },
  {
    id: 'endpoint_specifications_get',
    controllerId: 'controller_specifications',
    path: '/specifications/:providerSpecificationId',
    allPaths: [{ path: '/specifications/:providerSpecificationId', sdkPath: 'specifications.get' }],
    method: 'get',
    name: 'Get Specification',
    description: 'Retrieves a specific provider specification.',
    bodyId: null,
    queryId: null,
    outputId: specificationTypeId
  },

  // Tools
  {
    id: 'endpoint_tools_list',
    controllerId: 'controller_tools',
    path: '/tools',
    allPaths: [{ path: '/tools', sdkPath: 'tools.list' }],
    method: 'get',
    name: 'List Tools',
    description: 'Returns a paginated list of provider tools.',
    bodyId: null,
    queryId: toolQueryTypeId,
    outputId: toolListTypeId
  },
  {
    id: 'endpoint_tools_get',
    controllerId: 'controller_tools',
    path: '/tools/:providerToolId',
    allPaths: [{ path: '/tools/:providerToolId', sdkPath: 'tools.get' }],
    method: 'get',
    name: 'Get Tool',
    description: 'Retrieves a specific tool.',
    bodyId: null,
    queryId: null,
    outputId: toolTypeId
  },

  // Auth Methods
  {
    id: 'endpoint_auth_methods_list',
    controllerId: 'controller_auth_methods',
    path: '/auth-methods',
    allPaths: [{ path: '/auth-methods', sdkPath: 'authMethods.list' }],
    method: 'get',
    name: 'List Auth Methods',
    description: 'Returns a paginated list of authentication methods.',
    bodyId: null,
    queryId: authMethodQueryTypeId,
    outputId: authMethodListTypeId
  },
  {
    id: 'endpoint_auth_methods_get',
    controllerId: 'controller_auth_methods',
    path: '/auth-methods/:providerAuthMethodId',
    allPaths: [{ path: '/auth-methods/:providerAuthMethodId', sdkPath: 'authMethods.get' }],
    method: 'get',
    name: 'Get Auth Method',
    description: 'Retrieves a specific authentication method.',
    bodyId: null,
    queryId: null,
    outputId: authMethodTypeId
  },

  // Deployments
  {
    id: 'endpoint_deployments_list',
    controllerId: 'controller_deployments',
    path: '/deployments',
    allPaths: [{ path: '/deployments', sdkPath: 'deployments.list' }],
    method: 'get',
    name: 'List Deployments',
    description: 'Returns a paginated list of your provider deployments.',
    bodyId: null,
    queryId: deploymentQueryTypeId,
    outputId: deploymentListTypeId
  },
  {
    id: 'endpoint_deployments_get',
    controllerId: 'controller_deployments',
    path: '/deployments/:providerDeploymentId',
    allPaths: [{ path: '/deployments/:providerDeploymentId', sdkPath: 'deployments.get' }],
    method: 'get',
    name: 'Get Deployment',
    description: 'Retrieves a specific deployment.',
    bodyId: null,
    queryId: null,
    outputId: deploymentTypeId
  },
  {
    id: 'endpoint_deployments_create',
    controllerId: 'controller_deployments',
    path: '/deployments',
    allPaths: [{ path: '/deployments', sdkPath: 'deployments.create' }],
    method: 'post',
    name: 'Create Deployment',
    description: 'Creates a new provider deployment.',
    bodyId: deploymentCreateBodyTypeId,
    queryId: null,
    outputId: deploymentTypeId
  },
  {
    id: 'endpoint_deployments_update',
    controllerId: 'controller_deployments',
    path: '/deployments/:providerDeploymentId',
    allPaths: [{ path: '/deployments/:providerDeploymentId', sdkPath: 'deployments.update' }],
    method: 'patch',
    name: 'Update Deployment',
    description: 'Updates an existing deployment.',
    bodyId: deploymentUpdateBodyTypeId,
    queryId: null,
    outputId: deploymentTypeId
  },
  {
    id: 'endpoint_deployments_delete',
    controllerId: 'controller_deployments',
    path: '/deployments/:providerDeploymentId',
    allPaths: [{ path: '/deployments/:providerDeploymentId', sdkPath: 'deployments.delete' }],
    method: 'delete',
    name: 'Delete Deployment',
    description: 'Permanently deletes a deployment.',
    bodyId: null,
    queryId: null,
    outputId: deploymentDeletedTypeId
  },

  // Configs
  {
    id: 'endpoint_configs_list',
    controllerId: 'controller_configs',
    path: '/configs',
    allPaths: [{ path: '/configs', sdkPath: 'configs.list' }],
    method: 'get',
    name: 'List Configs',
    description: 'Returns a paginated list of provider configurations.',
    bodyId: null,
    queryId: configQueryTypeId,
    outputId: configListTypeId
  },
  {
    id: 'endpoint_configs_get',
    controllerId: 'controller_configs',
    path: '/configs/:providerConfigId',
    allPaths: [{ path: '/configs/:providerConfigId', sdkPath: 'configs.get' }],
    method: 'get',
    name: 'Get Config',
    description: 'Retrieves a specific configuration.',
    bodyId: null,
    queryId: null,
    outputId: configTypeId
  },
  {
    id: 'endpoint_configs_create',
    controllerId: 'controller_configs',
    path: '/configs',
    allPaths: [{ path: '/configs', sdkPath: 'configs.create' }],
    method: 'post',
    name: 'Create Config',
    description: 'Creates a new provider configuration.',
    bodyId: configCreateBodyTypeId,
    queryId: null,
    outputId: configTypeId
  },
  {
    id: 'endpoint_configs_update',
    controllerId: 'controller_configs',
    path: '/configs/:providerConfigId',
    allPaths: [{ path: '/configs/:providerConfigId', sdkPath: 'configs.update' }],
    method: 'patch',
    name: 'Update Config',
    description: 'Updates an existing configuration.',
    bodyId: configUpdateBodyTypeId,
    queryId: null,
    outputId: configTypeId
  },
  {
    id: 'endpoint_configs_delete',
    controllerId: 'controller_configs',
    path: '/configs/:providerConfigId',
    allPaths: [{ path: '/configs/:providerConfigId', sdkPath: 'configs.delete' }],
    method: 'delete',
    name: 'Delete Config',
    description: 'Permanently deletes a configuration.',
    bodyId: null,
    queryId: null,
    outputId: configDeletedTypeId
  },

  // Config Vaults
  {
    id: 'endpoint_config_vaults_list',
    controllerId: 'controller_config_vaults',
    path: '/config-vaults',
    allPaths: [{ path: '/config-vaults', sdkPath: 'configVaults.list' }],
    method: 'get',
    name: 'List Config Vaults',
    description: 'Returns a paginated list of configuration vaults.',
    bodyId: null,
    queryId: configVaultQueryTypeId,
    outputId: configVaultListTypeId
  },
  {
    id: 'endpoint_config_vaults_get',
    controllerId: 'controller_config_vaults',
    path: '/config-vaults/:providerConfigVaultId',
    allPaths: [{ path: '/config-vaults/:providerConfigVaultId', sdkPath: 'configVaults.get' }],
    method: 'get',
    name: 'Get Config Vault',
    description: 'Retrieves a specific configuration vault.',
    bodyId: null,
    queryId: null,
    outputId: configVaultTypeId
  },
  {
    id: 'endpoint_config_vaults_create',
    controllerId: 'controller_config_vaults',
    path: '/config-vaults',
    allPaths: [{ path: '/config-vaults', sdkPath: 'configVaults.create' }],
    method: 'post',
    name: 'Create Config Vault',
    description: 'Creates a new configuration vault.',
    bodyId: configVaultCreateBodyTypeId,
    queryId: null,
    outputId: configVaultTypeId
  },
  {
    id: 'endpoint_config_vaults_update',
    controllerId: 'controller_config_vaults',
    path: '/config-vaults/:providerConfigVaultId',
    allPaths: [{ path: '/config-vaults/:providerConfigVaultId', sdkPath: 'configVaults.update' }],
    method: 'patch',
    name: 'Update Config Vault',
    description: 'Updates an existing vault.',
    bodyId: configVaultUpdateBodyTypeId,
    queryId: null,
    outputId: configVaultTypeId
  },
  {
    id: 'endpoint_config_vaults_delete',
    controllerId: 'controller_config_vaults',
    path: '/config-vaults/:providerConfigVaultId',
    allPaths: [{ path: '/config-vaults/:providerConfigVaultId', sdkPath: 'configVaults.delete' }],
    method: 'delete',
    name: 'Delete Config Vault',
    description: 'Permanently deletes a configuration vault.',
    bodyId: null,
    queryId: null,
    outputId: configVaultDeletedTypeId
  },

  // Auth Configs
  {
    id: 'endpoint_auth_configs_list',
    controllerId: 'controller_auth_configs',
    path: '/auth-configs',
    allPaths: [{ path: '/auth-configs', sdkPath: 'authConfigs.list' }],
    method: 'get',
    name: 'List Auth Configs',
    description: 'Returns a paginated list of authentication configurations.',
    bodyId: null,
    queryId: authConfigQueryTypeId,
    outputId: authConfigListTypeId
  },
  {
    id: 'endpoint_auth_configs_get',
    controllerId: 'controller_auth_configs',
    path: '/auth-configs/:providerAuthConfigId',
    allPaths: [{ path: '/auth-configs/:providerAuthConfigId', sdkPath: 'authConfigs.get' }],
    method: 'get',
    name: 'Get Auth Config',
    description: 'Retrieves a specific authentication configuration.',
    bodyId: null,
    queryId: null,
    outputId: authConfigTypeId
  },
  {
    id: 'endpoint_auth_configs_create',
    controllerId: 'controller_auth_configs',
    path: '/auth-configs',
    allPaths: [{ path: '/auth-configs', sdkPath: 'authConfigs.create' }],
    method: 'post',
    name: 'Create Auth Config',
    description: 'Creates a new authentication configuration.',
    bodyId: authConfigCreateBodyTypeId,
    queryId: null,
    outputId: authConfigTypeId
  },
  {
    id: 'endpoint_auth_configs_update',
    controllerId: 'controller_auth_configs',
    path: '/auth-configs/:providerAuthConfigId',
    allPaths: [{ path: '/auth-configs/:providerAuthConfigId', sdkPath: 'authConfigs.update' }],
    method: 'patch',
    name: 'Update Auth Config',
    description: 'Updates an existing authentication configuration.',
    bodyId: authConfigUpdateBodyTypeId,
    queryId: null,
    outputId: authConfigTypeId
  },
  {
    id: 'endpoint_auth_configs_delete',
    controllerId: 'controller_auth_configs',
    path: '/auth-configs/:providerAuthConfigId',
    allPaths: [{ path: '/auth-configs/:providerAuthConfigId', sdkPath: 'authConfigs.delete' }],
    method: 'delete',
    name: 'Delete Auth Config',
    description: 'Permanently deletes an authentication configuration.',
    bodyId: null,
    queryId: null,
    outputId: authConfigDeletedTypeId
  },

  // Auth Credentials
  {
    id: 'endpoint_auth_credentials_list',
    controllerId: 'controller_auth_credentials',
    path: '/auth-credentials',
    allPaths: [{ path: '/auth-credentials', sdkPath: 'authCredentials.list' }],
    method: 'get',
    name: 'List Auth Credentials',
    description: 'Returns a paginated list of authentication credentials.',
    bodyId: null,
    queryId: authCredentialsQueryTypeId,
    outputId: authCredentialsListTypeId
  },
  {
    id: 'endpoint_auth_credentials_get',
    controllerId: 'controller_auth_credentials',
    path: '/auth-credentials/:providerAuthCredentialsId',
    allPaths: [{ path: '/auth-credentials/:providerAuthCredentialsId', sdkPath: 'authCredentials.get' }],
    method: 'get',
    name: 'Get Auth Credentials',
    description: 'Retrieves specific authentication credentials.',
    bodyId: null,
    queryId: null,
    outputId: authCredentialsTypeId
  },
  {
    id: 'endpoint_auth_credentials_create',
    controllerId: 'controller_auth_credentials',
    path: '/auth-credentials',
    allPaths: [{ path: '/auth-credentials', sdkPath: 'authCredentials.create' }],
    method: 'post',
    name: 'Create Auth Credentials',
    description: 'Creates new authentication credentials.',
    bodyId: authCredentialsCreateBodyTypeId,
    queryId: null,
    outputId: authCredentialsTypeId
  },
  {
    id: 'endpoint_auth_credentials_update',
    controllerId: 'controller_auth_credentials',
    path: '/auth-credentials/:providerAuthCredentialsId',
    allPaths: [{ path: '/auth-credentials/:providerAuthCredentialsId', sdkPath: 'authCredentials.update' }],
    method: 'patch',
    name: 'Update Auth Credentials',
    description: 'Updates existing authentication credentials.',
    bodyId: authCredentialsUpdateBodyTypeId,
    queryId: null,
    outputId: authCredentialsTypeId
  },
  {
    id: 'endpoint_auth_credentials_delete',
    controllerId: 'controller_auth_credentials',
    path: '/auth-credentials/:providerAuthCredentialsId',
    allPaths: [{ path: '/auth-credentials/:providerAuthCredentialsId', sdkPath: 'authCredentials.delete' }],
    method: 'delete',
    name: 'Delete Auth Credentials',
    description: 'Permanently deletes authentication credentials.',
    bodyId: null,
    queryId: null,
    outputId: authCredentialsDeletedTypeId
  },

  // Setup Sessions
  {
    id: 'endpoint_setup_sessions_list',
    controllerId: 'controller_setup_sessions',
    path: '/setup-sessions',
    allPaths: [{ path: '/setup-sessions', sdkPath: 'setupSessions.list' }],
    method: 'get',
    name: 'List Setup Sessions',
    description: 'Returns a paginated list of setup sessions.',
    bodyId: null,
    queryId: setupSessionQueryTypeId,
    outputId: setupSessionListTypeId
  },
  {
    id: 'endpoint_setup_sessions_get',
    controllerId: 'controller_setup_sessions',
    path: '/setup-sessions/:providerSetupSessionId',
    allPaths: [{ path: '/setup-sessions/:providerSetupSessionId', sdkPath: 'setupSessions.get' }],
    method: 'get',
    name: 'Get Setup Session',
    description: 'Retrieves a specific setup session.',
    bodyId: null,
    queryId: null,
    outputId: setupSessionTypeId
  },
  {
    id: 'endpoint_setup_sessions_create',
    controllerId: 'controller_setup_sessions',
    path: '/setup-sessions',
    allPaths: [{ path: '/setup-sessions', sdkPath: 'setupSessions.create' }],
    method: 'post',
    name: 'Create Setup Session',
    description: 'Creates a new setup session.',
    bodyId: setupSessionCreateBodyTypeId,
    queryId: null,
    outputId: setupSessionTypeId
  },
  {
    id: 'endpoint_setup_sessions_update',
    controllerId: 'controller_setup_sessions',
    path: '/setup-sessions/:providerSetupSessionId',
    allPaths: [{ path: '/setup-sessions/:providerSetupSessionId', sdkPath: 'setupSessions.update' }],
    method: 'patch',
    name: 'Update Setup Session',
    description: 'Updates an existing setup session.',
    bodyId: setupSessionUpdateBodyTypeId,
    queryId: null,
    outputId: setupSessionTypeId
  },
  {
    id: 'endpoint_setup_sessions_delete',
    controllerId: 'controller_setup_sessions',
    path: '/setup-sessions/:providerSetupSessionId',
    allPaths: [{ path: '/setup-sessions/:providerSetupSessionId', sdkPath: 'setupSessions.delete' }],
    method: 'delete',
    name: 'Delete Setup Session',
    description: 'Deletes a setup session.',
    bodyId: null,
    queryId: null,
    outputId: setupSessionDeletedTypeId
  },

  // Auth Exports
  {
    id: 'endpoint_auth_exports_list',
    controllerId: 'controller_auth_exports',
    path: '/auth-exports',
    allPaths: [{ path: '/auth-exports', sdkPath: 'authExports.list' }],
    method: 'get',
    name: 'List Auth Exports',
    description: 'Returns a paginated list of auth export records.',
    bodyId: null,
    queryId: authExportQueryTypeId,
    outputId: authExportListTypeId
  },
  {
    id: 'endpoint_auth_exports_get',
    controllerId: 'controller_auth_exports',
    path: '/auth-exports/:providerAuthExportId',
    allPaths: [{ path: '/auth-exports/:providerAuthExportId', sdkPath: 'authExports.get' }],
    method: 'get',
    name: 'Get Auth Export',
    description: 'Retrieves a specific auth export record.',
    bodyId: null,
    queryId: null,
    outputId: authExportTypeId
  },
  {
    id: 'endpoint_auth_exports_create',
    controllerId: 'controller_auth_exports',
    path: '/auth-exports',
    allPaths: [{ path: '/auth-exports', sdkPath: 'authExports.create' }],
    method: 'post',
    name: 'Create Auth Export',
    description: 'Creates a new auth export.',
    bodyId: authExportCreateBodyTypeId,
    queryId: null,
    outputId: authExportWithValueTypeId
  },

  // Auth Imports
  {
    id: 'endpoint_auth_imports_list',
    controllerId: 'controller_auth_imports',
    path: '/auth-imports',
    allPaths: [{ path: '/auth-imports', sdkPath: 'authImports.list' }],
    method: 'get',
    name: 'List Auth Imports',
    description: 'Returns a paginated list of auth import records.',
    bodyId: null,
    queryId: authImportQueryTypeId,
    outputId: authImportListTypeId
  },
  {
    id: 'endpoint_auth_imports_get',
    controllerId: 'controller_auth_imports',
    path: '/auth-imports/:providerAuthImportId',
    allPaths: [{ path: '/auth-imports/:providerAuthImportId', sdkPath: 'authImports.get' }],
    method: 'get',
    name: 'Get Auth Import',
    description: 'Retrieves a specific auth import record.',
    bodyId: null,
    queryId: null,
    outputId: authImportTypeId
  },
  {
    id: 'endpoint_auth_imports_create',
    controllerId: 'controller_auth_imports',
    path: '/auth-imports',
    allPaths: [{ path: '/auth-imports', sdkPath: 'authImports.create' }],
    method: 'post',
    name: 'Create Auth Import',
    description: 'Creates a new auth import.',
    bodyId: authImportCreateBodyTypeId,
    queryId: null,
    outputId: authImportTypeId
  }
];

export let apiDefinition = {
  version: '1.0',
  controllers,
  endpoints,
  types
};
