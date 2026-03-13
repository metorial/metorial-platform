import { MachineAccess, Organization, User } from '@metorial/db';

export type Flags = {
  'test-flag': boolean;

  'metorial-gateway-enabled': boolean;
  'custom-servers-remote-enabled': boolean;
  'provider-oauth-enabled': boolean;
  'managed-servers-enabled': boolean;
  'community-profiles-enabled': boolean;
  'magic-mcp-enabled': boolean;
  'callbacks-enabled': boolean;
  'identity-management': boolean;

  'paid-oauth-takeout': boolean;
  'paid-callbacks': boolean;
  'paid-custom-servers': boolean;
  'paid-identity': boolean;
  'paid-advanced-security': boolean;
  'paid-advanced-roles': boolean;
  'paid-audit-logs': boolean;
  'paid-magic-mcp-groups': boolean;
  'paid-sso-tenants': boolean;
  'paid-portals': boolean;
  'paid-custom-docker-servers': boolean;
};

export let defaultFlags: Flags = {
  'test-flag': false,

  'metorial-gateway-enabled': true,
  'custom-servers-remote-enabled': true,
  'provider-oauth-enabled': true,
  'managed-servers-enabled': true,
  'community-profiles-enabled': true,
  'magic-mcp-enabled': true,
  'callbacks-enabled': true,
  'identity-management': true,

  'paid-oauth-takeout': true,
  'paid-callbacks': true,
  'paid-custom-servers': true,
  'paid-identity': true,
  'paid-advanced-security': true,
  'paid-advanced-roles': true,
  'paid-audit-logs': true,
  'paid-magic-mcp-groups': true,
  'paid-sso-tenants': true,
  'paid-portals': true,
  'paid-custom-docker-servers': true
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
