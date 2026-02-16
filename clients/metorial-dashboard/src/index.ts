export type {
  DashboardInstanceProviderOauthSessionsListQuery,
  ApiKeysGetOutput as MetorialApiKey,
  DashboardBootOutput as MetorialDashboardBootOutput,
  ManagementOrganizationInstancesGetOutput as MetorialInstance,
  ManagementOrganizationGetOutput as MetorialOrganization,
  ManagementOrganizationInvitesGetOutput as MetorialOrganizationInvite,
  ManagementOrganizationMembersGetOutput as MetorialOrganizationMember,
  ManagementOrganizationProjectsGetOutput as MetorialProject,
  ManagementUserGetOutput as MetorialUser,
  SessionsGetOutput,
  SessionsListQuery
} from './gen/src/mt_2025_01_01_dashboard';

// Session types from Dashboard API (Provider API format)
export type {
  DashboardInstanceSessionsCreateBody,
  DashboardInstanceSessionsGetOutput,
  DashboardInstanceSessionsListOutput,
  DashboardInstanceSessionsListQuery
} from './gen/src/mt_2026_02_01_dashboard';

export * from './sdk.js';
