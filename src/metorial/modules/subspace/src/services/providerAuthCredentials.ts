import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export type SubspaceProviderAuthCredentials = Awaited<
  ReturnType<typeof subspace.providerAuthCredentials.get>
>;

export let subspaceProviderAuthCredentialsService = createSubspaceService(
  subspace.providerAuthCredentials,
  ['get', 'getMany', 'list', 'update', 'create', 'delete'],
  () => ({})
);
