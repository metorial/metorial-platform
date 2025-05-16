let scopeRaw = [
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
  'instance.server.deployment:write' as const

  // 'organization.machine_access.api_key.organization:read' as const,
  // 'organization.machine_access.api_key.organization:write' as const,
  // 'organization.machine_access.api_key.instance:read' as const,
  // 'organization.machine_access.api_key.instance:write' as const
] as const satisfies readonly (
  | `organization.${string}`
  | `organization:${string}`
  | `user.${string}`
  | `user:${string}`
  | `instance.${string}`
)[];

export type Scope = (typeof scopeRaw)[number];

export let scopes: Scope[] = [...scopeRaw];

let allScopesExcept = (except: Scope[]) => scopes.filter(s => !except.includes(s));

export let orgManagementTokenScopes: Scope[] = allScopesExcept(['user:read', 'user:write']);
export let instanceSecretTokenScopes: Scope[] = [
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
  'instance.server.deployment:write' as const
];

export let instancePublishableTokenScopes: Scope[] = ['instance.server_listing:read' as const];
