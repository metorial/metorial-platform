import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceSkillGroupItemService = createSubspaceService(
  subspace.skillGroupItem,
  ['get', 'list', 'create', 'delete'],
  inner => ({})
);

export type SubspaceSkillGroupItem = Awaited<ReturnType<typeof subspace.skillGroupItem.get>>;
