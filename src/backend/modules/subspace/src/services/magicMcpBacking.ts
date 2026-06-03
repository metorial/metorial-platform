import { createSubspaceService } from '../lib/subspaceService';
import { subspace } from '../subspace';

export let subspaceMagicMcpBackingService = createSubspaceService(
  subspace.magicMcpBacking,
  [
    'upsertProviderTemplate',
    'reconcileProviderTemplate',
    'upsertProviderTemplateFromIntegration',
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
