import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceMagicMcpBackingService = createSubspaceService(
  subspace.magicMcpBacking,
  [
    'upsertProviderTemplate',
    'reconcileProviderTemplate',
    'upsertServer',
    'upsertEndpoint',
    'getProviderTemplate',
    'getManyProviderTemplates',
    'getManyProviderTemplatesByIntegrationIds',
    'getServer',
    'getServerSession',
    'listServerProviders',
    'getServerProvider',
    'createServerProvider',
    'updateServerProvider',
    'archiveServerProvider',
    'getEndpoint',
    'archiveProviderTemplate',
    'archiveServer',
    'archiveEndpoint'
  ],
  () => ({})
);
