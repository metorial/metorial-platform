import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceSessionTemplateProviderService = createSubspaceService(
  subspace.sessionTemplateProvider,
  ['get', 'list', 'create', 'update', 'delete'],
  () => ({})
);
