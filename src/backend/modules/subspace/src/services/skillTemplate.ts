import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceSkillTemplateService = createSubspaceService(
  subspace.skillTemplate,
  [
    'get',
    'list',
    'create',
    'update',
    'delete',
    'listItems',
    'getItem',
    'createItem',
    'deleteItem'
  ],
  () => ({})
);

export type SubspaceSkillTemplate = Awaited<ReturnType<typeof subspace.skillTemplate.get>>;
export type SubspaceSkillTemplateItem = Awaited<
  ReturnType<typeof subspace.skillTemplate.getItem>
>;
