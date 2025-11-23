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
  'instance.portal.featured_servers:write' as const
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
  'instance.portal.featured_servers:write' as const
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
