import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceAuthConfigErrorGlobalService = createSubspaceService(
  subspace.authConfigErrorGlobal,
  ['get', 'list'],
  () => ({})
);

export type SubspaceAuthConfigErrorGlobal = Awaited<
  ReturnType<typeof subspace.authConfigErrorGlobal.get>
>;
