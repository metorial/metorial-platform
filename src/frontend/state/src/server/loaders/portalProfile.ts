import {
  DashboardInstancePortalsConsumerProfilesAssignGroupsBody,
  DashboardInstancePortalsConsumerProfilesListQuery
} from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
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
  let data = usePaginator(pagination =>
    portalConsumerProfilesLoader.use(
      instanceId && portalId ? { instanceId, portalId, ...pagination, ...query } : null
    )
  );

  return {
    ...data
  };
};

export let portalProfileLoader = createLoader({
  name: 'portalProfile',
  parents: [portalConsumerProfilesLoader],
  fetch: (i: { instanceId: string; portalId: string; profileId: string }) =>
    withAuth(sdk => sdk.portals.consumerProfiles.get(i.instanceId, i.portalId, i.profileId)),
  mutators: {
    assignGroups: (
      i: DashboardInstancePortalsConsumerProfilesAssignGroupsBody,
      { input: { instanceId, portalId, profileId } }
    ) =>
      withAuth(sdk =>
        sdk.portals.consumerProfiles.assignGroups(instanceId, portalId, profileId, i)
      ),

    unassignGroups: (
      i: DashboardInstancePortalsConsumerProfilesAssignGroupsBody,
      { input: { instanceId, portalId, profileId } }
    ) =>
      withAuth(sdk =>
        sdk.portals.consumerProfiles.unassignGroups(instanceId, portalId, profileId, i)
      )
  }
});

export let usePortalConsumerProfile = (
  instanceId: string | null | undefined,
  portalId: string | null | undefined,
  profileId: string | null | undefined
) => {
  let data = portalProfileLoader.use(
    instanceId && portalId && profileId ? { instanceId, portalId, profileId } : null
  );

  return {
    ...data,
    useAssignGroupsMutator: data.useMutator('assignGroups'),
    useUnassignGroupsMutator: data.useMutator('unassignGroups')
  };
};
