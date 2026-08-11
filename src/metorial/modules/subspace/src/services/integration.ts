import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceIntegrationService = createSubspaceService(
  subspace.integration,
  ['get', 'list', 'create', 'update', 'delete'],
  () => ({})
);

export type SubspaceIntegration = Awaited<ReturnType<typeof subspace.integration.get>>;
