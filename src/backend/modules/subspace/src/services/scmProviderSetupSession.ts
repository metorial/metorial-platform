import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let scmProviderSetupSessionService = createSubspaceService(
  subspace.scmProviderSetupSession,
  ['get', 'create'],
  () => ({})
);
