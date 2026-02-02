import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let customProviderCommitService = createSubspaceService(
  subspace.customProviderCommit,
  ['get', 'list', 'create'],
  () => ({})
);
