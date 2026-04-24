import { createFetchWithRetry } from '@metorial/fetch';
import { MetorialKeyPrefix, sdkBuilder } from './builder';

import {
  MetorialConsumerConsumerInternalOauthAuthorizationsEndpoint,
  MetorialConsumerConsumerInternalOauthClientsEndpoint,
  MetorialConsumerProfileEndpoint,
  MetorialConsumerProvidersEndpoint,
  MetorialConsumerProvidersGroupsEndpoint,
  MetorialConsumerSessionEndpoint,
  MetorialMagicMcpEndpointsEndpoint,
  MetorialMagicMcpGroupsEndpoint,
  MetorialMagicMcpServersEndpoint,
  MetorialMagicMcpServersProvidersEndpoint,
  MetorialMagicMcpSessionsEndpoint,
  MetorialMagicMcpTokensEndpoint,
  MetorialProviderCategoriesEndpoint,
  MetorialProviderCollectionsEndpoint,
  MetorialProviderListingsEndpoint,
  MetorialProvidersEndpoint,
  MetorialProvidersSpecificationsEndpoint,
  MetorialProvidersVersionsEndpoint
} from './gen/src/mt_2026_04_01_consumer';

let fetchWithRetry = createFetchWithRetry();
let identityMapper = {
  transformFrom: (data: any) => data
};

export let createMetorialConsumerSDK = sdkBuilder.build(
  (soft: {
    apiKey?: `${MetorialKeyPrefix}${string}` | string;
    apiVersion?: '2026-04-01-consumer';
    headers?: Record<string, string>;
    apiHost?: string;
    consumerToken: string;
  }) => ({
    ...soft,
    apiVersion: '2026-04-01-consumer',
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
    specifications: new MetorialProvidersSpecificationsEndpoint(manager),
    listings: Object.assign(new MetorialProviderListingsEndpoint(manager), {
      collections: new MetorialProviderCollectionsEndpoint(manager),
      categories: new MetorialProviderCategoriesEndpoint(manager)
    }),
    groups: new MetorialConsumerProvidersGroupsEndpoint(manager)
  }),
  consumerProviders: Object.assign(new MetorialConsumerProvidersEndpoint(manager), {
    groups: new MetorialConsumerProvidersGroupsEndpoint(manager)
  }),
  magicMcp: {
    servers: Object.assign(new MetorialMagicMcpServersEndpoint(manager), {
      providers: new MetorialMagicMcpServersProvidersEndpoint(manager)
    }),
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
