import { MachineAccess, Organization, User } from '@metorial/db';

export type Flags = {
  'test-flag': boolean;

  'metorial-gateway-enabled': boolean;
  'custom-providers-enabled': boolean;
  'magic-mcp-enabled': boolean;
  'callbacks-enabled': boolean;
  'identity-management': boolean;
  'portals-access': boolean;
  'skills-enabled': boolean;
  'advanced-security-management-enabled': boolean;
  'networking-enabled': boolean;

  'paid-oauth-import': boolean;
  'paid-oauth-export': boolean;
  'paid-callbacks': boolean;
  'paid-custom-providers': boolean;
  'paid-custom-docker-providers': boolean;
  'paid-identity': boolean;
  'paid-advanced-security': boolean;
  'paid-advanced-roles': boolean;
  'paid-audit-logs': boolean;
  'paid-magic-mcp-groups': boolean;
  'paid-sso-tenants': boolean;
  'paid-portals': boolean;
  'paid-key-providers': boolean;
  'paid-networking': boolean;
};

export let defaultFlags: Flags = {
  'test-flag': false,

  'metorial-gateway-enabled': false,
  'custom-providers-enabled': false,
  'magic-mcp-enabled': false,
  'callbacks-enabled': false,
  'portals-access': false,
  'identity-management': false,
  'skills-enabled': false,
  'advanced-security-management-enabled': false,
  'networking-enabled': false,

  'paid-oauth-import': true,
  'paid-oauth-export': true,
  'paid-callbacks': true,
  'paid-custom-providers': true,
  'paid-custom-docker-providers': true,
  'paid-identity': true,
  'paid-advanced-security': true,
  'paid-advanced-roles': true,
  'paid-audit-logs': true,
  'paid-magic-mcp-groups': true,
  'paid-sso-tenants': true,
  'paid-portals': true,
  'paid-key-providers': true,
  'paid-networking': false
};

export type FlagProviderParams = {
  organization: Organization;
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
