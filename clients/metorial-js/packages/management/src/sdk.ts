import {} from '@metorial/core';
import { MetorialKeyPrefix, sdkBuilder } from './builder';

export let createMetorialManagementSDK = sdkBuilder.build(
  (soft: {
    apiKey?: `${MetorialKeyPrefix}${string}` | string;
    apiVersion?: '2025-01-01-pulsar';
    headers?: Record<string, string>;
    apiHost?: string;
    organizationId?: string;
    instanceId?: string;
  }) => ({
    ...soft,
    apiVersion: '2025-01-01-pulsar'
  })
)(manager => ({
  // instances: Object.assign(new MetorialManagementInstancesInstanceEndpoint(manager), {
  //   actors: new MetorialManagementInstancesActorsEndpoint(manager),
  //   agents: new MetorialManagementInstancesAgentsEndpoint(manager),
  //   clientTokens: {
  //     jwks: new MetorialManagementInstancesClientTokensJwksEndpoint(manager)
  //   },
  //   files: Object.assign(new MetorialManagementInstancesFilesEndpoint(manager), {
  //     links: new MetorialManagementInstancesFilesLinksEndpoint(manager)
  //   }),
  //   groups: Object.assign(new MetorialManagementInstancesGroupsEndpoint(manager), {
  //     blocks: new MetorialManagementInstancesGroupsBlocksEndpoint(manager),
  //     threads: new MetorialManagementInstancesGroupsThreadsEndpoint(manager),
  //     users: new MetorialManagementInstancesGroupsUsersEndpoint(manager)
  //   }),
  //   policies: Object.assign(new MetorialManagementInstancesPoliciesEndpoint(manager), {
  //     entitlements: new MetorialManagementInstancesPoliciesEntitlementsEndpoint(manager)
  //   }),
  //   portals: Object.assign(new MetorialManagementInstancesPortalsEndpoint(manager), {
  //     agents: new MetorialManagementInstancesPortalsAgentsEndpoint(manager)
  //   }),
  //   roles: new MetorialManagementInstancesRolesEndpoint(manager),
  //   runs: new MetorialManagementInstancesRunsEndpoint(manager),
  //   threads: Object.assign(new MetorialManagementInstancesThreadsEndpoint(manager), {
  //     messages: new MetorialManagementInstancesThreadsMessagesEndpoint(manager),
  //     participants: new MetorialManagementInstancesThreadsParticipantsEndpoint(manager)
  //   }),
  //   users: new MetorialManagementInstancesUsersEndpoint(manager)
  // }),
  // projects: Object.assign(new MetorialManagementProjectsEndpoint(manager), {
  //   agents: Object.assign(new MetorialManagementProjectsAgentsEndpoint(manager), {
  //     instanceAgents: new MetorialManagementProjectsAgentsInstanceAgentsEndpoint(manager),
  //     releases: new MetorialManagementProjectsAgentsReleasesEndpoint(manager)
  //   }),
  //   portals: Object.assign(new MetorialManagementProjectsPortalsEndpoint(manager), {
  //     portalAgents: new MetorialManagementProjectsPortalsPortalAgentsEndpoint(manager),
  //     portalDomains: new MetorialManagementProjectsPortalsPortalDomainsEndpoint(manager),
  //     portalEnvironments: new MetorialManagementProjectsPortalsPortalEnvironmentsEndpoint(
  //       manager
  //     )
  //   })
  // })
}));

export type MetorialManagementSDK = ReturnType<typeof createMetorialManagementSDK>;
