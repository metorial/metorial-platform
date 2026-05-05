import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceMagicMcpBackingService = createSubspaceService(
  subspace.magicMcpBacking,
  [
    'upsertProviderTemplate',
    'upsertServer',
    'upsertEndpoint',
    'getServer',
    'getServerSession',
    'getEndpoint',
    'archiveServer',
    'archiveEndpoint'
  ],
  () => ({})
);
