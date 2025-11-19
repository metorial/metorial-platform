import { createFetchWithRetry } from '@metorial/fetch';
import { MetorialKeyPrefix, sdkBuilder } from './builder';
import {
  MetorialServersListingsCategoriesEndpoint,
  MetorialServersListingsCollectionsEndpoint,
  MetorialServersListingsEndpoint
} from './gen/src/mt_2025_01_01_dashboard';
import {
  MetorialConsumerMagicMcpGroupsEndpoint,
  MetorialConsumerMagicMcpServersEndpoint,
  MetorialConsumerMagicMcpSessionsEndpoint,
  MetorialConsumerMagicMcpTokensEndpoint,
  MetorialConsumerProfileEndpoint,
  MetorialConsumerProfileGroupsEndpoint,
  MetorialConsumerProfileSsoUserEndpoint,
  MetorialConsumerSessionEndpoint,
  MetorialServersCapabilitiesEndpoint,
  MetorialServersEndpoint,
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
  profile: Object.assign(new MetorialConsumerProfileEndpoint(manager), {
    groups: new MetorialConsumerProfileGroupsEndpoint(manager),
    ssoUser: new MetorialConsumerProfileSsoUserEndpoint(manager)
  }),

  session: new MetorialConsumerSessionEndpoint(manager),

  magicMcp: {
    groups: new MetorialConsumerMagicMcpGroupsEndpoint(manager),
    servers: new MetorialConsumerMagicMcpServersEndpoint(manager),
    sessions: new MetorialConsumerMagicMcpSessionsEndpoint(manager),
    tokens: new MetorialConsumerMagicMcpTokensEndpoint(manager)
  },

  servers: Object.assign(new MetorialServersEndpoint(manager), {
    listings: Object.assign(new MetorialServersListingsEndpoint(manager), {
      collections: new MetorialServersListingsCollectionsEndpoint(manager),
      categories: new MetorialServersListingsCategoriesEndpoint(manager)
    }),

    variants: new MetorialServersVariantsEndpoint(manager),
    versions: new MetorialServersVersionsEndpoint(manager),

    capabilities: new MetorialServersCapabilitiesEndpoint(manager)
  })
}));

export type MetorialConsumerSDK = ReturnType<typeof createMetorialConsumerSDK>;
