import { createFetchWithRetry } from '@metorial/fetch';
import { MetorialAuthEndpoint } from './auth';
import { MetorialKeyPrefix, sdkBuilder } from './builder';
import {
  MetorialApiKeysEndpoint,
  MetorialDashboardEndpoint,
  MetorialDashboardInstanceCustomProvidersCodeEndpoint,
  MetorialDashboardInstanceCustomProvidersCommitsEndpoint,
  MetorialDashboardInstanceCustomProvidersDeploymentsEndpoint,
  MetorialDashboardInstanceCustomProvidersEndpoint,
  MetorialDashboardInstanceCustomProvidersEnvironmentsEndpoint,
  MetorialDashboardInstanceCustomProvidersVersionsEndpoint,
  MetorialDashboardInstanceFileLinksEndpoint,
  MetorialDashboardInstanceFilesEndpoint,
  MetorialDashboardInstanceMagicMcpGroupsEndpoint,
  MetorialDashboardInstanceMagicMcpServersEndpoint,
  MetorialDashboardInstanceMagicMcpSessionsEndpoint,
  MetorialDashboardInstanceMagicMcpTokensEndpoint,
  MetorialDashboardInstancePortalsAccessRequestsEndpoint,
  MetorialDashboardInstancePortalsAuthAppEndpoint,
  MetorialDashboardInstancePortalsAuthSsoTenantsConnectionsEndpoint,
  MetorialDashboardInstancePortalsAuthSsoTenantsEndpoint,
  MetorialDashboardInstancePortalsConsumerAccessEndpoint,
  MetorialDashboardInstancePortalsConsumerGroupsEndpoint,
  MetorialDashboardInstancePortalsConsumerProfilesEndpoint,
  MetorialDashboardInstancePortalsEndpoint,
  MetorialDashboardInstanceProviderCategoriesEndpoint,
  MetorialDashboardInstanceProviderCollectionsEndpoint,
  MetorialDashboardInstanceProviderDeploymentsAuthConfigsEndpoint,
  MetorialDashboardInstanceProviderDeploymentsAuthConfigsExportsEndpoint,
  MetorialDashboardInstanceProviderDeploymentsAuthConfigsImportsEndpoint,
  MetorialDashboardInstanceProviderDeploymentsAuthCredentialsEndpoint,
  MetorialDashboardInstanceProviderDeploymentsConfigsEndpoint,
  MetorialDashboardInstanceProviderDeploymentsConfigVaultsEndpoint,
  MetorialDashboardInstanceProviderDeploymentsEndpoint,
  MetorialDashboardInstanceProviderDeploymentsSetupSessionsEndpoint,
  MetorialDashboardInstanceProviderGroupsEndpoint,
  MetorialDashboardInstanceProviderListingsEndpoint,
  MetorialDashboardInstanceProviderRunsEndpoint,
  MetorialDashboardInstanceProviderTemplatesEndpoint,
  MetorialDashboardInstanceProvidersAuthMethodsEndpoint,
  MetorialDashboardInstanceProvidersEndpoint,
  MetorialDashboardInstanceProvidersSpecificationsEndpoint,
  MetorialDashboardInstanceProvidersToolsEndpoint,
  MetorialDashboardInstanceProvidersVersionsEndpoint,
  MetorialDashboardInstancePublishersEndpoint,
  MetorialDashboardInstanceScmAccountsEndpoint,
  MetorialDashboardInstanceScmInstallationEndpoint,
  MetorialDashboardInstanceScmReposEndpoint,
  MetorialDashboardInstanceSessionsConnectionsEndpoint,
  MetorialDashboardInstanceSessionsEndpoint,
  MetorialDashboardInstanceSessionsErrorGroupsEndpoint,
  MetorialDashboardInstanceSessionsErrorsEndpoint,
  MetorialDashboardInstanceSessionsEventsEndpoint,
  MetorialDashboardInstanceSessionsMessagesEndpoint,
  MetorialDashboardInstanceSessionsParticipantsEndpoint,
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
    apiVersion?: '2025-01-01-dashboard';
    headers?: Record<string, string>;
    apiHost?: string;
    organizationId?: string;
    instanceId?: string;
  }) => ({
    ...soft,
    apiVersion: '2025-01-01-dashboard',
    fetch: fetchWithRetryAndLogging,
    enableDebugLogging: true
  })
)(manager => ({
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
    links: new MetorialDashboardInstanceFileLinksEndpoint(manager)
  }),

  magicMcp: {
    servers: new MetorialDashboardInstanceMagicMcpServersEndpoint(manager),
    sessions: new MetorialDashboardInstanceMagicMcpSessionsEndpoint(manager),
    tokens: new MetorialDashboardInstanceMagicMcpTokensEndpoint(manager),
    groups: new MetorialDashboardInstanceMagicMcpGroupsEndpoint(manager)
  },

  portals: Object.assign(new MetorialDashboardInstancePortalsEndpoint(manager), {
    consumerGroups: new MetorialDashboardInstancePortalsConsumerGroupsEndpoint(manager),
    consumerAccess: new MetorialDashboardInstancePortalsConsumerAccessEndpoint(manager),
    consumerProfiles: new MetorialDashboardInstancePortalsConsumerProfilesEndpoint(manager),
    auth: {
      app: new MetorialDashboardInstancePortalsAuthAppEndpoint(manager),
      ssoTenants: Object.assign(
        new MetorialDashboardInstancePortalsAuthSsoTenantsEndpoint(manager),
        {
          connections:
            new MetorialDashboardInstancePortalsAuthSsoTenantsConnectionsEndpoint(
              manager
            )
        }
      )
    },
    accessRequests: new MetorialDashboardInstancePortalsAccessRequestsEndpoint(
      manager
    )
  }),

  providerTemplates: new MetorialDashboardInstanceProviderTemplatesEndpoint(manager),

  usage: new MetorialDashboardUsageEndpoint(manager),

  teams: Object.assign(new MetorialDashboardOrganizationsTeamsEndpoint(manager), {
    roles: new MetorialDashboardOrganizationsTeamsRolesEndpoint(manager),
    projects: new MetorialDashboardOrganizationsTeamsProjectsEndpoint(manager),
    members: new MetorialDashboardOrganizationsTeamsMembersEndpoint(manager)
  }),

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

  providers: Object.assign(new MetorialDashboardInstanceProvidersEndpoint(manager), {
    versions: new MetorialDashboardInstanceProvidersVersionsEndpoint(manager),
    tools: new MetorialDashboardInstanceProvidersToolsEndpoint(manager),
    authMethods: new MetorialDashboardInstanceProvidersAuthMethodsEndpoint(manager),
    authConfigs: new MetorialDashboardInstanceProviderDeploymentsAuthConfigsEndpoint(manager),
    specifications: new MetorialDashboardInstanceProvidersSpecificationsEndpoint(manager),
    listings: new MetorialDashboardInstanceProviderListingsEndpoint(manager),
    categories: new MetorialDashboardInstanceProviderCategoriesEndpoint(manager),
    collections: new MetorialDashboardInstanceProviderCollectionsEndpoint(manager),
    groups: new MetorialDashboardInstanceProviderGroupsEndpoint(manager),
    publishers: new MetorialDashboardInstancePublishersEndpoint(manager)
  }),

  providerDeployments: Object.assign(
    new MetorialDashboardInstanceProviderDeploymentsEndpoint(manager),
    {
      configs: new MetorialDashboardInstanceProviderDeploymentsConfigsEndpoint(manager),
      configVaults: new MetorialDashboardInstanceProviderDeploymentsConfigVaultsEndpoint(
        manager
      ),
      authConfigs: Object.assign(
        new MetorialDashboardInstanceProviderDeploymentsAuthConfigsEndpoint(manager),
        {
          exports: new MetorialDashboardInstanceProviderDeploymentsAuthConfigsExportsEndpoint(
            manager
          ),
          imports: new MetorialDashboardInstanceProviderDeploymentsAuthConfigsImportsEndpoint(
            manager
          )
        }
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
    participants: new MetorialDashboardInstanceSessionsParticipantsEndpoint(manager),
    errors: new MetorialDashboardInstanceSessionsErrorsEndpoint(manager),
    errorGroups: new MetorialDashboardInstanceSessionsErrorGroupsEndpoint(manager)
  }),

  providerRuns: new MetorialDashboardInstanceProviderRunsEndpoint(manager),
  sessionErrors: new MetorialDashboardInstanceSessionsErrorsEndpoint(manager),
  sessionErrorGroups: new MetorialDashboardInstanceSessionsErrorGroupsEndpoint(manager),

  sessionTemplates: Object.assign(
    new MetorialDashboardInstanceSessionTemplatesEndpoint(manager),
    {
      providers: new MetorialDashboardInstanceSessionTemplatesProvidersEndpoint(manager)
    }
  ),

  scm: {
    installation: new MetorialDashboardInstanceScmInstallationEndpoint(manager),
    repos: new MetorialDashboardInstanceScmReposEndpoint(manager),
    accounts: new MetorialDashboardInstanceScmAccountsEndpoint(manager)
  }
}));

export type MetorialDashboardSDK = ReturnType<typeof createMetorialDashboardSDK>;
