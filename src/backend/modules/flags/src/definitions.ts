import { MachineAccess, Organization, User } from '@metorial/db';

export type Flags = {
  'test-flag': boolean;

  'metorial-gateway-enabled': boolean;
  'custom-servers-remote-enabled': boolean;
  'custom-providers-enabled': boolean;
  'provider-oauth-enabled': boolean;
  'managed-servers-enabled': boolean;
  'community-profiles-enabled': boolean;
  'magic-mcp-enabled': boolean;
  'callbacks-enabled': boolean;
  'identity-management': boolean;

  'paid-oauth-import': boolean;
  'paid-oauth-export': boolean;
  'paid-oauth-takeout': boolean;
  'paid-callbacks': boolean;
  'paid-custom-providers': boolean;
  'paid-custom-servers': boolean;
  'paid-custom-docker-providers': boolean;
  'paid-custom-docker-servers': boolean;
  'paid-identity': boolean;
  'paid-advanced-security': boolean;
  'paid-advanced-roles': boolean;
  'paid-audit-logs': boolean;
  'paid-magic-mcp-groups': boolean;
  'paid-sso-tenants': boolean;
  'paid-portals': boolean;
};

export let defaultFlags: Flags = {
  'test-flag': false,

  'metorial-gateway-enabled': false,
  'custom-servers-remote-enabled': false,
  'custom-providers-enabled': false,
  'provider-oauth-enabled': false,
  'managed-servers-enabled': false,
  'community-profiles-enabled': false,
  'magic-mcp-enabled': false,
  'callbacks-enabled': false,
  'identity-management': false,

  'paid-oauth-import': true,
  'paid-oauth-export': true,
  'paid-oauth-takeout': true,
  'paid-callbacks': true,
  'paid-custom-providers': true,
  'paid-custom-servers': true,
  'paid-custom-docker-providers': true,
  'paid-custom-docker-servers': true,
  'paid-identity': true,
  'paid-advanced-security': true,
  'paid-advanced-roles': true,
  'paid-audit-logs': true,
  'paid-magic-mcp-groups': true,
  'paid-sso-tenants': true,
  'paid-portals': true
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
