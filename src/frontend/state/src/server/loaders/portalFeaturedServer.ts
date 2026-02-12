import {
  DashboardInstancePortalsFeaturedServersAddListingBody,
  DashboardInstancePortalsFeaturedServersListQuery,
  DashboardInstancePortalsFeaturedServersRemoveListingBody
} from '@metorial/dashboard-sdk/src/gen/src/mt_2026_02_01_dashboard';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let portalFeaturedServersLoader = createLoader({
  name: 'portalFeaturedServers',
  parents: [],
  fetch: (
    i: {
      instanceId: string;
      portalId: string;
    } & DashboardInstancePortalsFeaturedServersListQuery
  ) => withAuth(sdk => sdk.portals.featuredServers.list(i.instanceId, i.portalId, i)),
  mutators: {
    addListing: (
      i: DashboardInstancePortalsFeaturedServersAddListingBody,
      { input: { instanceId, portalId } }
    ) => withAuth(sdk => sdk.portals.featuredServers.addListing(instanceId, portalId, i)),

    removeListing: (
      i: DashboardInstancePortalsFeaturedServersRemoveListingBody,
      { input: { instanceId, portalId } }
    ) => withAuth(sdk => sdk.portals.featuredServers.removeListing(instanceId, portalId, i))
  }
});

export let usePortalFeaturedServers = (
  instanceId: string | null | undefined,
  portalId: string | null | undefined,
  query?: DashboardInstancePortalsFeaturedServersListQuery
) => {
  let data = usePaginator(pagination =>
    portalFeaturedServersLoader.use(
      instanceId && portalId ? { instanceId, portalId, ...pagination, ...query } : null
    )
  );

  return {
    ...data,
    addListingMutator: data.useMutator('addListing'),
    removeListingMutator: data.useMutator('removeListing')
  };
};
