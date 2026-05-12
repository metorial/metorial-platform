import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceSkillTemplateService = createSubspaceService(
  subspace.skillTemplate,
  ['get', 'list', 'create', 'update', 'delete'],
  () => ({})
);

export type SubspaceSkillTemplate = Awaited<ReturnType<typeof subspace.skillTemplate.get>>;
