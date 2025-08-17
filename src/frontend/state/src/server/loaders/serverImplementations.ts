import { createLoader } from '@metorial/data-hooks';
import {
  DashboardInstanceServersImplementationsCreateBody,
  DashboardInstanceServersImplementationsListQuery,
  DashboardInstanceServersImplementationsUpdateBody
} from '@metorial/generated/src/mt_2025_01_01_dashboard';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let serverImplementationsLoader = createLoader({
  name: 'serverImplementations',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceServersImplementationsListQuery) =>
    withAuth(sdk => sdk.servers.implementations.list(i.instanceId, i)),
  mutators: {}
});

export let useCreateImplementation = serverImplementationsLoader.createExternalMutator(
  (i: DashboardInstanceServersImplementationsCreateBody & { instanceId: string }) =>
    withAuth(sdk => sdk.servers.implementations.create(i.instanceId, i))
);

export let useServerImplementations = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceServersImplementationsListQuery
) => {
  let data = usePaginator(pagination =>
    serverImplementationsLoader.use(
      instanceId ? { instanceId, ...pagination, ...query } : null
    )
  );

  return data;
};

export let serverImplementationLoader = createLoader({
  name: 'serverImplementation',
  parents: [serverImplementationsLoader],
  fetch: (i: { instanceId: string; serverImplementationId: string }) =>
    withAuth(sdk => sdk.servers.implementations.get(i.instanceId, i.serverImplementationId)),
  mutators: {
    update: (
      i: DashboardInstanceServersImplementationsUpdateBody,
      { input: { instanceId, serverImplementationId } }
    ) =>
      withAuth(sdk =>
        sdk.servers.implementations.update(instanceId, serverImplementationId, i)
      ),

    delete: (_, { input: { instanceId, serverImplementationId } }) =>
      withAuth(sdk => sdk.servers.implementations.delete(instanceId, serverImplementationId))
  }
});

export let useServerImplementation = (
  instanceId: string | null | undefined,
  serverImplementationId: string | null | undefined
) => {
  let data = serverImplementationLoader.use(
    instanceId && serverImplementationId ? { instanceId, serverImplementationId } : null
  );

  return {
    ...data,
    useUpdateMutator: data.useMutator('update'),
    useDeleteMutator: data.useMutator('delete')
  };
};
