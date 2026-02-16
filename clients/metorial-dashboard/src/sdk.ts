import { createFetchWithRetry } from '@metorial/fetch';
import { MetorialAuthEndpoint } from './auth';
import { MetorialKeyPrefix, sdkBuilder } from './builder';
import {
  MetorialApiKeysEndpoint,
  MetorialDashboardEndpoint,
  MetorialDashboardInstanceCallbacksDestinationsEndpoint,
  MetorialDashboardInstanceCallbacksEndpoint,
  MetorialDashboardInstanceCallbacksEventsEndpoint,
  MetorialDashboardInstanceCallbacksNotificationsEndpoint,
  MetorialDashboardInstanceCustomServersListingEndpoint,
  MetorialDashboardInstanceFilesEndpoint,
  MetorialDashboardInstanceLinksEndpoint,
  MetorialDashboardInstancePortalsConsumerAccessEndpoint,
  MetorialDashboardInstancePortalsConsumerAuthFactorsEndpoint,
  MetorialDashboardInstancePortalsConsumerGroupsEndpoint,
  MetorialDashboardInstancePortalsConsumerProfilesEndpoint,
  MetorialDashboardInstancePortalsConsumerServerRequestsEndpoint,
  MetorialDashboardInstancePortalsEndpoint,
  MetorialDashboardInstancePortalsFeaturedServersEndpoint,
  MetorialDashboardInstanceProviderOauthSessionsEndpoint,
  MetorialDashboardInstanceSecretsEndpoint,
  MetorialDashboardInstanceServerConfigVaultsEndpoint,
  MetorialDashboardInstanceServerRunErrorGroupsEndpoint,
  MetorialDashboardInstanceServerRunErrorsEndpoint,
  MetorialDashboardInstanceServerRunsEndpoint,
  MetorialDashboardInstanceServersCapabilitiesEndpoint,
  MetorialDashboardInstanceServersDeploymentsEndpoint,
  MetorialDashboardInstanceServersDeploymentsTemplatesEndpoint,
  MetorialDashboardInstanceServersEndpoint,
  MetorialDashboardInstanceServersImplementationsEndpoint,
  MetorialDashboardInstanceServersVariantsEndpoint,
  MetorialDashboardInstanceServersVersionsEndpoint,
  MetorialDashboardInstanceSessionsConnectionsEndpoint,
  MetorialDashboardInstanceSessionsEndpoint,
  MetorialDashboardInstanceSessionsEventsEndpoint,
  MetorialDashboardInstanceSessionsMessagesEndpoint,
  MetorialDashboardInstanceSessionsServerSessionsEndpoint,
  MetorialDashboardInstanceSessionsProvidersEndpoint,
  MetorialDashboardInstanceSessionsProviderRunsEndpoint,
  MetorialDashboardInstanceSessionsParticipantsEndpoint,
  MetorialDashboardInstanceSessionsErrorsEndpoint,
  MetorialDashboardInstanceSessionsErrorGroupsEndpoint,
  MetorialDashboardInstanceSsoTenantsEndpoint,
  MetorialDashboardInstanceSsoTenantsProfilesEndpoint,
  MetorialDashboardInstanceSsoTenantsUsersEndpoint,
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
  MetorialDashboardScmAccountsEndpoint,
  MetorialDashboardScmInstallationsEndpoint,
  MetorialDashboardScmReposEndpoint,
  MetorialDashboardUsageEndpoint,
  MetorialManagementUserEndpoint,
  MetorialOrganizationsProfileEndpoint,
  MetorialServersListingsCategoriesEndpoint,
  MetorialServersListingsCollectionsEndpoint,
  MetorialServersListingsEndpoint,
  // Provider API (Magnetar) endpoints
  MetorialDashboardInstanceProvidersEndpoint,
  MetorialDashboardInstanceProvidersVersionsEndpoint,
  MetorialDashboardInstanceProvidersToolsEndpoint,
  MetorialDashboardInstanceProvidersAuthMethodsEndpoint,
  MetorialDashboardInstanceProvidersAuthConfigsEndpoint,
  MetorialDashboardInstanceProvidersSpecificationsEndpoint,
  MetorialDashboardInstanceProviderDeploymentsEndpoint,
  MetorialDashboardInstanceProviderDeploymentsConfigsEndpoint,
  MetorialDashboardInstanceProviderDeploymentsConfigVaultsEndpoint,
  MetorialDashboardInstanceProviderDeploymentsAuthConfigsEndpoint,
  MetorialDashboardInstanceProviderDeploymentsAuthCredentialsEndpoint,
  MetorialDashboardInstanceProviderDeploymentsSetupSessionsEndpoint,
  MetorialDashboardInstanceSessionTemplatesEndpoint,
  MetorialDashboardInstanceSessionTemplatesProvidersEndpoint,
  MetorialDashboardInstanceProviderGroupsEndpoint,
  MetorialDashboardInstanceProviderCategoriesEndpoint,
  MetorialDashboardInstanceProviderCollectionsEndpoint,
  MetorialDashboardInstanceProviderListingsEndpoint,
  MetorialDashboardInstanceProviderRunsEndpoint,
  MetorialDashboardInstanceSessionErrorsEndpoint,
  MetorialDashboardInstanceSessionErrorGroupsEndpoint,
  MetorialDashboardInstanceCustomProvidersEndpoint,
  MetorialDashboardInstanceCustomProvidersVersionsEndpoint,
  MetorialDashboardInstanceCustomProvidersDeploymentsEndpoint,
  MetorialDashboardInstanceCustomProvidersCommitsEndpoint,
  MetorialDashboardInstanceCustomProvidersEnvironmentsEndpoint,
  MetorialDashboardInstanceCustomProvidersCodeEndpoint
} from './gen/src/mt_2026_02_01_dashboard';

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

