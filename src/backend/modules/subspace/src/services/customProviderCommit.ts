import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let customProviderCommitService = createSubspaceService(
  subspace.customProviderCommit,
  ['get', 'list', 'create'],
  () => ({})
);

export type CustomProviderCommit = Awaited<
  ReturnType<typeof subspace.customProviderCommit.get>
>;
