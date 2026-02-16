import {
  DashboardInstancePortalsConsumerServerRequestsAcceptBody,
  DashboardInstancePortalsConsumerServerRequestsListQuery,
  DashboardInstancePortalsConsumerServerRequestsRejectBody
} from '@metorial/dashboard-sdk/src/gen/src/mt_2026_02_01_dashboard';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let portalServerRequestsLoader = createLoader({
  name: 'portalServerRequests',
  parents: [],
  fetch: (
    i: {
      instanceId: string;
      portalId: string;
    } & DashboardInstancePortalsConsumerServerRequestsListQuery
  ) => withAuth(sdk => sdk.portals.consumerServerRequests.list(i.instanceId, i.portalId, i)),
  mutators: {
    accept: (
      i: DashboardInstancePortalsConsumerServerRequestsAcceptBody & {
        consumerServerRequestId: string;
      },
      { input: { instanceId, portalId } }
    ) =>
      withAuth(sdk =>
        sdk.portals.consumerServerRequests.accept(
          instanceId,
          portalId,
          i.consumerServerRequestId,
          i
        )
      ),

    reject: (
      i: DashboardInstancePortalsConsumerServerRequestsRejectBody & {
        consumerServerRequestId: string;
      },
      { input: { instanceId, portalId } }
    ) =>
      withAuth(sdk =>
        sdk.portals.consumerServerRequests.reject(
          instanceId,
          portalId,
          i.consumerServerRequestId,
          i
        )
      )
  }
});

export let usePortalServerRequests = (
  instanceId: string | null | undefined,
  portalId: string | null | undefined,
  query?: DashboardInstancePortalsConsumerServerRequestsListQuery
) => {
  let data = usePaginator(pagination =>
    portalServerRequestsLoader.use(
      instanceId && portalId ? { instanceId, portalId, ...pagination, ...query } : null
    )
  );

  return {
    ...data,
    acceptMutator: data.useMutator('accept'),
    rejectMutator: data.useMutator('reject')
  };
};
