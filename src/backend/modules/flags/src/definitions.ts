import { MachineAccess, Organization, User } from '@metorial/db';

export type Flags = {
  'test-flag': boolean;

  // Metorial Gateway
  'metorial-gateway-enabled': boolean;
  'custom-servers-remote-enabled': boolean;
  'provider-oauth-enabled': boolean;
  'managed-servers-enabled': boolean;
  'community-profiles-enabled': boolean;
  'magic-mcp-enabled'?: boolean;
};

export let defaultFlags: Flags = {
  'test-flag': false,

  // Metorial Gateway
  'metorial-gateway-enabled': true,
  'custom-servers-remote-enabled': true,
  'provider-oauth-enabled': true,
  'managed-servers-enabled': false,
  'community-profiles-enabled': false,
  'magic-mcp-enabled': false
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
