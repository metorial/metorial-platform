import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let customProviderVersionService = createSubspaceService(
  subspace.customProviderVersion,
  ['get', 'list', 'create'],
  () => ({})
);

export type CustomProviderVersion = Awaited<
  ReturnType<typeof subspace.customProviderVersion.get>
>;
