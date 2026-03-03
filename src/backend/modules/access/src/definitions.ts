export let instanceScopes = [
  'instance.file:read' as const,
  'instance.file:write' as const,
  'instance.file_link:read' as const,
  'instance.file_link:write' as const,

  'instance.secret:read' as const,
  'instance.secret:write' as const,

  'instance.server:read' as const,
  'instance.server:write' as const,

  'instance.server_listing:read' as const,

  'instance.server.implementation:read' as const,
  'instance.server.implementation:write' as const,

  'instance.server.deployment:read' as const,
  'instance.server.deployment:write' as const,

  'instance.session:read' as const,
  'instance.session:write' as const,

  'instance.server.server_run:read' as const,
  'instance.server.server_error:read' as const,

  'instance.provider_oauth.connection:read' as const,
  'instance.provider_oauth.connection:write' as const,

  'instance.provider_oauth.session:read' as const,
  'instance.provider_oauth.session:write' as const,

  'instance.provider_oauth.connection.authentication:read' as const,
  'instance.provider_oauth.connection.event:read' as const,
  'instance.provider_oauth.connection.profile:read' as const,

  'instance.provider_oauth.takeout:read' as const,
  'instance.provider_oauth.takeout:write' as const,

  'instance.provider_oauth.takeIn:read' as const,
  'instance.provider_oauth.takeIn:write' as const,

  'instance.custom_server:read' as const,
  'instance.custom_server:write' as const,

  'instance.callback:read' as const,
  'instance.callback:write' as const,

  'instance.server.config_vault:read' as const,
  'instance.server.config_vault:write' as const,

  'instance.ssoTenant:read' as const,
  'instance.ssoTenant:write' as const,

  'instance.portal:read' as const,
  'instance.portal:write' as const,

  'instance.portal.access:read' as const,
  'instance.portal.access:write' as const,

  'instance.portal.consumers:read' as const,
  'instance.portal.consumers:write' as const,

  'instance.portal.auth:read' as const,
  'instance.portal.auth:write' as const,

  'instance.portal.server_requests:read' as const,
  'instance.portal.server_requests:write' as const,

  'instance.portal.featured_servers:read' as const,
  'instance.portal.featured_servers:write' as const,

  'instance.provider:read' as const,
  'instance.provider:write' as const,

  'instance.provider.deployment:read' as const,
  'instance.provider.deployment:write' as const,

  'instance.provider.auth:read' as const,
  'instance.provider.auth:write' as const,
  'instance.provider.auth:export' as const,
  'instance.provider.auth:import' as const,

  'instance.provider.session:read' as const,
  'instance.provider.session:write' as const,

  'instance.provider.config:read' as const,
  'instance.provider.config:write' as const,
  'instance.provider.config_vault:read' as const,
  'instance.provider.config_vault:write' as const,

  'instance.provider.group:read' as const,
  'instance.provider.group:write' as const,

  'instance.provider.specification:read' as const,
  'instance.provider.category:read' as const,
  'instance.provider.collection:read' as const,
  'instance.provider.listing:read' as const,
  'instance.provider.publisher:read' as const,
  'instance.provider.tool:read' as const,
  'instance.provider.version:read' as const,

  'instance.provider.custom:read' as const,
  'instance.provider.custom:write' as const,
  'instance.provider.custom.version:read' as const,
  'instance.provider.custom.version:write' as const,
  'instance.provider.custom.environment:read' as const,
  'instance.provider.custom.deployment:read' as const,
  'instance.provider.custom.commit:read' as const,
  'instance.provider.custom.commit:write' as const,
  'instance.provider.custom.code:read' as const,
  'instance.provider.custom.code:write' as const,

  'instance.scm.account:read' as const,
  'instance.scm.installation:read' as const,
  'instance.scm.installation:write' as const,
  'instance.scm.repo:read' as const,
  'instance.scm.repo:write' as const
] satisfies readonly `instance.${string}`[];

export let consumerScopes = [
  'consumer#instance.magic_mcp:read' as const,
  'consumer#instance.magic_mcp:write' as const,

  'consumer#instance.server_template:read' as const,

  'consumer#instance.oauth_session:read' as const,
  'consumer#instance.oauth_session:write' as const
] satisfies readonly `consumer#instance.${string}`[];

