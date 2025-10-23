import { createFetchWithRetry } from '@metorial/fetch';
import { MetorialAuthEndpoint } from './auth';
import { MetorialKeyPrefix, sdkBuilder } from './builder';
import {
  MetorialApiKeysEndpoint,
  MetorialCustomServersManagedServerTemplatesEndpoint,
  MetorialDashboardEndpoint,
  MetorialDashboardInstanceCallbacksDestinationsEndpoint,
  MetorialDashboardInstanceCallbacksEndpoint,
  MetorialDashboardInstanceCallbacksEventsEndpoint,
  MetorialDashboardInstanceCallbacksNotificationsEndpoint,
  MetorialDashboardInstanceCustomServersCodeEndpoint,
  MetorialDashboardInstanceCustomServersDeploymentsEndpoint,
  MetorialDashboardInstanceCustomServersEndpoint,
  MetorialDashboardInstanceCustomServersEventsEndpoint,
  MetorialDashboardInstanceCustomServersListingEndpoint,
  MetorialDashboardInstanceCustomServersRemoteServersEndpoint,
  MetorialDashboardInstanceCustomServersVersionsEndpoint,
  MetorialDashboardInstanceFilesEndpoint,
  MetorialDashboardInstanceLinksEndpoint,
  MetorialDashboardInstanceMagicMcpServersEndpoint,
  MetorialDashboardInstanceMagicMcpSessionsEndpoint,
  MetorialDashboardInstanceMagicMcpTokensEndpoint,
  MetorialDashboardInstanceProviderOauthConnectionsAuthenticationsEndpoint,
  MetorialDashboardInstanceProviderOauthConnectionsEndpoint,
  MetorialDashboardInstanceProviderOauthConnectionsEventsEndpoint,
  MetorialDashboardInstanceProviderOauthConnectionsProfilesEndpoint,
  MetorialDashboardInstanceProviderOauthSessionsEndpoint,
  MetorialDashboardInstanceSecretsEndpoint,
  MetorialDashboardInstanceServerRunErrorGroupsEndpoint,
  MetorialDashboardInstanceServerRunErrorsEndpoint,
  MetorialDashboardInstanceServerRunsEndpoint,
  MetorialDashboardInstanceServersCapabilitiesEndpoint,
  MetorialDashboardInstanceServersDeploymentsEndpoint,
  MetorialDashboardInstanceServersEndpoint,
  MetorialDashboardInstanceServersImplementationsEndpoint,
  MetorialDashboardInstanceServersVariantsEndpoint,
  MetorialDashboardInstanceServersVersionsEndpoint,
  MetorialDashboardInstanceSessionsConnectionsEndpoint,
  MetorialDashboardInstanceSessionsEndpoint,
  MetorialDashboardInstanceSessionsEventsEndpoint,
  MetorialDashboardInstanceSessionsMessagesEndpoint,
  MetorialDashboardInstanceSessionsServerSessionsEndpoint,
  MetorialDashboardOrganizationsEndpoint,
  MetorialDashboardOrganizationsInstancesEndpoint,
  MetorialDashboardOrganizationsInvitesEndpoint,
  MetorialDashboardOrganizationsJoinEndpoint,
  MetorialDashboardOrganizationsMembersEndpoint,
  MetorialDashboardOrganizationsProjectsEndpoint,
  MetorialDashboardScmAccountsEndpoint,
  MetorialDashboardScmInstallationsEndpoint,
  MetorialDashboardScmReposEndpoint,
  MetorialDashboardUsageEndpoint,
  MetorialManagementUserEndpoint,
  MetorialOrganizationsProfileEndpoint,
  MetorialProviderOauthConnectionTemplateEndpoint,
  MetorialProviderOauthEndpoint,
  MetorialServersListingsCategoriesEndpoint,
  MetorialServersListingsCollectionsEndpoint,
  MetorialServersListingsEndpoint
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
    links: new MetorialDashboardInstanceLinksEndpoint(manager)
  }),

  secrets: new MetorialDashboardInstanceSecretsEndpoint(manager),

  servers: Object.assign(new MetorialDashboardInstanceServersEndpoint(manager), {
    listings: Object.assign(new MetorialServersListingsEndpoint(manager), {
      collections: new MetorialServersListingsCollectionsEndpoint(manager),
      categories: new MetorialServersListingsCategoriesEndpoint(manager)
    }),

    variants: new MetorialDashboardInstanceServersVariantsEndpoint(manager),
    versions: new MetorialDashboardInstanceServersVersionsEndpoint(manager),

    deployments: new MetorialDashboardInstanceServersDeploymentsEndpoint(manager),
    implementations: new MetorialDashboardInstanceServersImplementationsEndpoint(manager),

    errors: Object.assign(new MetorialDashboardInstanceServerRunErrorsEndpoint(manager), {
      groups: new MetorialDashboardInstanceServerRunErrorGroupsEndpoint(manager)
    }),

    runs: new MetorialDashboardInstanceServerRunsEndpoint(manager),

    capabilities: new MetorialDashboardInstanceServersCapabilitiesEndpoint(manager)
  }),

  magicMcp: {
    servers: new MetorialDashboardInstanceMagicMcpServersEndpoint(manager),
    sessions: new MetorialDashboardInstanceMagicMcpSessionsEndpoint(manager),
    tokens: new MetorialDashboardInstanceMagicMcpTokensEndpoint(manager)
  },

  providerOauth: Object.assign(new MetorialProviderOauthEndpoint(manager), {
    connections: Object.assign(
      new MetorialDashboardInstanceProviderOauthConnectionsEndpoint(manager),
      {
        profiles: new MetorialDashboardInstanceProviderOauthConnectionsProfilesEndpoint(
          manager
        ),
        authentications:
          new MetorialDashboardInstanceProviderOauthConnectionsAuthenticationsEndpoint(
            manager
          ),
        events: new MetorialDashboardInstanceProviderOauthConnectionsEventsEndpoint(manager),

        templates: new MetorialProviderOauthConnectionTemplateEndpoint(manager)
      }
    ),

    sessions: new MetorialDashboardInstanceProviderOauthSessionsEndpoint(manager)
  }),

  customServers: Object.assign(new MetorialDashboardInstanceCustomServersEndpoint(manager), {
    versions: new MetorialDashboardInstanceCustomServersVersionsEndpoint(manager),
    events: new MetorialDashboardInstanceCustomServersEventsEndpoint(manager),
    deployments: new MetorialDashboardInstanceCustomServersDeploymentsEndpoint(manager),
    remoteServers: new MetorialDashboardInstanceCustomServersRemoteServersEndpoint(manager),
    code: new MetorialDashboardInstanceCustomServersCodeEndpoint(manager),
    managedServerTemplates: new MetorialCustomServersManagedServerTemplatesEndpoint(manager),
    listing: new MetorialDashboardInstanceCustomServersListingEndpoint(manager)
  }),

  sessions: Object.assign(new MetorialDashboardInstanceSessionsEndpoint(manager), {
    events: new MetorialDashboardInstanceSessionsEventsEndpoint(manager),
    messages: new MetorialDashboardInstanceSessionsMessagesEndpoint(manager),
    serverSessions: new MetorialDashboardInstanceSessionsServerSessionsEndpoint(manager),
    connections: new MetorialDashboardInstanceSessionsConnectionsEndpoint(manager)
  }),

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
  })
}));

export type MetorialDashboardSDK = ReturnType<typeof createMetorialDashboardSDK>;
