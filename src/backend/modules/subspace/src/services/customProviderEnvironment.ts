import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let customProviderEnvironmentService = createSubspaceService(
  subspace.customProviderEnvironment,
  ['get', 'list'],
  () => ({})
);
