import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceSkillItemService = createSubspaceService(
  subspace.skillItem,
  ['get', 'list', 'create', 'delete'],
  () => ({})
);

export type SubspaceSkillItem = Awaited<ReturnType<typeof subspace.skillItem.get>>;
