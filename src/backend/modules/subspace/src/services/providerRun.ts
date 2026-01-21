import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderRunService = createSubspaceService(
  subspace.providerRun,
  ['get', 'list'],
  () => ({})
);
