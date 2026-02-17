import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderConfigVaultService = createSubspaceService(
  subspace.providerConfigVault,
  ['get', 'list', 'update', 'create'],
  () => ({})
);

export type ProviderConfigVault = Awaited<ReturnType<typeof subspace.providerConfigVault.get>>;
