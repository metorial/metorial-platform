import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceMagicMcpServerProviderService = createSubspaceService(
  subspace.magicMcpServerProvider,
  ['get', 'list', 'create', 'update', 'delete'],
  () => ({})
);

export type SubspaceMagicMcpServerProvider = Awaited<
  ReturnType<typeof subspace.magicMcpServerProvider.get>
>;
