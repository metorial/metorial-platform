import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceSessionErrorGroupService = createSubspaceService(
  subspace.sessionErrorGroup,
  ['get', 'list'],
  () => ({})
);

export type SubspaceSessionErrorGroup = Awaited<ReturnType<typeof subspace.sessionErrorGroup.get>>;
