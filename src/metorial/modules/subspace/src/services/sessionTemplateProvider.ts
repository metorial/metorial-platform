import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceSessionTemplateProviderService = createSubspaceService(
  subspace.sessionTemplateProvider,
  ['get', 'getMany', 'list', 'create', 'update', 'delete'],
  () => ({})
);

export type SubspaceSessionTemplateProvider = Awaited<
  ReturnType<typeof subspace.sessionTemplateProvider.get>
>;
