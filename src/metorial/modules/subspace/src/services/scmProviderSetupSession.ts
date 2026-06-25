import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceScmProviderSetupSessionService = createSubspaceService(
  subspace.scmProviderSetupSession,
  ['get', 'create'],
  () => ({})
);

export type SubspaceScmProviderSetupSession = Awaited<
  ReturnType<typeof subspace.scmProviderSetupSession.get>
>;
