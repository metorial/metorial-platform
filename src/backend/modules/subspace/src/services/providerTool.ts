import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderToolService = createSubspaceService(
  subspace.providerTool,
  ['get', 'list'],
  {}
);
