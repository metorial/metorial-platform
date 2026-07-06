import type { Instance } from '@metorial/db';
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
    'resolveIntegrationResourceLinks',
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
  inner => ({
    resolveIntegrationResourceLinks: async (d: {
      instance: Instance;
      integrationId?: string | null;
      integrationInstanceId?: string | null;
      backingCursor?: string | null;
      integrationInstanceCursor?: string | null;
      limit?: number | null;
      includeBackings?: boolean | null;
      includeIntegrationInstances?: boolean | null;
    }) => {
      return await (inner.resolveIntegrationResourceLinks as any)(d);
    }
  })
);
