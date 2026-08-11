import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceSessionErrorService = createSubspaceService(
  subspace.sessionError,
  ['get', 'list'],
  () => ({})
);

export type SubspaceSessionError = Awaited<ReturnType<typeof subspace.sessionError.get>>;
