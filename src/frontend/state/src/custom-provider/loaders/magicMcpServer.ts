import {
  DashboardInstanceMagicMcpServersCreateBody,
  DashboardInstanceMagicMcpServersProvidersCreateBody,
  DashboardInstanceMagicMcpServersProvidersListQuery,
  DashboardInstanceMagicMcpServersProvidersUpdateBody,
  DashboardInstanceMagicMcpServersSessionCreateOutput,
  DashboardInstanceMagicMcpServersListQuery,
  DashboardInstanceMagicMcpServersUpdateBody
} from '@metorial/dashboard-sdk';
import { createLoader, useMutation } from '@metorial/data-hooks';
import { autoPaginate } from '../../lib/autoPaginate';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let magicMcpServersLoader = createLoader({
  name: 'magicMcpServers',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceMagicMcpServersListQuery) =>
    withAuth(sdk => sdk.magicMcp.servers.list(i.instanceId, i)),
  mutators: {}
});

export let useCreateMagicMcpServer = magicMcpServersLoader.createExternalMutator(
  (i: DashboardInstanceMagicMcpServersCreateBody & { instanceId: string }) =>
    withAuth(async sdk => {
      let server = await sdk.magicMcp.servers.create(i.instanceId, i);

      return server;
    }),
  {
    disableToast: true
  }
);

export let useMagicMcpServers = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceMagicMcpServersListQuery
) => {
  let data = usePaginator(pagination =>
    magicMcpServersLoader.use(instanceId ? { instanceId, ...pagination, ...query } : null)
  );

  return data;
};

export let allMagicMcpServersLoader = createLoader({
  name: 'allMagicMcpServers',
  parents: [],
  fetch: (
    i: {
      instanceId: string;
    } & Omit<DashboardInstanceMagicMcpServersListQuery, 'after' | 'before' | 'cursor'>
  ) =>
    withAuth(sdk =>
      autoPaginate(cursor =>
        sdk.magicMcp.servers.list(i.instanceId, {
          ...i,
          ...cursor,
          limit: i.limit ?? 100
        })
      )
    ),
  mutators: {}
});

export let useAllMagicMcpServers = (
  instanceId: string | null | undefined,
  query?: Omit<DashboardInstanceMagicMcpServersListQuery, 'after' | 'before' | 'cursor'>
) => {
  return allMagicMcpServersLoader.use(instanceId ? { instanceId, ...query } : null);
};

export let magicMcpServerLoader = createLoader({
  name: 'magicMcpServer',
  parents: [magicMcpServersLoader],
  fetch: (i: { instanceId: string; magicMcpServerId: string }) =>
    withAuth(sdk => sdk.magicMcp.servers.get(i.instanceId, i.magicMcpServerId)),
  mutators: {
    update: (
      i: DashboardInstanceMagicMcpServersUpdateBody,
      { input: { instanceId, magicMcpServerId } }
    ) => withAuth(sdk => sdk.magicMcp.servers.update(instanceId, magicMcpServerId, i)),

    delete: (_, { input: { instanceId, magicMcpServerId } }) =>
      withAuth(sdk => sdk.magicMcp.servers.delete(instanceId, magicMcpServerId))
  }
});

export let useMagicMcpServer = (
  instanceId: string | null | undefined,
  magicMcpServerId: string | null | undefined
) => {
  let data = magicMcpServerLoader.use(
    instanceId && magicMcpServerId ? { instanceId, magicMcpServerId } : null
  );

  return {
    ...data,
    useUpdateMutator: data.useMutator('update'),
    useDeleteMutator: data.useMutator('delete')
  };
};

export let updateMagicMcpServer = (
  body: DashboardInstanceMagicMcpServersUpdateBody & {
    instanceId: string;
    magicMcpServerId: string;
  }
) =>
  withAuth(sdk => sdk.magicMcp.servers.update(body.instanceId, body.magicMcpServerId, body));

export let magicMcpServerProvidersLoader = createLoader({
  name: 'magicMcpServerProviders',
  parents: [magicMcpServerLoader],
  fetch: (
    i: {
      instanceId: string;
      magicMcpServerId: string;
    } & DashboardInstanceMagicMcpServersProvidersListQuery
  ) =>
    withAuth(sdk => {
      let { instanceId, magicMcpServerId, ...query } = i;
      return sdk.magicMcp.servers.providers.list(instanceId, magicMcpServerId, query);
    }),
  mutators: {}
});

export let useMagicMcpServerProviders = (
  instanceId: string | null | undefined,
  magicMcpServerId: string | null | undefined,
  query?: DashboardInstanceMagicMcpServersProvidersListQuery
) => {
  let data = usePaginator(
    pagination =>
      magicMcpServerProvidersLoader.use(
        instanceId && magicMcpServerId
          ? { instanceId, magicMcpServerId, ...pagination, ...query }
          : null
      ),
    instanceId && magicMcpServerId ? `${instanceId}:${magicMcpServerId}` : null
  );

  return data;
};

export let useCreateMagicMcpServerProvider =
  magicMcpServerProvidersLoader.createExternalMutator(
    (
      i: {
        instanceId: string;
        magicMcpServerId: string;
      } & DashboardInstanceMagicMcpServersProvidersCreateBody
    ) =>
      withAuth(sdk => {
        let { instanceId, magicMcpServerId, ...body } = i;
        return sdk.magicMcp.servers.providers.create(instanceId, magicMcpServerId, body);
      }),
    { disableToast: true }
  );

export let useUpdateMagicMcpServerProvider =
  magicMcpServerProvidersLoader.createExternalMutator(
    (
      i: {
        instanceId: string;
        magicMcpServerId: string;
        magicMcpServerProviderId: string;
      } & DashboardInstanceMagicMcpServersProvidersUpdateBody
    ) =>
      withAuth(sdk => {
        let { instanceId, magicMcpServerId, magicMcpServerProviderId, ...body } = i;
        return sdk.magicMcp.servers.providers.update(
          instanceId,
          magicMcpServerId,
          magicMcpServerProviderId,
          body
        );
      }),
    { disableToast: true }
  );

export let useDeleteMagicMcpServerProvider =
  magicMcpServerProvidersLoader.createExternalMutator(
    (i: { instanceId: string; magicMcpServerId: string; magicMcpServerProviderId: string }) =>
      withAuth(sdk =>
        sdk.magicMcp.servers.providers.delete(
          i.instanceId,
          i.magicMcpServerId,
          i.magicMcpServerProviderId
        )
      ),
    { disableToast: true }
  );

export let useCreateMagicMcpServerSession = () =>
  useMutation(
    (i: {
      instanceId: string;
      magicMcpServerId: string;
    }): Promise<DashboardInstanceMagicMcpServersSessionCreateOutput> =>
      withAuth(sdk => sdk.magicMcp.servers.session.create(i.instanceId, i.magicMcpServerId)),
    { disableToast: true }
  );
