import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let scmConnectionSetupSessionService = createSubspaceService(
  subspace.scmConnectionSetupSession,
  ['get', 'create'],
  () => ({})
);

export type ScmConnectionSetupSession = Awaited<
  ReturnType<typeof subspace.scmConnectionSetupSession.get>
>;
