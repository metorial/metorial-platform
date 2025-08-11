import { MachineAccess, Organization, User } from '@metorial/db';

export type Flags = {
  'test-flag': boolean;

  // Metorial Gateway
  'metorial-gateway-enabled': boolean;
  'custom-servers-remote-enabled': boolean;
  'provider-oauth-enabled': boolean;
};

export let defaultFlags: Flags = {
  'test-flag': false,

  // Metorial Gateway
  'metorial-gateway-enabled': true,
  'custom-servers-remote-enabled': true,
  'provider-oauth-enabled': true
};

export type FlagProviderParams = {
  organization: Organization;
  user?: User;
  machineAccess?: MachineAccess;
};
let flagProviderRef = { current: (params: FlagProviderParams) => defaultFlags };

export let setFlagProvider = (provider: (params: FlagProviderParams) => Flags) => {
  flagProviderRef.current = provider;
};

export let getFlags = (params: FlagProviderParams): Flags => {
  return flagProviderRef.current(params);
};
