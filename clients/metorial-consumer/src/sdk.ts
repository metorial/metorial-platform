import { createFetchWithRetry } from '@metorial/fetch';
import { MetorialKeyPrefix, sdkBuilder } from './builder';

import {
  MetorialProviderCategoriesEndpoint,
  MetorialProviderCollectionsEndpoint,
  MetorialProviderListingsEndpoint,
  MetorialProvidersEndpoint,
  MetorialProvidersVersionsEndpoint
} from './gen/src/mt_2025_01_01_dashboard';

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
    apiVersion?: '2025-01-01-dashboard';
    headers?: Record<string, string>;
    apiHost?: string;
    consumerToken: string;
  }) => ({
    ...soft,
    apiVersion: '2025-01-01-dashboard',
    fetch: fetchWithRetryAndLogging,
    enableDebugLogging: true,
    headers: {
      ...soft.headers,
      'Metorial-Consumer-Session-Client-Secret': soft.consumerToken
    }
  })
)(manager => ({
  providers: Object.assign(new MetorialProvidersEndpoint(manager), {
    versions: new MetorialProvidersVersionsEndpoint(manager),
    listings: Object.assign(new MetorialProviderListingsEndpoint(manager), {
      collections: new MetorialProviderCollectionsEndpoint(manager),
      categories: new MetorialProviderCategoriesEndpoint(manager)
    })
  })
}));

export type MetorialConsumerSDK = ReturnType<typeof createMetorialConsumerSDK>;