let coreScopesRaw = [
  'user:read' as const,
  'user:write' as const,

  'organization:read' as const,
  'organization:write' as const,

  'organization.invite:read' as const,
  'organization.invite:write' as const,

  'organization.project:read' as const,
  'organization.project:write' as const,

  'organization.member:read' as const,
  'organization.member:write' as const,

  'organization.instance:read' as const,
  'organization.instance:write' as const,

  'organization.team:read' as const,
  'organization.team:write' as const,

  'organization.team.role:read' as const,
  'organization.team.role:write' as const,

  // 'organization.machine_access.api_key.organization:read' as const,
  // 'organization.machine_access.api_key.organization:write' as const,
  // 'organization.machine_access.api_key.instance:read' as const,
  // 'organization.machine_access.api_key.instance:write' as const

  ...instanceScopes
] as const satisfies readonly (
  | `organization.${string}`
  | `organization:${string}`
  | `user.${string}`
  | `user:${string}`
  | `instance.${string}`
)[];

let scopeRaw = [...coreScopesRaw, ...consumerScopes] as const satisfies readonly (
  | `organization.${string}`
  | `organization:${string}`
  | `user.${string}`
  | `user:${string}`
  | `instance.${string}`
  | `consumer#instance.${string}`
)[];

export type Scope = (typeof scopeRaw)[number];

export let scopes: Scope[] = [...scopeRaw];

export type ScopeDefinition = {
  identifier: Scope;
  name: string;
  description: string;
  dependencies: Scope[];
};

let scopeResourceMetadata: Record<
  string,
  { name: string; description: string }
