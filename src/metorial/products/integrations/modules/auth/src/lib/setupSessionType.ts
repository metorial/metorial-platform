import type { ProviderSetupSessionTypeConcrete } from '@metorial-subspace/db';

export let sessionTypeSkipsConfig = (
  type: ProviderSetupSessionTypeConcrete | null | undefined
) => type === 'auth_only' || type === 'admin';
