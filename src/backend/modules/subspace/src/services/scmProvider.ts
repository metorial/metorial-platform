import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let scmProviderService = createSubspaceService(
  subspace.scmProvider,
  ['get', 'list'],
  () => ({})
);

export type SubspaceScmProvider = Awaited<ReturnType<typeof subspace.scmProvider.get>>;