> = {
  user: {
    name: 'Users',
    description: 'These endpoints manage user profile and account data.'
  },
  organization: {
    name: 'Organizations',
    description: 'These endpoints manage organizations and their top-level settings.'
  },
  'organization.invite': {
    name: 'Organization Invites',
    description: 'These endpoints create and manage organization invitations.'
  },
  'organization.project': {
    name: 'Organization Projects',
    description: 'These endpoints manage projects inside an organization.'
  },
  'organization.member': {
    name: 'Organization Members',
    description: 'These endpoints manage organization membership and member state.'
  },
  'organization.instance': {
    name: 'Organization Instances',
    description: 'These endpoints manage instance records that belong to an organization.'
  },
  'organization.team': {
    name: 'Organization Teams',
    description: 'These endpoints manage team records and assignments.'
  },
  'organization.team.role': {
    name: 'Team Roles',
    description: 'These endpoints manage team role definitions and permissions.'
  },
  'instance.file': {
    name: 'Instance Files',
    description: 'These endpoints manage files uploaded within an instance.'
  },
  'instance.file_link': {
    name: 'Instance File Links',
    description: 'These endpoints manage file link records and access links.'
  },
  'instance.secret': {
    name: 'Instance Secrets',
    description: 'These endpoints manage instance-level secret values.'
  },
  'instance.server': {
    name: 'Servers',
    description: 'These endpoints manage server entities for an instance.'
  },
  'instance.server_listing': {
    name: 'Server Listings',
    description: 'These endpoints read server listings available to an instance.'
  },
  'instance.server.implementation': {
    name: 'Server Implementations',
    description: 'These endpoints manage server implementation details.'
  },
  'instance.server.deployment': {
    name: 'Server Deployments',
    description: 'These endpoints manage server deployments and deployment state.'
  },
  'instance.session': {
    name: 'Sessions',
    description: 'These endpoints manage session records and session lifecycle.'
  },
  'instance.server.server_run': {
    name: 'Server Runs',
    description: 'These endpoints read server run execution data.'
  },
  'instance.server.server_error': {
    name: 'Server Errors',
    description: 'These endpoints read grouped server error records.'
  },
  'instance.provider_oauth.connection': {
    name: 'Provider OAuth Connections',
    description: 'These endpoints manage OAuth connections to external provider accounts.'
  },
  'instance.provider_oauth.session': {
    name: 'Provider OAuth Sessions',
    description: 'These endpoints manage OAuth setup and callback sessions.'
  },
  'instance.provider_oauth.connection.authentication': {
    name: 'OAuth Connection Authentications',
    description: 'These endpoints expose authentication entries for OAuth connections.'
  },
  'instance.provider_oauth.connection.event': {
    name: 'OAuth Connection Events',
    description: 'These endpoints expose lifecycle and audit events for OAuth connections.'
  },
  'instance.provider_oauth.connection.profile': {
    name: 'OAuth Connection Profiles',
    description: 'These endpoints expose provider account profiles linked through OAuth.'
  },
  'instance.provider_oauth.takeout': {
    name: 'OAuth Takeout',
    description: 'These endpoints export OAuth credentials and related data.'
  },
  'instance.provider_oauth.takeIn': {
    name: 'OAuth Take-In',
    description: 'These endpoints import OAuth credentials and related data.'
  },
  'instance.custom_server': {
    name: 'Custom Servers',
    description: 'These endpoints manage custom server definitions in an instance.'
  },
  'instance.callback': {
    name: 'Callbacks',
    description: 'These endpoints manage callback registrations and callback processing.'
  },
  'instance.server.config_vault': {
    name: 'Server Config Vaults',
    description: 'These endpoints manage secure server configuration vault values.'
  },
  'instance.ssoTenant': {
    name: 'SSO Tenants',
    description: 'These endpoints manage SSO tenant configuration and setup.'
  },
  'instance.portal': {
    name: 'Portal',
    description: 'These endpoints manage portal-level configuration for an instance.'
  },
  'instance.portal.access': {
    name: 'Portal Access',
    description: 'These endpoints manage portal access rules and grants.'
  },
  'instance.portal.consumers': {
    name: 'Portal Consumers',
    description: 'These endpoints manage portal consumer entities and assignments.'
  },
  'instance.portal.auth': {
    name: 'Portal Authentication',
    description: 'These endpoints manage portal authentication and login behavior.'
  },
  'instance.portal.server_requests': {
    name: 'Portal Server Requests',
    description: 'These endpoints manage server request flows in the portal.'
  },
  'instance.portal.featured_servers': {
    name: 'Portal Featured Servers',
    description: 'These endpoints manage featured server listings in the portal.'
  },
  'instance.provider': {
    name: 'Providers',
    description: 'These endpoints list and read provider records.'
  },
  'instance.provider.deployment': {
    name: 'Provider Deployments',
    description: 'These endpoints manage provider deployment lifecycle and state.'
  },
  'instance.provider.auth': {
    name: 'Provider Authentication',
    description: 'These endpoints manage provider authentication config and credentials.'
  },
  'instance.provider.session': {
    name: 'Provider Sessions',
    description: 'These endpoints manage provider sessions, session events, and session artifacts.'
  },
  'instance.provider.config': {
    name: 'Provider Configs',
    description: 'These endpoints manage provider configuration records and schemas.'
  },
  'instance.provider.config_vault': {
    name: 'Provider Config Vaults',
    description: 'These endpoints manage stored provider configuration secrets.'
  },
  'instance.provider.group': {
    name: 'Provider Groups',
    description: 'These endpoints manage custom provider grouping and membership.'
  },
  'instance.provider.specification': {
    name: 'Provider Specifications',
    description: 'These endpoints read provider specifications, tools, and auth method definitions.'
  },
  'instance.provider.category': {
    name: 'Provider Categories',
    description: 'These endpoints read provider category taxonomy.'
  },
  'instance.provider.collection': {
    name: 'Provider Collections',
    description: 'These endpoints read provider collection groupings.'
  },
  'instance.provider.listing': {
    name: 'Provider Listings',
    description: 'These endpoints list and read provider marketplace listings.'
  },
  'instance.provider.publisher': {
    name: 'Provider Publishers',
    description: 'These endpoints read provider publisher information.'
  },
  'instance.provider.tool': {
    name: 'Provider Tools',
    description: 'These endpoints read provider tool definitions.'
  },
  'instance.provider.version': {
    name: 'Provider Versions',
    description: 'These endpoints list and read provider versions.'
  },
  'instance.provider.custom': {
    name: 'Custom Providers',
    description: 'These endpoints create, update, and read custom provider definitions.'
  },
  'instance.provider.custom.version': {
    name: 'Custom Provider Versions',
    description: 'These endpoints create and read custom provider versions.'
  },
  'instance.provider.custom.environment': {
    name: 'Custom Provider Environments',
    description: 'These endpoints read custom provider environments.'
  },
  'instance.provider.custom.deployment': {
    name: 'Custom Provider Deployments',
    description: 'These endpoints read custom provider deployments and deployment logs.'
  },
  'instance.provider.custom.commit': {
    name: 'Custom Provider Commits',
    description: 'These endpoints create and read custom provider commits.'
  },
  'instance.provider.custom.code': {
    name: 'Custom Provider Code',
    description: 'These endpoints grant access to custom provider code editing.'
  },
  'instance.scm.account': {
    name: 'SCM Accounts',
    description: 'These endpoints preview source control accounts for installations.'
  },
  'instance.scm.installation': {
    name: 'SCM Installations',
    description: 'These endpoints list and create SCM installations.'
  },
  'instance.scm.repo': {
    name: 'SCM Repositories',
    description: 'These endpoints preview and create SCM repository links.'
  },
  'consumer#instance.magic_mcp': {
    name: 'Consumer Magic MCP',
    description: 'These endpoints manage consumer access to Magic MCP functionality.'
  },
  'consumer#instance.server_template': {
    name: 'Consumer Server Templates',
    description: 'These endpoints expose server template access for consumers.'
  },
  'consumer#instance.oauth_session': {
    name: 'Consumer OAuth Sessions',
    description: 'These endpoints manage OAuth sessions on the consumer side.'
  }
};

