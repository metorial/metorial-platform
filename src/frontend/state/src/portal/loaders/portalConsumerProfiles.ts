import {
  DashboardInstancePortalsConsumerProfilesAssignGroupsBody,
  DashboardInstancePortalsConsumerProfilesListQuery,
  DashboardInstancePortalsConsumerProfilesUnassignGroupsBody
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let portalConsumerProfilesLoader = createLoader({
  name: 'portalConsumerProfiles',
  parents: [],
  fetch: (
    i: {
      instanceId: string;
      portalId: string;
    } & DashboardInstancePortalsConsumerProfilesListQuery
  ) => withAuth(sdk => sdk.portals.consumerProfiles.list(i.instanceId, i.portalId, i)),
  mutators: {}
});

export let usePortalConsumerProfiles = (
  instanceId: string | null | undefined,
  portalId: string | null | undefined,
  query?: DashboardInstancePortalsConsumerProfilesListQuery
) => {
  let resetKey = instanceId && portalId ? `${instanceId}:${portalId}` : null;

  return usePaginator(
    pagination =>
      portalConsumerProfilesLoader.use(
        instanceId && portalId ? { instanceId, portalId, ...pagination, ...query } : null
      ),
    resetKey
  );
};

export let useAssignPortalConsumerProfileGroups =
  portalConsumerProfilesLoader.createExternalMutator(
    (i: {
      instanceId: string;
      portalId: string;
      consumerProfileId: string;
      body: DashboardInstancePortalsConsumerProfilesAssignGroupsBody;
    }) =>
      withAuth(sdk =>
        sdk.portals.consumerProfiles.assignGroups(
          i.instanceId,
          i.portalId,
          i.consumerProfileId,
          i.body
        )
      )
  );

export let useUnassignPortalConsumerProfileGroups =
  portalConsumerProfilesLoader.createExternalMutator(
    (i: {
      instanceId: string;
      portalId: string;
      consumerProfileId: string;
      body: DashboardInstancePortalsConsumerProfilesUnassignGroupsBody;
    }) =>
      withAuth(sdk =>
        sdk.portals.consumerProfiles.unassignGroups(
          i.instanceId,
          i.portalId,
          i.consumerProfileId,
          i.body
        )
      )
  );

export let portalConsumerProfileLoader = createLoader({
  name: 'portalConsumerProfile',
  parents: [portalConsumerProfilesLoader],
  fetch: (i: { instanceId: string; portalId: string; consumerProfileId: string }) =>
    withAuth(sdk =>
      sdk.portals.consumerProfiles.get(i.instanceId, i.portalId, i.consumerProfileId)
    ),
  mutators: {
    assignGroups: (
      body: DashboardInstancePortalsConsumerProfilesAssignGroupsBody,
      { input: { instanceId, portalId, consumerProfileId } }
    ) =>
      withAuth(sdk =>
        sdk.portals.consumerProfiles.assignGroups(
          instanceId,
          portalId,
          consumerProfileId,
          body
        )
      ),
    unassignGroups: (
      body: DashboardInstancePortalsConsumerProfilesUnassignGroupsBody,
      { input: { instanceId, portalId, consumerProfileId } }
    ) =>
      withAuth(sdk =>
        sdk.portals.consumerProfiles.unassignGroups(
          instanceId,
          portalId,
          consumerProfileId,
          body
        )
      )
  }
});

export let usePortalConsumerProfile = (
  instanceId: string | null | undefined,
  portalId: string | null | undefined,
  consumerProfileId: string | null | undefined
) => {
  let profile = portalConsumerProfileLoader.use(
    instanceId && portalId && consumerProfileId
      ? { instanceId, portalId, consumerProfileId }
      : null
  );

  return {
    ...profile,
    useAssignGroupsMutator: profile.useMutator('assignGroups'),
    useUnassignGroupsMutator: profile.useMutator('unassignGroups')
  };
};
