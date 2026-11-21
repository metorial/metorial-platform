import {
  DashboardInstanceAgentTrackingFilterValuesListQuery,
  DashboardInstanceAgentTrackingIngestSourcesCreateBody,
  DashboardInstanceAgentTrackingIngestSourcesListQuery,
  DashboardInstanceAgentTrackingMembersListQuery,
  DashboardInstanceAgentTrackingSessionsListQuery,
  DashboardInstanceAgentTrackingSettingsUpdateBody,
  DashboardInstanceAgentTrackingSpendBreakdownQuery,
  DashboardInstanceAgentTrackingSpendTimelineQuery,
  DashboardOrganizationsConfigureAgentTrackingUpdateBody,
  DashboardProjectsConfigureAgentTrackingUpdateBody
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let agentTrackingIngestSourcesLoader = createLoader({
  name: 'agentTrackingIngestSources',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceAgentTrackingIngestSourcesListQuery) =>
    withAuth(sdk => sdk.agentTracking.ingestSources.list(i.instanceId, i)),
  mutators: {}
});

export let useAgentTrackingIngestSources = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceAgentTrackingIngestSourcesListQuery | null
) =>
  usePaginator(
    pagination =>
      agentTrackingIngestSourcesLoader.use(
        instanceId && query !== null ? { instanceId, ...pagination, ...(query ?? {}) } : null
      ),
    JSON.stringify([instanceId, query ?? {}])
  );

export let useCreateAgentTrackingIngestSource =
  agentTrackingIngestSourcesLoader.createExternalMutator(
    (i: DashboardInstanceAgentTrackingIngestSourcesCreateBody & { instanceId: string }) =>
      withAuth(sdk =>
        sdk.agentTracking.ingestSources.create(i.instanceId, {
          name: i.name,
          clientFamily: i.clientFamily
        })
      ),
    { disableToast: true }
  );

export let useRevokeAgentTrackingIngestSource =
  agentTrackingIngestSourcesLoader.createExternalMutator(
    (i: { instanceId: string; ingestSourceId: string }) =>
      withAuth(sdk => sdk.agentTracking.ingestSources.revoke(i.instanceId, i.ingestSourceId))
  );

export let agentTrackingSetupStatusLoader = createLoader({
  name: 'agentTrackingSetupStatus',
  parents: [],
  fetch: (i: { instanceId: string }) =>
    withAuth(sdk => sdk.agentTracking.setupStatus.get(i.instanceId)),
  mutators: {}
});

export let useAgentTrackingSetupStatus = (instanceId: string | null | undefined) =>
  agentTrackingSetupStatusLoader.use(instanceId ? { instanceId } : null);

export let agentTrackingSpendTimelineLoader = createLoader({
  name: 'agentTrackingSpendTimeline',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceAgentTrackingSpendTimelineQuery) =>
    withAuth(sdk => sdk.agentTracking.spend.timeline(i.instanceId, i)),
  mutators: {}
});

export let useAgentTrackingSpendTimeline = (
  instanceId: string | null | undefined,
  query: DashboardInstanceAgentTrackingSpendTimelineQuery | null
) =>
  agentTrackingSpendTimelineLoader.use(instanceId && query ? { instanceId, ...query } : null);

export let agentTrackingSpendBreakdownLoader = createLoader({
  name: 'agentTrackingSpendBreakdown',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceAgentTrackingSpendBreakdownQuery) =>
    withAuth(sdk => sdk.agentTracking.spend.breakdown(i.instanceId, i)),
  mutators: {}
});

export let useAgentTrackingSpendBreakdown = (
  instanceId: string | null | undefined,
  query: DashboardInstanceAgentTrackingSpendBreakdownQuery | null
) =>
  agentTrackingSpendBreakdownLoader.use(instanceId && query ? { instanceId, ...query } : null);

export let agentTrackingSessionsLoader = createLoader({
  name: 'agentTrackingSessions',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceAgentTrackingSessionsListQuery) =>
    withAuth(sdk => sdk.agentTracking.sessions.list(i.instanceId, i)),
  mutators: {}
});

export let useAgentTrackingSessions = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceAgentTrackingSessionsListQuery | null
) =>
  usePaginator(
    pagination =>
      agentTrackingSessionsLoader.use(
        instanceId && query !== null ? { instanceId, ...pagination, ...(query ?? {}) } : null
      ),
    JSON.stringify([instanceId, query ?? {}])
  );

