import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderConfigService = createSubspaceService(
  subspace.providerConfig,
  ['get', 'list', 'update', 'create', 'getConfigSchema'],
  () => ({})
);
