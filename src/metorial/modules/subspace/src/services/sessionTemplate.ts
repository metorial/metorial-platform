import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceSessionTemplateService = createSubspaceService(
  subspace.sessionTemplate,
  ['get', 'getMany', 'list', 'create', 'update', 'delete', 'listTools'],
  () => ({})
);

export type SubspaceSessionTemplate = Awaited<ReturnType<typeof subspace.sessionTemplate.get>>;
