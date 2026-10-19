import {
  DashboardInstancePublicMcpServersClientsListQuery,
  DashboardInstancePublicMcpServersCreateBody,
  DashboardInstancePublicMcpServersGrantsListQuery,
  DashboardInstancePublicMcpServersListQuery,
  DashboardInstancePublicMcpServersUpdateBody
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let publicMcpServersLoader = createLoader({
  name: 'publicMcpServers',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstancePublicMcpServersListQuery) =>
    withAuth(sdk => sdk.publicMcpServers.list(i.instanceId, i)),
  mutators: {}
});

export let usePublicMcpServers = (
  instanceId: string | null | undefined,
  query?: DashboardInstancePublicMcpServersListQuery
) =>
  usePaginator(pagination =>
    publicMcpServersLoader.use(instanceId ? { instanceId, ...pagination, ...query } : null)
  );

export let useCreatePublicMcpServer = publicMcpServersLoader.createExternalMutator(
  (i: DashboardInstancePublicMcpServersCreateBody & { instanceId: string }) =>
    withAuth(sdk => {
      let { instanceId, ...body } = i;
      return sdk.publicMcpServers.create(instanceId, body);
    })
);

export let publicMcpServerLoader = createLoader({
  name: 'publicMcpServer',
  parents: [publicMcpServersLoader],
  fetch: (i: { instanceId: string; publicMcpServerId: string }) =>
    withAuth(sdk => sdk.publicMcpServers.get(i.instanceId, i.publicMcpServerId)),
  mutators: {
    update: (
      body: DashboardInstancePublicMcpServersUpdateBody,
      { input: { instanceId, publicMcpServerId } }
    ) => withAuth(sdk => sdk.publicMcpServers.update(instanceId, publicMcpServerId, body)),

    delete: (_, { input: { instanceId, publicMcpServerId } }) =>
      withAuth(sdk => sdk.publicMcpServers.delete(instanceId, publicMcpServerId))
  }
});

export let usePublicMcpServer = (
  instanceId: string | null | undefined,
  publicMcpServerId: string | null | undefined
) => {
  let data = publicMcpServerLoader.use(
    instanceId && publicMcpServerId ? { instanceId, publicMcpServerId } : null
  );

  return {
    ...data,
    useUpdateMutator: data.useMutator('update'),
    useDeleteMutator: data.useMutator('delete')
  };
};

export let publicMcpServerSlugAvailabilityLoader = createLoader({
  name: 'publicMcpServerSlugAvailability',
  parents: [],
  fetch: (i: { instanceId: string; slug: string }) =>
    withAuth(sdk => sdk.publicMcpServers.slugs.check(i.instanceId, { slug: i.slug })),
  mutators: {}
});

export let usePublicMcpServerSlugAvailability = (
  instanceId: string | null | undefined,
  slug: string | null | undefined
) =>
  publicMcpServerSlugAvailabilityLoader.use(instanceId && slug ? { instanceId, slug } : null);

export let publicMcpServerGrantsLoader = createLoader({
  name: 'publicMcpServerGrants',
  parents: [publicMcpServerLoader],
  fetch: (
    i: {
      instanceId: string;
      publicMcpServerId: string;
    } & DashboardInstancePublicMcpServersGrantsListQuery
  ) =>
    withAuth(sdk => {
      let { instanceId, publicMcpServerId, ...query } = i;
      return sdk.publicMcpServers.grants.list(instanceId, publicMcpServerId, query);
    }),
  mutators: {}
});

export let usePublicMcpServerGrants = (
  instanceId: string | null | undefined,
  publicMcpServerId: string | null | undefined,
  query?: DashboardInstancePublicMcpServersGrantsListQuery
) =>
  usePaginator(
    pagination =>
      publicMcpServerGrantsLoader.use(
        instanceId && publicMcpServerId
          ? { instanceId, publicMcpServerId, ...pagination, ...query }
          : null
      ),
    instanceId && publicMcpServerId ? `${instanceId}:${publicMcpServerId}` : null
  );

export let useRevokePublicMcpServerGrant = publicMcpServerGrantsLoader.createExternalMutator(
  (i: { instanceId: string; publicMcpServerId: string; publicMcpServerGrantId: string }) =>
    withAuth(sdk =>
      sdk.publicMcpServers.grants.revoke(
        i.instanceId,
        i.publicMcpServerId,
        i.publicMcpServerGrantId
      )
    )
);

export let publicMcpServerClientsLoader = createLoader({
  name: 'publicMcpServerClients',
  parents: [publicMcpServerLoader],
  fetch: (
    i: {
      instanceId: string;
      publicMcpServerId: string;
    } & DashboardInstancePublicMcpServersClientsListQuery
  ) =>
    withAuth(sdk => {
      let { instanceId, publicMcpServerId, ...query } = i;
      return sdk.publicMcpServers.clients.list(instanceId, publicMcpServerId, query);
    }),
  mutators: {}
});

export let usePublicMcpServerClients = (
  instanceId: string | null | undefined,
  publicMcpServerId: string | null | undefined,
  query?: DashboardInstancePublicMcpServersClientsListQuery
) =>
  usePaginator(
    pagination =>
      publicMcpServerClientsLoader.use(
        instanceId && publicMcpServerId
          ? { instanceId, publicMcpServerId, ...pagination, ...query }
          : null
      ),
    instanceId && publicMcpServerId ? `${instanceId}:${publicMcpServerId}` : null
  );