// Legacy API structure (v1) - uses 'serverDeployments' format
let createLegacyApiEndpoints = (manager: any) => ({
  servers: Object.assign(new MetorialDashboardInstanceServersEndpoint(manager), {
    listings: Object.assign(new MetorialServersListingsEndpoint(manager), {
      collections: new MetorialServersListingsCollectionsEndpoint(manager),
      categories: new MetorialServersListingsCategoriesEndpoint(manager)
    }),
    variants: new MetorialDashboardInstanceServersVariantsEndpoint(manager),
    versions: new MetorialDashboardInstanceServersVersionsEndpoint(manager),
    deployments: Object.assign(
      new MetorialDashboardInstanceServersDeploymentsEndpoint(manager),
      {
        templates: new MetorialDashboardInstanceServersDeploymentsTemplatesEndpoint(manager)
      }
    ),
    implementations: new MetorialDashboardInstanceServersImplementationsEndpoint(manager),
    errors: Object.assign(new MetorialDashboardInstanceServerRunErrorsEndpoint(manager), {
      groups: new MetorialDashboardInstanceServerRunErrorGroupsEndpoint(manager)
    }),
    runs: new MetorialDashboardInstanceServerRunsEndpoint(manager),
    capabilities: new MetorialDashboardInstanceServersCapabilitiesEndpoint(manager),
    configVaults: new MetorialDashboardInstanceServerConfigVaultsEndpoint(manager)
  }),
  sessions: Object.assign(new MetorialDashboardInstanceSessionsEndpoint(manager), {
    events: new MetorialDashboardInstanceSessionsEventsEndpoint(manager),
    messages: new MetorialDashboardInstanceSessionsMessagesEndpoint(manager),
    serverSessions: new MetorialDashboardInstanceSessionsServerSessionsEndpoint(manager),
    connections: new MetorialDashboardInstanceSessionsConnectionsEndpoint(manager)
  })
});

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

  secrets: new MetorialDashboardInstanceSecretsEndpoint(manager),

  usage: new MetorialDashboardUsageEndpoint(manager),

  scm: {
    installation: new MetorialDashboardScmInstallationsEndpoint(manager),
    repos: new MetorialDashboardScmReposEndpoint(manager),
    accounts: new MetorialDashboardScmAccountsEndpoint(manager)
  },

  callbacks: Object.assign(new MetorialDashboardInstanceCallbacksEndpoint(manager), {
    events: new MetorialDashboardInstanceCallbacksEventsEndpoint(manager),
    notifications: new MetorialDashboardInstanceCallbacksNotificationsEndpoint(manager),
    destinations: new MetorialDashboardInstanceCallbacksDestinationsEndpoint(manager)
  }),

  teams: Object.assign(new MetorialDashboardOrganizationsTeamsEndpoint(manager), {
    roles: new MetorialDashboardOrganizationsTeamsRolesEndpoint(manager),
    projects: new MetorialDashboardOrganizationsTeamsProjectsEndpoint(manager),
    members: new MetorialDashboardOrganizationsTeamsMembersEndpoint(manager)
  }),

  portals: Object.assign(new MetorialDashboardInstancePortalsEndpoint(manager), {
    consumerProfiles: new MetorialDashboardInstancePortalsConsumerProfilesEndpoint(manager),
    consumerGroups: new MetorialDashboardInstancePortalsConsumerGroupsEndpoint(manager),
    consumerAccess: new MetorialDashboardInstancePortalsConsumerAccessEndpoint(manager),
    consumerAuthFactors: new MetorialDashboardInstancePortalsConsumerAuthFactorsEndpoint(
      manager
    ),
    consumerServerRequests: new MetorialDashboardInstancePortalsConsumerServerRequestsEndpoint(
      manager
    ),
    featuredServers: new MetorialDashboardInstancePortalsFeaturedServersEndpoint(manager)
  }),

  ssoTenants: Object.assign(new MetorialDashboardInstanceSsoTenantsEndpoint(manager), {
    profiles: new MetorialDashboardInstanceSsoTenantsProfilesEndpoint(manager),
    users: new MetorialDashboardInstanceSsoTenantsUsersEndpoint(manager)
  }),

  providerOauth: {
    sessions: new MetorialDashboardInstanceProviderOauthSessionsEndpoint(manager)
  },

  customServers: {
    listing: new MetorialDashboardInstanceCustomServersListingEndpoint(manager)
  },

  customProviders: Object.assign(
    new MetorialDashboardInstanceCustomProvidersEndpoint(manager),
    {
      versions: new MetorialDashboardInstanceCustomProvidersVersionsEndpoint(manager),
      deployments: new MetorialDashboardInstanceCustomProvidersDeploymentsEndpoint(manager),
      commits: new MetorialDashboardInstanceCustomProvidersCommitsEndpoint(manager),
      environments: new MetorialDashboardInstanceCustomProvidersEnvironmentsEndpoint(manager),
      code: new MetorialDashboardInstanceCustomProvidersCodeEndpoint(manager)
    }
  ),

  // Legacy server endpoints (no Provider API equivalent)
  servers: {
    listings: Object.assign(new MetorialServersListingsEndpoint(manager), {
      collections: new MetorialServersListingsCollectionsEndpoint(manager),
      categories: new MetorialServersListingsCategoriesEndpoint(manager)
    }),
    variants: new MetorialDashboardInstanceServersVariantsEndpoint(manager),
    capabilities: new MetorialDashboardInstanceServersCapabilitiesEndpoint(manager),
    implementations: new MetorialDashboardInstanceServersImplementationsEndpoint(manager)
  },

  // Provider API (Magnetar) - Default API
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
      configVaults: new MetorialDashboardInstanceProviderDeploymentsConfigVaultsEndpoint(manager),
      authConfigs: new MetorialDashboardInstanceProviderDeploymentsAuthConfigsEndpoint(manager),
      authCredentials: new MetorialDashboardInstanceProviderDeploymentsAuthCredentialsEndpoint(
        manager
      ),
      setupSessions: new MetorialDashboardInstanceProviderDeploymentsSetupSessionsEndpoint(manager)
    }
  ),

  // Sessions (Provider API) - replaces legacy sessions
  sessions: Object.assign(new MetorialDashboardInstanceSessionsEndpoint(manager), {
    events: new MetorialDashboardInstanceSessionsEventsEndpoint(manager),
    messages: new MetorialDashboardInstanceSessionsMessagesEndpoint(manager),
    connections: new MetorialDashboardInstanceSessionsConnectionsEndpoint(manager),
    providers: new MetorialDashboardInstanceSessionsProvidersEndpoint(manager),
    providerRuns: new MetorialDashboardInstanceSessionsProviderRunsEndpoint(manager),
    participants: new MetorialDashboardInstanceSessionsParticipantsEndpoint(manager),
    errors: new MetorialDashboardInstanceSessionsErrorsEndpoint(manager),
    errorGroups: new MetorialDashboardInstanceSessionsErrorGroupsEndpoint(manager),
    serverSessions: new MetorialDashboardInstanceSessionsServerSessionsEndpoint(manager)
  }),

  // Instance-level logs (cross-session)
  providerRuns: new MetorialDashboardInstanceProviderRunsEndpoint(manager),
  sessionErrors: new MetorialDashboardInstanceSessionErrorsEndpoint(manager),
  sessionErrorGroups: new MetorialDashboardInstanceSessionErrorGroupsEndpoint(manager),

  sessionTemplates: Object.assign(
    new MetorialDashboardInstanceSessionTemplatesEndpoint(manager),
    {
      providers: new MetorialDashboardInstanceSessionTemplatesProvidersEndpoint(manager)
    }
  ),

  // Legacy API (v1) - For backwards compatibility
  v1: createLegacyApiEndpoints(manager)
}));

export type MetorialDashboardSDK = ReturnType<typeof createMetorialDashboardSDK>;
