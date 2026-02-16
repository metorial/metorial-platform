import { createFetchWithRetry } from '@metorial/fetch';
import { MetorialAuthEndpoint } from './auth';
import { MetorialKeyPrefix, sdkBuilder } from './builder';
import {
  MetorialApiKeysEndpoint,
  MetorialDashboardEndpoint,
  // MetorialDashboardInstanceCallbacksDestinationsEndpoint,
  // MetorialDashboardInstanceCallbacksEndpoint,
  // MetorialDashboardInstanceCallbacksEventsEndpoint,
  // MetorialDashboardInstanceCallbacksNotificationsEndpoint,
  MetorialDashboardInstanceCustomProvidersCommitsEndpoint,
  MetorialDashboardInstanceCustomProvidersDeploymentsEndpoint,
  MetorialDashboardInstanceCustomProvidersEndpoint,
  MetorialDashboardInstanceCustomProvidersEnvironmentsEndpoint,
  MetorialDashboardInstanceCustomProvidersVersionsEndpoint,
  MetorialDashboardInstanceFilesEndpoint,
  MetorialDashboardInstanceLinksEndpoint,
  // MetorialDashboardInstancePortalsConsumerAccessEndpoint,
  // MetorialDashboardInstancePortalsConsumerAuthFactorsEndpoint,
  // MetorialDashboardInstancePortalsConsumerGroupsEndpoint,
  // MetorialDashboardInstancePortalsConsumerProfilesEndpoint,
  // MetorialDashboardInstancePortalsConsumerServerRequestsEndpoint,
  // MetorialDashboardInstancePortalsEndpoint,
  // MetorialDashboardInstancePortalsFeaturedServersEndpoint,
  MetorialDashboardInstanceProviderCategoriesEndpoint,
  MetorialDashboardInstanceProviderCollectionsEndpoint,
  MetorialDashboardInstanceProviderDeploymentsAuthConfigsEndpoint,
  MetorialDashboardInstanceProviderDeploymentsAuthCredentialsEndpoint,
  MetorialDashboardInstanceProviderDeploymentsConfigsEndpoint,
  MetorialDashboardInstanceProviderDeploymentsConfigVaultsEndpoint,
  MetorialDashboardInstanceProviderDeploymentsEndpoint,
  MetorialDashboardInstanceProviderDeploymentsSetupSessionsEndpoint,
  MetorialDashboardInstanceProviderGroupsEndpoint,
  MetorialDashboardInstanceProviderListingsEndpoint,
  MetorialDashboardInstanceProviderRunsEndpoint,
  MetorialDashboardInstanceProvidersAuthConfigsEndpoint,
  MetorialDashboardInstanceProvidersAuthMethodsEndpoint,
  MetorialDashboardInstanceProvidersEndpoint,
  MetorialDashboardInstanceProvidersSpecificationsEndpoint,
  MetorialDashboardInstanceProvidersToolsEndpoint,
  MetorialDashboardInstanceProvidersVersionsEndpoint,
  MetorialDashboardInstanceSessionErrorGroupsEndpoint,
  MetorialDashboardInstanceSessionErrorsEndpoint,
  MetorialDashboardInstanceSessionsConnectionsEndpoint,
  MetorialDashboardInstanceSessionsEndpoint,
  MetorialDashboardInstanceSessionsErrorGroupsEndpoint,
  MetorialDashboardInstanceSessionsErrorsEndpoint,
  MetorialDashboardInstanceSessionsEventsEndpoint,
  MetorialDashboardInstanceSessionsMessagesEndpoint,
  MetorialDashboardInstanceSessionsParticipantsEndpoint,
  MetorialDashboardInstanceSessionsProviderRunsEndpoint,
  MetorialDashboardInstanceSessionsProvidersEndpoint,
  MetorialDashboardInstanceSessionTemplatesEndpoint,
  MetorialDashboardInstanceSessionTemplatesProvidersEndpoint,
  MetorialDashboardOrganizationsEndpoint,
  MetorialDashboardOrganizationsInstancesEndpoint,
  MetorialDashboardOrganizationsInvitesEndpoint,
  MetorialDashboardOrganizationsJoinEndpoint,
  MetorialDashboardOrganizationsMembersEndpoint,
  MetorialDashboardOrganizationsProjectsEndpoint,
  MetorialDashboardOrganizationsTeamsEndpoint,
  MetorialDashboardOrganizationsTeamsMembersEndpoint,
  MetorialDashboardOrganizationsTeamsProjectsEndpoint,
  MetorialDashboardOrganizationsTeamsRolesEndpoint,
  MetorialDashboardUsageEndpoint,
  MetorialManagementUserEndpoint,
  MetorialOrganizationsProfileEndpoint
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

export let createMetorialDashboardSDK = sdkBuilder.build(
  (soft: {
    apiKey?: `${MetorialKeyPrefix}${string}` | string;
    apiVersion?: '2026-02-01-dashboard';
    headers?: Record<string, string>;
    apiHost?: string;
    organizationId?: string;
    instanceId?: string;
  }) => ({
    ...soft,
    apiVersion: '2026-02-01-dashboard',
    fetch: fetchWithRetryAndLogging,
    enableDebugLogging: true
  })
)(manager => ({
  // Common endpoints (shared between v1 and Provider API)
  organizations: Object.assign(new MetorialDashboardOrganizationsEndpoint(manager), {
    invites: new MetorialDashboardOrganizationsInvitesEndpoint(manager),
    members: new MetorialDashboardOrganizationsMembersEndpoint(manager)
  }),
  organizationJoins: new MetorialDashboardOrganizationsJoinEndpoint(manager),

  profile: new MetorialOrganizationsProfileEndpoint(manager),

  instances: new MetorialDashboardOrganizationsInstancesEndpoint(manager),
  projects: new MetorialDashboardOrganizationsProjectsEndpoint(manager),
  user: new MetorialManagementUserEndpoint(manager),

  apiKeys: new MetorialApiKeysEndpoint(manager),

  auth: new MetorialAuthEndpoint(manager),

  dashboard: new MetorialDashboardEndpoint(manager),

  files: Object.assign(new MetorialDashboardInstanceFilesEndpoint(manager), {
    links: new MetorialDashboardInstanceLinksEndpoint(manager)
  }),

  usage: new MetorialDashboardUsageEndpoint(manager),

  // callbacks: Object.assign(new MetorialDashboardInstanceCallbacksEndpoint(manager), {
  //   events: new MetorialDashboardInstanceCallbacksEventsEndpoint(manager),
  //   notifications: new MetorialDashboardInstanceCallbacksNotificationsEndpoint(manager),
  //   destinations: new MetorialDashboardInstanceCallbacksDestinationsEndpoint(manager)
  // }),

  teams: Object.assign(new MetorialDashboardOrganizationsTeamsEndpoint(manager), {
    roles: new MetorialDashboardOrganizationsTeamsRolesEndpoint(manager),
    projects: new MetorialDashboardOrganizationsTeamsProjectsEndpoint(manager),
    members: new MetorialDashboardOrganizationsTeamsMembersEndpoint(manager)
  }),

  // portals: Object.assign(new MetorialDashboardInstancePortalsEndpoint(manager), {
  //   consumerProfiles: new MetorialDashboardInstancePortalsConsumerProfilesEndpoint(manager),
  //   consumerGroups: new MetorialDashboardInstancePortalsConsumerGroupsEndpoint(manager),
  //   consumerAccess: new MetorialDashboardInstancePortalsConsumerAccessEndpoint(manager),
  //   consumerAuthFactors: new MetorialDashboardInstancePortalsConsumerAuthFactorsEndpoint(
  //     manager
  //   ),
  //   consumerServerRequests: new MetorialDashboardInstancePortalsConsumerServerRequestsEndpoint(
  //     manager
  //   ),
  //   featuredServers: new MetorialDashboardInstancePortalsFeaturedServersEndpoint(manager)
  // }),

  // ssoTenants: Object.assign(new MetorialDashboardInstanceSsoTenantsEndpoint(manager), {
  //   profiles: new MetorialDashboardInstanceSsoTenantsProfilesEndpoint(manager),
  //   users: new MetorialDashboardInstanceSsoTenantsUsersEndpoint(manager)
  // }),

  customProviders: Object.assign(
    new MetorialDashboardInstanceCustomProvidersEndpoint(manager),
    {
      versions: new MetorialDashboardInstanceCustomProvidersVersionsEndpoint(manager),
      deployments: new MetorialDashboardInstanceCustomProvidersDeploymentsEndpoint(manager),
      commits: new MetorialDashboardInstanceCustomProvidersCommitsEndpoint(manager),
      environments: new MetorialDashboardInstanceCustomProvidersEnvironmentsEndpoint(manager)
    }
  ),

  providers: Object.assign(new MetorialDashboardInstanceProvidersEndpoint(manager), {
    versions: new MetorialDashboardInstanceProvidersVersionsEndpoint(manager),
    tools: new MetorialDashboardInstanceProvidersToolsEndpoint(manager),
    authMethods: new MetorialDashboardInstanceProvidersAuthMethodsEndpoint(manager),
    authConfigs: new MetorialDashboardInstanceProvidersAuthConfigsEndpoint(manager),
    specifications: new MetorialDashboardInstanceProvidersSpecificationsEndpoint(manager),
    listings: new MetorialDashboardInstanceProviderListingsEndpoint(manager),
    categories: new MetorialDashboardInstanceProviderCategoriesEndpoint(manager),
    collections: new MetorialDashboardInstanceProviderCollectionsEndpoint(manager),
    groups: new MetorialDashboardInstanceProviderGroupsEndpoint(manager)
  }),

  providerDeployments: Object.assign(
    new MetorialDashboardInstanceProviderDeploymentsEndpoint(manager),
    {
      configs: new MetorialDashboardInstanceProviderDeploymentsConfigsEndpoint(manager),
      configVaults: new MetorialDashboardInstanceProviderDeploymentsConfigVaultsEndpoint(
        manager
      ),
      authConfigs: new MetorialDashboardInstanceProviderDeploymentsAuthConfigsEndpoint(
        manager
      ),
      authCredentials: new MetorialDashboardInstanceProviderDeploymentsAuthCredentialsEndpoint(
        manager
      ),
      setupSessions: new MetorialDashboardInstanceProviderDeploymentsSetupSessionsEndpoint(
        manager
      )
    }
  ),

  sessions: Object.assign(new MetorialDashboardInstanceSessionsEndpoint(manager), {
    events: new MetorialDashboardInstanceSessionsEventsEndpoint(manager),
    messages: new MetorialDashboardInstanceSessionsMessagesEndpoint(manager),
    connections: new MetorialDashboardInstanceSessionsConnectionsEndpoint(manager),
    providers: new MetorialDashboardInstanceSessionsProvidersEndpoint(manager),
    providerRuns: new MetorialDashboardInstanceSessionsProviderRunsEndpoint(manager),
    participants: new MetorialDashboardInstanceSessionsParticipantsEndpoint(manager),
    errors: new MetorialDashboardInstanceSessionsErrorsEndpoint(manager),
    errorGroups: new MetorialDashboardInstanceSessionsErrorGroupsEndpoint(manager)
  }),

  providerRuns: new MetorialDashboardInstanceProviderRunsEndpoint(manager),
  sessionErrors: new MetorialDashboardInstanceSessionErrorsEndpoint(manager),
  sessionErrorGroups: new MetorialDashboardInstanceSessionErrorGroupsEndpoint(manager),

  sessionTemplates: Object.assign(
    new MetorialDashboardInstanceSessionTemplatesEndpoint(manager),
    { providers: new MetorialDashboardInstanceSessionTemplatesProvidersEndpoint(manager) }
  )
}));

export type MetorialDashboardSDK = ReturnType<typeof createMetorialDashboardSDK>;
