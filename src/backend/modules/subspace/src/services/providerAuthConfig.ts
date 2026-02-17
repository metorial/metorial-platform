import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderAuthConfigService = createSubspaceService(
  subspace.providerAuthConfig,
  ['get', 'list', 'update', 'create'],
  () => ({})
);

export type ProviderAuthConfig = Awaited<ReturnType<typeof subspace.providerAuthConfig.get>>;