let scopeActionMetadata: Record<string, { name: string; description: string }> = {
  read: {
    name: 'Read',
    description: 'It allows read-only access.'
  },
  write: {
    name: 'Write',
    description: 'It allows creating, updating, and deleting data.'
  },
  export: {
    name: 'Export',
    description: 'It allows exporting data out of the platform.'
  },
  import: {
    name: 'Import',
    description: 'It allows importing data into the platform.'
  }
};

let toTitleCase = (value: string) =>
  value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map(word => word[0]!.toUpperCase() + word.slice(1))
    .join(' ');

let getScopeDependencies = (identifier: Scope): Scope[] => {
  let [resource, actionRaw] = identifier.split(':') as [string, string];
  let action = actionRaw || 'read';
  if (action !== 'write') return [];

  return [`${resource}:read` as Scope];
};

let getScopeDefinition = (identifier: Scope): ScopeDefinition => {
  let [resource, actionRaw] = identifier.split(':') as [string, string];
  let action = actionRaw || 'read';
  let resourceMeta = scopeResourceMetadata[resource] || {
    name: toTitleCase(resource),
    description: `These endpoints manage ${resource}.`
  };
  let actionMeta = scopeActionMetadata[action] || {
    name: toTitleCase(action),
    description: `It allows ${action} access.`
  };

  return {
    identifier,
    name: `${resourceMeta.name} (${actionMeta.name})`,
    description: `${actionMeta.description} ${resourceMeta.description}`,
    dependencies: getScopeDependencies(identifier)
  };
};

export let scopeDefinitions: ScopeDefinition[] = scopes.map(getScopeDefinition);

let scopeIdentifierSet = new Set(scopes);
let invalidScopeDependencies = scopeDefinitions.flatMap(scope =>
  scope.dependencies
    .filter(dependency => !scopeIdentifierSet.has(dependency))
    .map(dependency => ({ scope: scope.identifier, dependency }))
);

if (invalidScopeDependencies.length > 0) {
  let details = invalidScopeDependencies
    .map(item => `${item.scope} -> ${item.dependency}`)
    .join(', ');
  throw new Error(`Invalid scope dependencies detected: ${details}`);
}

export let instanceScopeDefinitions: ScopeDefinition[] = scopeDefinitions.filter(scope =>
  scope.identifier.startsWith('instance.')
);

let allScopesExcept = (except: Scope[]) => coreScopesRaw.filter(s => !except.includes(s));

export let orgManagementTokenScopes: Scope[] = allScopesExcept(['user:read', 'user:write']);

