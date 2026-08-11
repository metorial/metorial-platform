import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceSkillService = createSubspaceService(
  subspace.skill,
  ['hydrateResources', 'syncResourceTarget'],
  () => ({})
);

export type SubspaceSkillResourceHydration = Awaited<
  ReturnType<typeof subspace.skill.hydrateResources>
>[number];
export type SubspaceProviderPreview = SubspaceSkillResourceHydration['providers'][number];
export type SubspaceIntegrationPreview =
  SubspaceSkillResourceHydration['integrations'][number];
