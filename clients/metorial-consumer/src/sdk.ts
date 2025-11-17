import { createFetchWithRetry } from '@metorial/fetch';
import { MetorialKeyPrefix, sdkBuilder } from './builder';
import {
  MetorialConsumerMagicMcpGroupsEndpoint,
  MetorialConsumerMagicMcpServersEndpoint,
  MetorialConsumerMagicMcpSessionsEndpoint,
  MetorialConsumerMagicMcpTokensEndpoint,
  MetorialConsumerProfileEndpoint,
  MetorialConsumerProfileGroupsEndpoint,
  MetorialConsumerProfileSsoUserEndpoint,
  MetorialConsumerSessionEndpoint
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
    organizationId?: string;
    instanceId?: string;
  }) => ({
    ...soft,
    apiVersion: '2025-01-01-pulsar',
    fetch: fetchWithRetryAndLogging,
    enableDebugLogging: true
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
  }
}));

export type MetorialConsumerSDK = ReturnType<typeof createMetorialConsumerSDK>;
