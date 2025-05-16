import {
  MetorialApiKeysEndpoint,
  MetorialDashboardEndpoint,
  MetorialDashboardInstanceFilesEndpoint,
  MetorialDashboardInstanceLinksEndpoint,
  MetorialDashboardInstanceSecretsEndpoint,
  MetorialDashboardInstanceServersDeploymentsEndpoint,
  MetorialDashboardInstanceServersEndpoint,
  MetorialDashboardInstanceServersImplementationsEndpoint,
  MetorialDashboardInstanceServersVariantsEndpoint,
  MetorialDashboardInstanceServersVersionsEndpoint,
  MetorialDashboardOrganizationsEndpoint,
  MetorialDashboardOrganizationsInstancesEndpoint,
  MetorialDashboardOrganizationsInvitesEndpoint,
  MetorialDashboardOrganizationsJoinEndpoint,
  MetorialDashboardOrganizationsMembersEndpoint,
  MetorialDashboardOrganizationsProjectsEndpoint,
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
    implementations: new MetorialDashboardInstanceServersImplementationsEndpoint(manager)
  })
}));

export type MetorialDashboardSDK = ReturnType<typeof createMetorialDashboardSDK>;
