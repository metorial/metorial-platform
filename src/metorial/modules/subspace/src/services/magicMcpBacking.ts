import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceMagicMcpBackingService = createSubspaceService(
  subspace.magicMcpBacking,
  [
    'upsertProviderTemplate',
    'upsertProviderTemplateFromIntegration',
    'upsertServer',
    'upsertEndpoint',
    'getProviderTemplate',
    'getManyProviderTemplates',
    'getManyProviderTemplatesByIntegrationIds',
    'getServer',
    'getServerSession',
    'listServerProviders',
    'resolveServerProviderBackingIds',
    'resolveServerBackingIdsByIntegrationResource',
    'resolveServerBackingIdsForIntegrationInstanceUsage',
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
