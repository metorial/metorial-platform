import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceSkillGroupService = createSubspaceService(
  subspace.skillGroup,
  ['get', 'list', 'create', 'update', 'delete'],
  inner => ({})
);

export type SubspaceSkillGroup = Awaited<ReturnType<typeof subspace.skillGroup.get>>;
