import { createFetchWithRetry } from '@metorial/fetch';
import { MetorialKeyPrefix, sdkBuilder } from './builder';

import {
  MetorialPortalsConsumerProfilesEndpoint,
  MetorialPortalsConsumerGroupsEndpoint,
  MetorialPortalsConsumerServerRequestsEndpoint,
  MetorialSessionsEndpoint,
  MetorialMagicMcpGroupsEndpoint,
  MetorialMagicMcpServersEndpoint,
  MetorialMagicMcpSessionsEndpoint,
  MetorialMagicMcpTokensEndpoint,
  MetorialProviderOauthSessionsEndpoint,
  MetorialServersCapabilitiesEndpoint,
  MetorialServersDeploymentsTemplatesEndpoint,
  MetorialServersEndpoint,
  MetorialServersListingsCategoriesEndpoint,
  MetorialServersListingsCollectionsEndpoint,
  MetorialServersListingsEndpoint,
  MetorialServersListingsReadmeEndpoint,
  MetorialServersVariantsEndpoint,
  MetorialServersVersionsEndpoint
} from './gen/src/mt_2025_01_01_pulsar';

let fetchWithRetry = createFetchWithRetry();

let fetchWithRetryAndLogging = async (
  input: string | URL | Request,
  init?: RequestInit
): Promise<Response> => {
  console.log('[Metorial API] Fetching:', {
    input,
    init
  });

  try {
    return await fetchWithRetry(input, init);
  } catch (error) {
    console.error('[Metorial API] Fetch failed:', {
      input,
      init,
      error
    });
    throw error;
  }
};

export let createMetorialConsumerSDK = sdkBuilder.build(
  (soft: {
    apiKey?: `${MetorialKeyPrefix}${string}` | string;
    apiVersion?: '2025-01-01-pulsar';
    headers?: Record<string, string>;
    apiHost?: string;
    consumerToken: string;
  }) => ({
    ...soft,
    apiVersion: '2025-01-01-pulsar',
    fetch: fetchWithRetryAndLogging,
    enableDebugLogging: true,
    headers: {
      ...soft.headers,
      'Metorial-Consumer-Session-Client-Secret': soft.consumerToken
    }
  })
)(manager => ({
  profile: Object.assign(new MetorialPortalsConsumerProfilesEndpoint(manager), {
    groups: new MetorialPortalsConsumerGroupsEndpoint(manager)
  }),

  session: new MetorialSessionsEndpoint(manager),

  magicMcp: {
    groups: new MetorialMagicMcpGroupsEndpoint(manager),
    servers: new MetorialMagicMcpServersEndpoint(manager),
    sessions: new MetorialMagicMcpSessionsEndpoint(manager),
    tokens: new MetorialMagicMcpTokensEndpoint(manager)
  },

  oauthSessions: new MetorialProviderOauthSessionsEndpoint(manager),

  servers: Object.assign(new MetorialServersEndpoint(manager), {
    listings: Object.assign(new MetorialServersListingsEndpoint(manager), {
      collections: new MetorialServersListingsCollectionsEndpoint(manager),
      categories: new MetorialServersListingsCategoriesEndpoint(manager)
    }),

    readme: new MetorialServersListingsReadmeEndpoint(manager),

    variants: new MetorialServersVariantsEndpoint(manager),
    versions: new MetorialServersVersionsEndpoint(manager),

    capabilities: new MetorialServersCapabilitiesEndpoint(manager),

    templates: new MetorialServersDeploymentsTemplatesEndpoint(manager),

    serverRequests: new MetorialPortalsConsumerServerRequestsEndpoint(manager)
  })
}));

export type MetorialConsumerSDK = ReturnType<typeof createMetorialConsumerSDK>;
