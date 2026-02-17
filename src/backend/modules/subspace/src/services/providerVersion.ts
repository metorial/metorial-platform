import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderVersionService = createSubspaceService(
  subspace.providerVersion,
  ['get', 'list'],
  () => ({})
);

export type SubspaceProviderVersion = Awaited<ReturnType<typeof subspace.providerVersion.get>>;
