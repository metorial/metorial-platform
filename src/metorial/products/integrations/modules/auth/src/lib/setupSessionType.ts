import type {
  ProviderSetupSession,
  ProviderSetupSessionTypeConcrete
} from '@metorial-subspace/db';

export let sessionTypeSkipsConfig = (
  type: ProviderSetupSessionTypeConcrete | null | undefined
) => type === 'auth_only' || type === 'admin';

export let isAdminSetupSession = (
  setupSession: Pick<ProviderSetupSession, 'typeSelected' | 'typeConcrete'>
) => setupSession.typeSelected === 'admin' || setupSession.typeConcrete === 'admin';
