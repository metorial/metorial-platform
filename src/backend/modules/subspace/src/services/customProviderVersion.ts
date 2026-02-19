import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let customProviderVersionService = createSubspaceService(
  subspace.customProviderVersion,
  ['get', 'list', 'create'],
  () => ({})
);

export type SubspaceCustomProviderVersion = Awaited<
  ReturnType<typeof subspace.customProviderVersion.get>
>;
