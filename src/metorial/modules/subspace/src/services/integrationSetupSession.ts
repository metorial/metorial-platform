import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceIntegrationSetupSessionService = createSubspaceService(
  subspace.integrationSetupSession,
  ['get', 'list', 'create', 'events'],
  () => ({})
);

export type SubspaceIntegrationSetupSession = Awaited<
  ReturnType<typeof subspace.integrationSetupSession.get>
>;
