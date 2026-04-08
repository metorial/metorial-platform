import { createFetchWithRetry } from '@metorial/fetch';
import { MetorialAuthEndpoint } from './auth';
import { MetorialKeyPrefix, sdkBuilder } from './builder';
import {
  MetorialDashboardEndpoint,
  MetorialDashboardInstanceCallbacksDestinationsEndpoint,
  MetorialDashboardInstanceCallbacksEndpoint,
  MetorialDashboardInstanceCallbacksEventsEndpoint,
  MetorialDashboardInstanceCallbacksInstancesEndpoint,
  MetorialDashboardInstanceCallbacksNotificationsEndpoint,
  MetorialDashboardInstanceConsumersEndpoint,
  MetorialDashboardInstanceConsumersProfilesEndpoint,
  MetorialDashboardInstanceConsumerSurfacesEndpoint,
  MetorialDashboardInstanceCustomProvidersCodeEndpoint,
  MetorialDashboardInstanceCustomProvidersCommitsEndpoint,
  MetorialDashboardInstanceCustomProvidersDeploymentsEndpoint,
  MetorialDashboardInstanceCustomProvidersEndpoint,
  MetorialDashboardInstanceCustomProvidersEnvironmentsEndpoint,
  MetorialDashboardInstanceCustomProvidersVersionsEndpoint,
  MetorialDashboardInstanceFileLinksEndpoint,
  MetorialDashboardInstanceFilesEndpoint,
  MetorialDashboardInstanceIdentitiesCredentialsEndpoint,
  MetorialDashboardInstanceIdentitiesDelegationConfigsEndpoint,
  MetorialDashboardInstanceIdentitiesDelegationRequestsEndpoint,
  MetorialDashboardInstanceIdentitiesDelegationsEndpoint,
  MetorialDashboardInstanceIdentitiesEndpoint,
  MetorialDashboardInstanceIdentityActorsEndpoint,
  MetorialDashboardInstanceMagicMcpGroupsEndpoint,
  MetorialDashboardInstanceMagicMcpServersEndpoint,
  MetorialDashboardInstanceMagicMcpServersProviderEndpoint,
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
  MetorialDashboardInstanceProvidersAuthMethodsEndpoint,
  MetorialDashboardInstanceProvidersEndpoint,
  MetorialDashboardInstanceProvidersSpecificationsEndpoint,
  MetorialDashboardInstanceProvidersToolsEndpoint,
  MetorialDashboardInstanceProvidersTriggersEndpoint,
  MetorialDashboardInstanceProvidersVersionsEndpoint,
  MetorialDashboardInstanceProviderTemplatesEndpoint,
  MetorialDashboardInstancePublishersEndpoint,
  MetorialDashboardInstanceScmAccountsEndpoint,
  MetorialDashboardInstanceScmConnectionsEndpoint,
  MetorialDashboardInstanceScmInstallationEndpoint,
  MetorialDashboardInstanceScmProvidersEndpoint,
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
  MetorialDashboardOauthAuthorizationRequestsEndpoint,
  MetorialDashboardOrganizationsAccessPoliciesEndpoint,
  MetorialDashboardOrganizationsAccessRolesEndpoint,
  MetorialDashboardOrganizationsApiKeysEndpoint,
  MetorialDashboardOrganizationsEndpoint,
  MetorialDashboardOrganizationsInstancesEndpoint,
  MetorialDashboardOrganizationsInvitesEndpoint,
  MetorialDashboardOrganizationsJoinEndpoint,
  MetorialDashboardOrganizationsMembersEndpoint,
  MetorialDashboardOrganizationsMembersPoliciesEndpoint,
  MetorialDashboardOrganizationsOauthAppsClientSecretsEndpoint,
  MetorialDashboardOrganizationsOauthAppsEndpoint,
  MetorialDashboardOrganizationsOauthAuthorizationLogsEndpoint,
  MetorialDashboardOrganizationsOauthAuthorizationsEndpoint,
  MetorialDashboardOrganizationsOauthCliDevicesEndpoint,
  MetorialDashboardOrganizationsOauthInstallationsEndpoint,
  MetorialDashboardOrganizationsOauthScopesEndpoint,
  MetorialDashboardOrganizationsProjectsBrandingEndpoint,
  MetorialDashboardOrganizationsProjectsEndpoint,
  MetorialDashboardOrganizationsServiceAccountsClientSecretsEndpoint,
  MetorialDashboardOrganizationsServiceAccountsCredentialsEndpoint,
  MetorialDashboardOrganizationsServiceAccountsEndpoint,
  MetorialDashboardOrganizationsServiceAccountsPoliciesEndpoint,
  MetorialDashboardOrganizationsTeamsEndpoint,
  MetorialDashboardOrganizationsTeamsMembersEndpoint,
  MetorialDashboardOrganizationsTeamsPoliciesEndpoint,
  MetorialDashboardUsageEndpoint,
  MetorialManagementUserEndpoint,
  MetorialOrganizationsFlagsEndpoint,
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
    metorialInstance?: string;
  }) => ({
    ...soft,

    apiVersion: '2025-01-01-dashboard',
    fetch: (a: any, b: any) => {
      let url = new URL(a);
      if (soft.metorialInstance) {
        url.searchParams.set('_m', soft.metorialInstance);
      }
      a = url.toString();

      return fetchWithRetryAndLogging(a, b);
    },
    enableDebugLogging: true
  })
)(manager => ({
  organizations: Object.assign(new MetorialDashboardOrganizationsEndpoint(manager), {
    invites: new MetorialDashboardOrganizationsInvitesEndpoint(manager),
    flags: new MetorialOrganizationsFlagsEndpoint(manager),

    members: Object.assign(new MetorialDashboardOrganizationsMembersEndpoint(manager), {
      policies: new MetorialDashboardOrganizationsMembersPoliciesEndpoint(manager)
    })
  }),

  organizationJoins: new MetorialDashboardOrganizationsJoinEndpoint(manager),

  profile: new MetorialOrganizationsProfileEndpoint(manager),

  instances: new MetorialDashboardOrganizationsInstancesEndpoint(manager),
  projects: Object.assign(new MetorialDashboardOrganizationsProjectsEndpoint(manager), {
    branding: new MetorialDashboardOrganizationsProjectsBrandingEndpoint(manager)
  }),
  user: new MetorialManagementUserEndpoint(manager),

  apiKeys: new MetorialDashboardOrganizationsApiKeysEndpoint(manager),

  auth: new MetorialAuthEndpoint(manager),

  dashboard: new MetorialDashboardEndpoint(manager),

  files: Object.assign(new MetorialDashboardInstanceFilesEndpoint(manager), {
    links: new MetorialDashboardInstanceFileLinksEndpoint(manager)
  }),

  magicMcp: {
    servers: Object.assign(new MetorialDashboardInstanceMagicMcpServersEndpoint(manager), {
      providers: new MetorialDashboardInstanceMagicMcpServersProviderEndpoint(manager)
    }),
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
          connections: new MetorialDashboardInstancePortalsAuthSsoTenantsConnectionsEndpoint(
            manager
          )
        }
      )
    },
    accessRequests: new MetorialDashboardInstancePortalsAccessRequestsEndpoint(manager)
  }),

  consumers: Object.assign(new MetorialDashboardInstanceConsumersEndpoint(manager), {
    profiles: new MetorialDashboardInstanceConsumersProfilesEndpoint(manager)
  }),
  consumerSurfaces: new MetorialDashboardInstanceConsumerSurfacesEndpoint(manager),

  accessPolicies: new MetorialDashboardOrganizationsAccessPoliciesEndpoint(manager),
  accessRoles: new MetorialDashboardOrganizationsAccessRolesEndpoint(manager),

  providerTemplates: new MetorialDashboardInstanceProviderTemplatesEndpoint(manager),

  usage: new MetorialDashboardUsageEndpoint(manager),

  oauth: {
    cliDevices: new MetorialDashboardOrganizationsOauthCliDevicesEndpoint(manager),
    authorizationRequests: new MetorialDashboardOauthAuthorizationRequestsEndpoint(manager),
    scopes: new MetorialDashboardOrganizationsOauthScopesEndpoint(manager),
    apps: Object.assign(new MetorialDashboardOrganizationsOauthAppsEndpoint(manager), {
      clientSecrets: new MetorialDashboardOrganizationsOauthAppsClientSecretsEndpoint(manager)
    }),
    authorizationLogs: new MetorialDashboardOrganizationsOauthAuthorizationLogsEndpoint(
      manager
    ),
    installations: new MetorialDashboardOrganizationsOauthInstallationsEndpoint(manager),
    authorizations: new MetorialDashboardOrganizationsOauthAuthorizationsEndpoint(manager)
  },

  serviceAccounts: Object.assign(
    new MetorialDashboardOrganizationsServiceAccountsEndpoint(manager),
    {
      clientSecrets: new MetorialDashboardOrganizationsServiceAccountsClientSecretsEndpoint(
        manager
      ),
      credentials: new MetorialDashboardOrganizationsServiceAccountsCredentialsEndpoint(
        manager
      ),
      policies: new MetorialDashboardOrganizationsServiceAccountsPoliciesEndpoint(manager)
    }
  ),

  teams: Object.assign(new MetorialDashboardOrganizationsTeamsEndpoint(manager), {
    members: new MetorialDashboardOrganizationsTeamsMembersEndpoint(manager),
    policies: new MetorialDashboardOrganizationsTeamsPoliciesEndpoint(manager)
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
    triggers: new MetorialDashboardInstanceProvidersTriggersEndpoint(manager),
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

  callbacks: Object.assign(new MetorialDashboardInstanceCallbacksEndpoint(manager), {
    destinations: new MetorialDashboardInstanceCallbacksDestinationsEndpoint(manager),
    events: new MetorialDashboardInstanceCallbacksEventsEndpoint(manager),
    notifications: new MetorialDashboardInstanceCallbacksNotificationsEndpoint(manager),
    instances: new MetorialDashboardInstanceCallbacksInstancesEndpoint(manager)
  }),

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
    accounts: new MetorialDashboardInstanceScmAccountsEndpoint(manager),
    connections: new MetorialDashboardInstanceScmConnectionsEndpoint(manager),
    providers: new MetorialDashboardInstanceScmProvidersEndpoint(manager)
  },

  identityActors: new MetorialDashboardInstanceIdentityActorsEndpoint(manager),
  identities: Object.assign(new MetorialDashboardInstanceIdentitiesEndpoint(manager), {
    credentials: new MetorialDashboardInstanceIdentitiesCredentialsEndpoint(manager),
    delegations: new MetorialDashboardInstanceIdentitiesDelegationsEndpoint(manager),
    delegationConfigs: new MetorialDashboardInstanceIdentitiesDelegationConfigsEndpoint(
      manager
    ),
    delegationRequests: new MetorialDashboardInstanceIdentitiesDelegationRequestsEndpoint(
      manager
    )
  })
}));

export type MetorialDashboardSDK = ReturnType<typeof createMetorialDashboardSDK> & {
  callbacks: MetorialDashboardInstanceCallbacksEndpoint & {
    destinations: MetorialDashboardInstanceCallbacksDestinationsEndpoint;
    events: MetorialDashboardInstanceCallbacksEventsEndpoint;
    notifications: MetorialDashboardInstanceCallbacksNotificationsEndpoint;
    instances: MetorialDashboardInstanceCallbacksInstancesEndpoint;
  };
  consumers: MetorialDashboardInstanceConsumersEndpoint & {
    profiles: MetorialDashboardInstanceConsumersProfilesEndpoint;
  };
  consumerSurfaces: MetorialDashboardInstanceConsumerSurfacesEndpoint;
};
