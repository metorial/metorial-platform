import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceSessionProviderService = createSubspaceService(
  subspace.sessionProvider,
  ['get', 'list', 'create', 'update', 'delete'],
  () => ({})
);

export type SessionProvider = Awaited<ReturnType<typeof subspace.sessionProvider.get>>;
