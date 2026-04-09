import { createFetchWithRetry } from '@metorial/fetch';
import { MetorialKeyPrefix, sdkBuilder } from './builder';

import {
  MetorialConsumerConsumerInternalOauthAuthorizationsEndpoint,
  MetorialConsumerConsumerInternalOauthClientsEndpoint,
  MetorialConsumerProfileEndpoint,
  MetorialConsumerProvidersEndpoint,
  MetorialConsumerSessionEndpoint,
  MetorialMagicMcpEndpointsEndpoint,
  MetorialMagicMcpGroupsEndpoint,
  MetorialMagicMcpServersEndpoint,
  MetorialMagicMcpSessionsEndpoint,
  MetorialMagicMcpTokensEndpoint,
  MetorialProviderCategoriesEndpoint,
  MetorialProviderCollectionsEndpoint,
  MetorialProviderListingsEndpoint,
  MetorialProvidersEndpoint,
  MetorialProvidersVersionsEndpoint
} from './gen/src/mt_2026_01_01_magnetar';

let fetchWithRetry = createFetchWithRetry();
let identityMapper = {
  transformFrom: (data: any) => data
};

export let createMetorialConsumerSDK = sdkBuilder.build(
  (soft: {
    apiKey?: `${MetorialKeyPrefix}${string}` | string;
    apiVersion?: '2026-01-01-magnetar';
    headers?: Record<string, string>;
    apiHost?: string;
    consumerToken: string;
  }) => ({
    ...soft,
    apiVersion: '2026-01-01-magnetar',
    fetch: fetchWithRetry,
    headers: {
      ...soft.headers,
      'Metorial-Consumer-Session-Client-Secret': soft.consumerToken
    }
  })
)(manager => ({
  profile: new MetorialConsumerProfileEndpoint(manager),
  session: new MetorialConsumerSessionEndpoint(manager),
  providers: Object.assign(new MetorialProvidersEndpoint(manager), {
    versions: new MetorialProvidersVersionsEndpoint(manager),
    listings: Object.assign(new MetorialProviderListingsEndpoint(manager), {
      collections: new MetorialProviderCollectionsEndpoint(manager),
      categories: new MetorialProviderCategoriesEndpoint(manager)
    })
  }),
  consumerProviders: new MetorialConsumerProvidersEndpoint(manager),
  magicMcp: {
    servers: new MetorialMagicMcpServersEndpoint(manager),
    sessions: new MetorialMagicMcpSessionsEndpoint(manager),
    tokens: new MetorialMagicMcpTokensEndpoint(manager),
    groups: new MetorialMagicMcpGroupsEndpoint(manager),
    endpoints: new MetorialMagicMcpEndpointsEndpoint(manager)
  },
  oauth: {
    authorizations: new MetorialConsumerConsumerInternalOauthAuthorizationsEndpoint(manager),
    clients: new MetorialConsumerConsumerInternalOauthClientsEndpoint(manager)
  }
}));

export type MetorialConsumerSDK = ReturnType<typeof createMetorialConsumerSDK>;
