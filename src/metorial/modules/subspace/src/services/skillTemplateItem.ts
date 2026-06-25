import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceSkillTemplateItemService = createSubspaceService(
  subspace.skillTemplateItem,
  ['get', 'list', 'create', 'delete'],
  () => ({})
);

export type SubspaceSkillTemplateItem = Awaited<
  ReturnType<typeof subspace.skillTemplateItem.get>
>;
