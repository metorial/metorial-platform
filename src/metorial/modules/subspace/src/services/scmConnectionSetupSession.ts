import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceScmConnectionSetupSessionService = createSubspaceService(
  subspace.scmConnectionSetupSession,
  ['get', 'create'],
  () => ({})
);

export type SubspaceScmConnectionSetupSession = Awaited<
  ReturnType<typeof subspace.scmConnectionSetupSession.get>
>;
