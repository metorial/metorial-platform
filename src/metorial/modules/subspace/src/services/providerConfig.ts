import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceProviderConfigService = createSubspaceService(
  subspace.providerConfig,
  ['get', 'getMany', 'list', 'update', 'create', 'delete', 'getConfigSchema'],
  () => ({})
);

export type SubspaceProviderConfig = Awaited<ReturnType<typeof subspace.providerConfig.get>>;

export type SubspaceProviderConfigSchema = Awaited<
  ReturnType<typeof subspace.providerConfig.getConfigSchema>
>;
