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
  'paid-advanced-org-management': FlagValue;
};

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
  'paid-advanced-org-management': true
};

export type FlagProviderParams = {
  organization: Organization;
  project?: Project;
  user?: User;
  machineAccess?: MachineAccess;
};
let flagProviderRef = { current: async (params: FlagProviderParams) => defaultFlags };

export let setFlagProvider = (provider: (params: FlagProviderParams) => Promise<Flags>) => {
  flagProviderRef.current = provider;
};

export let getFlags = (params: FlagProviderParams): Promise<Flags> => {
  return flagProviderRef.current(params);
};
