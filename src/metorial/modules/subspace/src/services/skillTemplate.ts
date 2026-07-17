import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceSkillTemplateService = createSubspaceService(
  subspace.skillTemplate,
  ['hydrateResources', 'syncResourceTarget'],
  () => ({})
);

export type SubspaceSkillTemplateResourceHydration = Awaited<
  ReturnType<typeof subspace.skillTemplate.hydrateResources>
>[number];