export let agentTrackingSessionLoader = createLoader({
  name: 'agentTrackingSession',
  parents: [],
  fetch: (i: { instanceId: string; sessionId: string }) =>
    withAuth(sdk => sdk.agentTracking.sessions.get(i.instanceId, i.sessionId)),
  mutators: {}
});

export let useAgentTrackingSession = (
  instanceId: string | null | undefined,
  sessionId: string | null | undefined
) =>
  agentTrackingSessionLoader.use(instanceId && sessionId ? { instanceId, sessionId } : null);

export let agentTrackingFilterValuesLoader = createLoader({
  name: 'agentTrackingFilterValues',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceAgentTrackingFilterValuesListQuery) =>
    withAuth(sdk => sdk.agentTracking.filterValues.list(i.instanceId, i)),
  mutators: {}
});

export let useAgentTrackingFilterValues = (
  instanceId: string | null | undefined,
  query: DashboardInstanceAgentTrackingFilterValuesListQuery | null
) =>
  agentTrackingFilterValuesLoader.use(instanceId && query ? { instanceId, ...query } : null);

export let agentTrackingMembersLoader = createLoader({
  name: 'agentTrackingMembers',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceAgentTrackingMembersListQuery) =>
    withAuth(sdk => sdk.agentTracking.members.list(i.instanceId, i)),
  mutators: {}
});

export let useAgentTrackingMembers = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceAgentTrackingMembersListQuery | null
) =>
  usePaginator(
    pagination =>
      agentTrackingMembersLoader.use(
        instanceId && query !== null ? { instanceId, ...pagination, ...(query ?? {}) } : null
      ),
    JSON.stringify([instanceId, query ?? {}])
  );

export let agentTrackingInstanceSettingsLoader = createLoader({
  name: 'agentTrackingInstanceSettings',
  parents: [],
  fetch: (i: { instanceId: string }) =>
    withAuth(sdk => sdk.agentTracking.settings.get(i.instanceId)),
  mutators: {
    update: (
      body: DashboardInstanceAgentTrackingSettingsUpdateBody,
      { input: { instanceId } }
    ) => withAuth(sdk => sdk.agentTracking.settings.update(instanceId, body))
  }
});

export let useAgentTrackingInstanceSettings = (instanceId: string | null | undefined) => {
  let data = agentTrackingInstanceSettingsLoader.use(instanceId ? { instanceId } : null);

  return { ...data, useUpdateMutator: data.useMutator('update') };
};

export let agentTrackingOrganizationSettingsLoader = createLoader({
  name: 'agentTrackingOrganizationSettings',
  parents: [
    agentTrackingInstanceSettingsLoader,
    agentTrackingSpendTimelineLoader,
    agentTrackingSpendBreakdownLoader,
    agentTrackingSessionsLoader,
    agentTrackingSessionLoader,
    agentTrackingFilterValuesLoader,
    agentTrackingMembersLoader
  ],
  fetch: (i: { organizationId: string }) =>
    withAuth(sdk => sdk.organizations.configureAgentTracking.get(i.organizationId)),
  mutators: {
    update: (
      body: DashboardOrganizationsConfigureAgentTrackingUpdateBody,
      { input: { organizationId } }
    ) => withAuth(sdk => sdk.organizations.configureAgentTracking.update(organizationId, body))
  }
});

export let useAgentTrackingOrganizationSettings = (
  organizationId: string | null | undefined
) => {
  let data = agentTrackingOrganizationSettingsLoader.use(
    organizationId ? { organizationId } : null
  );

  return { ...data, useUpdateMutator: data.useMutator('update') };
};

export let agentTrackingProjectSettingsLoader = createLoader({
  name: 'agentTrackingProjectSettings',
  parents: [],
  fetch: (i: { organizationId: string; projectId: string }) =>
    withAuth(sdk => sdk.projects.configureAgentTracking.get(i.organizationId, i.projectId)),
  mutators: {
    update: (
      body: DashboardProjectsConfigureAgentTrackingUpdateBody,
      { input: { organizationId, projectId } }
    ) =>
      withAuth(sdk =>
        sdk.projects.configureAgentTracking.update(organizationId, projectId, body)
      )
  }
});

export let useAgentTrackingProjectSettings = (
  organizationId: string | null | undefined,
  projectId: string | null | undefined
) => {
  let data = agentTrackingProjectSettingsLoader.use(
    organizationId && projectId ? { organizationId, projectId } : null
  );

  return { ...data, useUpdateMutator: data.useMutator('update') };
};
