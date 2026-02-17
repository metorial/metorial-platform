import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderOAuthSetupService = createSubspaceService(
  subspace.providerOAuthSetup,
  ['get', 'list', 'create', 'update'],
  () => ({})
);

export type ProviderOAuthSetup = Awaited<ReturnType<typeof subspace.providerOAuthSetup.get>>;
