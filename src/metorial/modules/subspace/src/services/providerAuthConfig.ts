import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderAuthConfigService = createSubspaceService(
  subspace.providerAuthConfig,
  ['get', 'getMany', 'list', 'update', 'create', 'delete', 'getConfigSchema'],
  () => ({})
);

export type SubspaceProviderAuthConfig = Awaited<
  ReturnType<typeof subspace.providerAuthConfig.get>
>;

export type SubspaceProviderAuthConfigSchema = Awaited<
  ReturnType<typeof subspace.providerAuthConfig.getConfigSchema>
>;
