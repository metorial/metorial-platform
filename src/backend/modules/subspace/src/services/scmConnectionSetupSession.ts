import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let scmConnectionSetupSessionService = createSubspaceService(
  subspace.scmConnectionSetupSession,
  ['get', 'create'],
  () => ({})
);

export type SubspaceScmConnectionSetupSession = Awaited<
  ReturnType<typeof subspace.scmConnectionSetupSession.get>
>;
