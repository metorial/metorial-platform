import {
  DashboardInstancePortalsAccessRequestsListQuery,
  DashboardInstancePortalsAccessRequestsUpdateBody
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let portalAccessRequestsLoader = createLoader({
  name: 'portalAccessRequests',
  parents: [],
  fetch: (
    i: {
      instanceId: string;
      portalId: string;
    } & DashboardInstancePortalsAccessRequestsListQuery
  ) => withAuth(sdk => sdk.portals.accessRequests.list(i.instanceId, i.portalId, i)),
  mutators: {}
});

export let usePortalAccessRequests = (
  instanceId: string | null | undefined,
  portalId: string | null | undefined,
  query?: DashboardInstancePortalsAccessRequestsListQuery
) => {
  let resetKey = instanceId && portalId ? `${instanceId}:${portalId}` : null;

  return usePaginator(
    pagination =>
      portalAccessRequestsLoader.use(
        instanceId && portalId ? { instanceId, portalId, ...pagination, ...query } : null
      ),
    resetKey
  );
};

export let useReviewPortalAccessRequest = portalAccessRequestsLoader.createExternalMutator(
  (i: {
    instanceId: string;
    portalId: string;
    consumerAccessRequestId: string;
    body: DashboardInstancePortalsAccessRequestsUpdateBody;
  }) =>
    withAuth(sdk =>
      sdk.portals.accessRequests.update(
        i.instanceId,
        i.portalId,
        i.consumerAccessRequestId,
        i.body
      )
    )
);
