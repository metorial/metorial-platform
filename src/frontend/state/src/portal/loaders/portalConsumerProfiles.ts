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
