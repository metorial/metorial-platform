import {
  MetorialApiKeysEndpoint,
  MetorialDashboardEndpoint,
  MetorialDashboardInstanceFilesEndpoint,
  MetorialDashboardInstanceLinksEndpoint,
  MetorialDashboardInstanceSecretsEndpoint,
  MetorialDashboardInstanceServerRunErrorGroupsEndpoint,
  MetorialDashboardInstanceServerRunErrorsEndpoint,
  MetorialDashboardInstanceServerRunsEndpoint,
  MetorialDashboardInstanceServersDeploymentsEndpoint,
  MetorialDashboardInstanceServersEndpoint,
  MetorialDashboardInstanceServersImplementationsEndpoint,
  MetorialDashboardInstanceServersVariantsEndpoint,
  MetorialDashboardInstanceServersVersionsEndpoint,
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
  MetorialDashboardUsageEndpoint,
  MetorialManagementUserEndpoint,
  MetorialServersListingsCategoriesEndpoint,
  MetorialServersListingsCollectionsEndpoint,
  MetorialServersListingsEndpoint
} from '@metorial/core/src/mt_2025_01_01_dashboard';
import { MetorialAuthEndpoint } from './auth';
import { MetorialKeyPrefix, sdkBuilder } from './builder';

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
    apiVersion: '2025-01-01-dashboard'
  })
)(manager => ({
  organizations: Object.assign(new MetorialDashboardOrganizationsEndpoint(manager), {
    invites: new MetorialDashboardOrganizationsInvitesEndpoint(manager),
    members: new MetorialDashboardOrganizationsMembersEndpoint(manager)
  }),
  organizationJoins: new MetorialDashboardOrganizationsJoinEndpoint(manager),

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

    runs: new MetorialDashboardInstanceServerRunsEndpoint(manager)
  }),

  sessions: Object.assign(new MetorialDashboardInstanceSessionsEndpoint(manager), {
    events: new MetorialDashboardInstanceSessionsEventsEndpoint(manager),
    messages: new MetorialDashboardInstanceSessionsMessagesEndpoint(manager),
    serverSessions: new MetorialDashboardInstanceSessionsServerSessionsEndpoint(manager)
  }),

  usage: new MetorialDashboardUsageEndpoint(manager)
}));

export type MetorialDashboardSDK = ReturnType<typeof createMetorialDashboardSDK>;
