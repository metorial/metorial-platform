import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderService = createSubspaceService(
  subspace.provider,
  ['get', 'list', 'update'],
  () => ({})
);

export type Provider = Awaited<ReturnType<typeof subspace.provider.get>>;
