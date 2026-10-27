import { MachineAccess, Organization, Project, User } from '@metorial/db';

export type DisabledFlag = {
  enabled: false;
  reason: string;
};

export type FlagValue = boolean | DisabledFlag;

export type Flags = {
  'test-flag': FlagValue;

  'metorial-gateway-enabled': FlagValue;
  'custom-providers-enabled': FlagValue;
  'magic-mcp-enabled': FlagValue;
  'callbacks-enabled': FlagValue;
  'chat-enabled': FlagValue;
  'webhooks-enabled': FlagValue;
  'identity-management': FlagValue;
  'portals-access': FlagValue;
  'skills-enabled': FlagValue;
  'assistant-enabled': FlagValue;
  'advanced-security-management-enabled': FlagValue;
  'networking-enabled': FlagValue;
  'sandbox-enabled': FlagValue;
  'public-mcp-servers-enabled': FlagValue;
  outposts: FlagValue;

  'paid-oauth-import': FlagValue;
  'paid-oauth-export': FlagValue;
  'paid-callbacks': FlagValue;
  'paid-custom-providers': FlagValue;
  'paid-custom-docker-providers': FlagValue;
  'paid-identity': FlagValue;
  'paid-advanced-security': FlagValue;
  'paid-advanced-roles': FlagValue;
  'paid-audit-logs': FlagValue;
  'paid-audit-log-streams': FlagValue;
  'paid-project-reduced-data-retention': FlagValue;
  'paid-magic-mcp-groups': FlagValue;
  'paid-sso-tenants': FlagValue;
  'paid-portals': FlagValue;
  'paid-key-providers': FlagValue;
  'paid-networking': FlagValue;
  'paid-network-ip-access': FlagValue;
  'paid-sandboxes': FlagValue;
  'paid-advanced-org-management': FlagValue;

  'sandbox-builder-memory-mib': number;
  'sandbox-max-memory-gib': number;
  'sandbox-max-vcpus': number;
};

export type BooleanFlagKey = {
  [K in keyof Flags]: Flags[K] extends number ? never : K;
}[keyof Flags];

export let disabledFlag = (reason: string): DisabledFlag => ({ enabled: false, reason });

export let isFlagEnabled = (flag: FlagValue) => flag === true;

export let getFlagDisabledReason = (flag: FlagValue) =>
  typeof flag == 'object' ? flag.reason : undefined;

export let defaultFlags: Flags = {
  'test-flag': false,

  'metorial-gateway-enabled': false,
  'custom-providers-enabled': false,
  'magic-mcp-enabled': false,
  'callbacks-enabled': false,
  'chat-enabled': false,
  'webhooks-enabled': false,
  'portals-access': false,
  'identity-management': false,
  'skills-enabled': false,
  'assistant-enabled': false,
  'advanced-security-management-enabled': false,
  'networking-enabled': false,
  'sandbox-enabled': false,
  'public-mcp-servers-enabled': false,
  outposts: false,

  'paid-oauth-import': true,
  'paid-oauth-export': true,
  'paid-callbacks': true,
  'paid-custom-providers': true,
  'paid-custom-docker-providers': true,
  'paid-identity': true,
  'paid-advanced-security': true,
  'paid-advanced-roles': true,
  'paid-audit-logs': true,
  'paid-audit-log-streams': true,
  'paid-project-reduced-data-retention': true,
  'paid-magic-mcp-groups': true,
  'paid-sso-tenants': true,
  'paid-portals': true,
  'paid-key-providers': true,
  'paid-networking': true,
  'paid-network-ip-access': true,
  'paid-sandboxes': true,
  'paid-advanced-org-management': true,

  'sandbox-builder-memory-mib': 8192,
  'sandbox-max-memory-gib': 32,
  'sandbox-max-vcpus': 16
};

export type FlagProviderParams = {
  organization: Organization;
  project?: Project;
  user?: User;
  machineAccess?: MachineAccess;
};

export let applyEnabledFlags = (flags: Flags, enabled: string | undefined): Flags => {
  let names = new Set(
    (enabled ?? '')
      .split(',')
      .map(name => name.trim())
      .filter(Boolean)
  );
  if (names.size === 0) return flags;

  let result: Record<string, unknown> = { ...flags };
  for (let [name, value] of Object.entries(flags)) {
    if (typeof value === 'number') continue;
    if (names.has('*') || names.has(name)) result[name] = true;
  }
  return result as Flags;
};

let flagProviderRef = {
  current: async (params: FlagProviderParams) =>
    applyEnabledFlags(defaultFlags, process.env.METORIAL_ENABLED_FLAGS)
};

export let setFlagProvider = (provider: (params: FlagProviderParams) => Promise<Flags>) => {
  flagProviderRef.current = provider;
};

export let getFlags = (params: FlagProviderParams): Promise<Flags> => {
  return flagProviderRef.current(params);
};
