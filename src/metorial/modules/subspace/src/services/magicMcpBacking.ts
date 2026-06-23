import type { Instance } from '@metorial/db';
import { createSubspaceService } from '../lib/subspaceService';
import { getTenantForSubspace, subspace } from '../subspace';

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
