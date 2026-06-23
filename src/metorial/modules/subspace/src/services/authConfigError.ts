import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceAuthConfigErrorService = createSubspaceService(
  subspace.authConfigError,
  ['get', 'list'],
  () => ({})
);

export type SubspaceAuthConfigError = Awaited<ReturnType<typeof subspace.authConfigError.get>>;
