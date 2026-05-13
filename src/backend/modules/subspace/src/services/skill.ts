import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceSkillService = createSubspaceService(
  subspace.skill,
  ['get', 'list', 'create', 'update', 'delete', 'fork', 'duplicate', 'getMany', 'upsertActor'],
  inner => ({})
);

export type SubspaceSkill = Awaited<ReturnType<typeof subspace.skill.get>>;
export type SubspaceProviderPreview = NonNullable<
  Awaited<ReturnType<typeof subspace.skillItem.get>>['provider']
>;
export type SubspaceIntegrationPreview = NonNullable<
  Awaited<ReturnType<typeof subspace.skillItem.get>>['integration']
>;
