import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceSessionService = createSubspaceService(
  subspace.session,
  ['get', 'list', 'create', 'update'],
  () => ({})
);

export type SubspaceSession = Awaited<ReturnType<typeof subspace.session.get>>;
