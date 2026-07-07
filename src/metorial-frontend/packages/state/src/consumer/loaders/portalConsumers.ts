import type {
  DashboardInstancePortalsAccessCreateBody,
  DashboardInstancePortalsAccessListQuery,
  DashboardInstancePortalsConsumerGroupsListQuery,
  DashboardInstancePortalsConsumerProfilesListQuery,
  DashboardInstancePortalsAccessUpdateBody
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { autoPaginate } from '../../lib/autoPaginate';
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
  query?: DashboardInstancePortalsConsumerProfilesListQuery | null
) => {
  return usePaginator(
    pagination =>
      portalConsumerProfilesLoader.use(
        instanceId && portalId && query !== null
          ? { instanceId, portalId, ...pagination, ...(query ?? {}) }
          : null
      ),
    instanceId && portalId
      ? `${instanceId}:${portalId}:consumer-profiles:${JSON.stringify(query ?? {})}`
      : null
  );
};

export let portalConsumerGroupsLoader = createLoader({
  name: 'portalConsumerGroups',
  parents: [],
  fetch: (
    i: {
      instanceId: string;
      portalId: string;
    } & DashboardInstancePortalsConsumerGroupsListQuery
  ) => withAuth(sdk => sdk.portals.consumerGroups.list(i.instanceId, i.portalId, i)),
  mutators: {}
});

export let usePortalConsumerGroups = (
  instanceId: string | null | undefined,
  portalId: string | null | undefined,
  query?: DashboardInstancePortalsConsumerGroupsListQuery | null
) => {
  return usePaginator(
    pagination =>
      portalConsumerGroupsLoader.use(
        instanceId && portalId && query !== null
          ? { instanceId, portalId, ...pagination, ...(query ?? {}) }
          : null
      ),
    instanceId && portalId
      ? `${instanceId}:${portalId}:consumer-groups:${JSON.stringify(query ?? {})}`
      : null
  );
};

export let useCreatePortalConsumerAccess = portalConsumerGroupsLoader.createExternalMutator(
  (
    i: DashboardInstancePortalsAccessCreateBody & {
      instanceId: string;
      portalId: string;
    }
  ) => withAuth(sdk => sdk.portals.consumerAccess.create(i.instanceId, i.portalId, i))
);

export let allPortalConsumerAccessLoader = createLoader({
  name: 'allPortalConsumerAccess',
  parents: [portalConsumerGroupsLoader],
  fetch: (
    i: {
      instanceId: string;
      portalId: string;
    } & Omit<DashboardInstancePortalsAccessListQuery, 'after' | 'before' | 'cursor'>
  ) =>
    withAuth(sdk =>
      autoPaginate(cursor =>
        sdk.portals.consumerAccess.list(i.instanceId, i.portalId, {
          ...i,
          ...cursor,
          limit: i.limit ?? 100
        })
      )
    ),
  mutators: {}
});

export let useAllPortalConsumerAccess = (
  instanceId: string | null | undefined,
  portalId: string | null | undefined,
  query?: Omit<DashboardInstancePortalsAccessListQuery, 'after' | 'before' | 'cursor'> | null
) => {
  return allPortalConsumerAccessLoader.use(
    instanceId && portalId && query !== null
      ? { instanceId, portalId, ...(query ?? {}) }
      : null
  );
};

export let portalConsumerAccessLoader = createLoader({
  name: 'portalConsumerAccess',
  parents: [allPortalConsumerAccessLoader, portalConsumerGroupsLoader],
  fetch: (
    i: {
      instanceId: string;
      portalId: string;
    } & DashboardInstancePortalsAccessListQuery
  ) => withAuth(sdk => sdk.portals.consumerAccess.list(i.instanceId, i.portalId, i)),
  mutators: {
    update: (
      body: DashboardInstancePortalsAccessUpdateBody & { consumerAccessId: string },
      { input: { instanceId, portalId } }: { input: { instanceId: string; portalId: string } }
    ) =>
      withAuth(sdk =>
        sdk.portals.consumerAccess.update(instanceId, portalId, body.consumerAccessId, body)
      ),

    delete: (
      body: { consumerAccessId: string },
      { input: { instanceId, portalId } }: { input: { instanceId: string; portalId: string } }
    ) =>
      withAuth(sdk =>
        sdk.portals.consumerAccess.delete(instanceId, portalId, body.consumerAccessId)
      )
  }
});

export let usePortalConsumerAccess = (
  instanceId: string | null | undefined,
  portalId: string | null | undefined,
  query?: DashboardInstancePortalsAccessListQuery | null
) => {
  let access = usePaginator(
    pagination =>
      portalConsumerAccessLoader.use(
        instanceId && portalId && query !== null
          ? { instanceId, portalId, ...pagination, ...(query ?? {}) }
          : null
      ),
    instanceId && portalId ? `${instanceId}:${portalId}:consumer-access` : null
  );

  return {
    ...access,
    updateMutator: access.useMutator('update'),
    deleteMutator: access.useMutator('delete')
  };
};
