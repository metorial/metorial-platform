import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderSetupSessionService = createSubspaceService(
  subspace.providerSetupSession,
  ['get', 'list', 'create', 'update'],
  () => ({})
);

export type SubspaceProviderSetupSession = Awaited<
  ReturnType<typeof subspace.providerSetupSession.get>
>;
