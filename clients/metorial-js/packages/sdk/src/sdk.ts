import {} from '@metorial/core';
import { MetorialKeyPrefix, sdkBuilder } from './builder';

export let createMetorialSDK = sdkBuilder.build(
  (soft: {
    apiKey: `${MetorialKeyPrefix}${string}` | string;
    apiVersion?: '2025-01-01-pulsar';
    clientSecret?: string;
    asUserId?: string;
    headers?: Record<string, string>;
    apiHost?: string;
  }) => ({
    ...soft,
    apiVersion: '2025-01-01-pulsar'
  })
)(manager => ({
  // actors: new MetorialActorsEndpoint(manager),
  // agents: new MetorialAgentsEndpoint(manager),
  // clientTokens: {
  //   jwks: new MetorialClientTokensJwksEndpoint(manager)
  // },
  // files: Object.assign(new MetorialFilesEndpoint(manager), {
  //   links: new MetorialFilesLinksEndpoint(manager)
  // }),
  // groups: Object.assign(new MetorialGroupsEndpoint(manager), {
  //   blocks: new MetorialGroupsBlocksEndpoint(manager),
  //   threads: new MetorialGroupsThreadsEndpoint(manager),
  //   users: new MetorialGroupsUsersEndpoint(manager)
  // }),
  // instance: new MetorialInstanceEndpoint(manager),
  // policies: Object.assign(new MetorialPoliciesEndpoint(manager), {
  //   entitlements: new MetorialPoliciesEntitlementsEndpoint(manager)
  // }),
  // portals: Object.assign(new MetorialPortalsEndpoint(manager), {
  //   agents: new MetorialPortalsAgentsEndpoint(manager)
  // }),
  // roles: new MetorialRolesEndpoint(manager),
  // runs: new MetorialRunsEndpoint(manager),
  // threads: Object.assign(new MetorialThreadsEndpoint(manager), {
  //   messages: new MetorialThreadsMessagesEndpoint(manager),
  //   participants: new MetorialThreadsParticipantsEndpoint(manager)
  // }),
  // users: new MetorialUsersEndpoint(manager)
}));

export type MetorialSDK = ReturnType<typeof createMetorialSDK>;