export let instanceSecretTokenScopes: Scope[] = [
  'organization:read' as const,
  'organization.project:read' as const,
  'organization.instance:read' as const,

  'instance.file:read' as const,
  'instance.file:write' as const,
  'instance.file_link:read' as const,
  'instance.file_link:write' as const,

  'instance.secret:read' as const,
  'instance.secret:write' as const,

  'instance.server:read' as const,
  'instance.server:write' as const,

  'instance.server_listing:read' as const,

  'instance.server.implementation:read' as const,
  'instance.server.implementation:write' as const,

  'instance.server.deployment:read' as const,
  'instance.server.deployment:write' as const,

  'instance.session:read' as const,
  'instance.session:write' as const,

  'instance.server.server_run:read' as const,
  'instance.server.server_error:read' as const,

  'instance.provider_oauth.connection:read' as const,
  'instance.provider_oauth.connection:write' as const,

  'instance.provider_oauth.session:read' as const,
  'instance.provider_oauth.session:write' as const,

  'instance.provider_oauth.connection.authentication:read' as const,
  'instance.provider_oauth.connection.event:read' as const,
  'instance.provider_oauth.connection.profile:read' as const,

  'instance.provider_oauth.takeout:read' as const,
  'instance.provider_oauth.takeout:write' as const,

  'instance.provider_oauth.takeIn:read' as const,
  'instance.provider_oauth.takeIn:write' as const,

  'instance.callback:read' as const,
  'instance.callback:write' as const,

  'instance.server.config_vault:read' as const,
  'instance.server.config_vault:write' as const,

  'instance.ssoTenant:read' as const,
  'instance.ssoTenant:write' as const,

  'instance.portal:read' as const,
  'instance.portal:write' as const,

  'instance.portal.access:read' as const,
  'instance.portal.access:write' as const,

  'instance.portal.consumers:read' as const,
  'instance.portal.consumers:write' as const,

  'instance.portal.auth:read' as const,
  'instance.portal.auth:write' as const,

  'instance.portal.server_requests:read' as const,
  'instance.portal.server_requests:write' as const,

  'instance.portal.featured_servers:read' as const,
  'instance.portal.featured_servers:write' as const,

  'instance.provider:read' as const,
  'instance.provider:write' as const,

  'instance.provider.deployment:read' as const,
  'instance.provider.deployment:write' as const,

  'instance.provider.auth:read' as const,
  'instance.provider.auth:write' as const,
  'instance.provider.auth:export' as const,
  'instance.provider.auth:import' as const,

  'instance.provider.session:read' as const,
  'instance.provider.session:write' as const,

  'instance.provider.config:read' as const,
  'instance.provider.config:write' as const,
  'instance.provider.config_vault:read' as const,
  'instance.provider.config_vault:write' as const,

  'instance.provider.group:read' as const,
  'instance.provider.group:write' as const,

  'instance.provider.specification:read' as const,
  'instance.provider.category:read' as const,
  'instance.provider.collection:read' as const,
  'instance.provider.listing:read' as const,
  'instance.provider.publisher:read' as const,
  'instance.provider.tool:read' as const,
  'instance.provider.version:read' as const,

  'instance.provider.custom:read' as const,
  'instance.provider.custom:write' as const,
  'instance.provider.custom.version:read' as const,
  'instance.provider.custom.version:write' as const,
  'instance.provider.custom.environment:read' as const,
  'instance.provider.custom.deployment:read' as const,
  'instance.provider.custom.commit:read' as const,
  'instance.provider.custom.commit:write' as const,
  'instance.provider.custom.code:read' as const,
  'instance.provider.custom.code:write' as const,

  'instance.scm.account:read' as const,
  'instance.scm.installation:read' as const,
  'instance.scm.installation:write' as const,
  'instance.scm.repo:read' as const,
  'instance.scm.repo:write' as const
];

export let instancePublishableTokenScopes: Scope[] = [
  'organization.instance:read' as const,

  'instance.server_listing:read' as const,
  'instance.portal:read' as const,
  'instance.portal.access:read' as const,
  'instance.server:read' as const
];

export let instancePublishableTokenWithConsumerScopes: Scope[] = [
  'organization.instance:read' as const,

  'instance.server_listing:read' as const,
  'instance.portal:read' as const,
  'instance.portal.access:read' as const,
  'instance.server:read' as const,

  ...consumerScopes
];
