import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceSessionTemplateService = createSubspaceService(
  subspace.sessionTemplate,
  ['get', 'list', 'create', 'update'],
  () => ({})
);

export type SessionTemplate = Awaited<ReturnType<typeof subspace.sessionTemplate.get>>;
