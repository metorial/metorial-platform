import {
  DashboardInstanceProviderOauthConnectionsCreateBody,
  DashboardInstanceProviderOauthConnectionsListQuery,
  DashboardInstanceProviderOauthConnectionsUpdateBody
} from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';
import { withAuthPrivate } from '../../user/auth/withAuth';

export let providerConnectionsLoader = createLoader({
  name: 'providerConnections',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceProviderOauthConnectionsListQuery) =>
    withAuth(sdk => sdk.providerOauth.connections.list(i.instanceId, i)),
  mutators: {}
});

export let useCreateProviderConnection = providerConnectionsLoader.createExternalMutator(
  (i: DashboardInstanceProviderOauthConnectionsCreateBody & { instanceId: string }) =>
    withAuth(sdk => sdk.providerOauth.connections.create(i.instanceId, i))
);

export let useProviderConnections = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceProviderOauthConnectionsListQuery
) => {
  let data = usePaginator(pagination =>
    providerConnectionsLoader.use(instanceId ? { instanceId, ...pagination, ...query } : null)
  );

  return data;
};

export let providerConnectionLoader = createLoader({
  name: 'providerConnection',
  parents: [providerConnectionsLoader],
  fetch: (i: { instanceId: string; providerConnectionId: string }) =>
    withAuth(sdk => sdk.providerOauth.connections.get(i.instanceId, i.providerConnectionId)),
  mutators: {
    update: (
      i: DashboardInstanceProviderOauthConnectionsUpdateBody,
      { input: { instanceId, providerConnectionId } }
    ) =>
      withAuth(sdk =>
        sdk.providerOauth.connections.update(instanceId, providerConnectionId, i)
      ),

    delete: (_, { input: { instanceId, providerConnectionId } }) =>
      withAuth(sdk => sdk.providerOauth.connections.delete(instanceId, providerConnectionId)),

    test: (i: { redirectUri: string }, { input: { instanceId, providerConnectionId } }) =>
      withAuthPrivate({ instanceId }, sdk =>
        sdk
          .query({
            getProviderOauthConnectionTestSession: {
              __args: {
                instanceId,
                connectionId: providerConnectionId,
                redirectUri: i.redirectUri
              },
              __scalar: true,
              connection: {
                __scalar: true
              }
            }
          })
          .then(c => c.getProviderOauthConnectionTestSession)
      )
  }
});

export let useProviderConnection = (
  instanceId: string | null | undefined,
  providerConnectionId: string | null | undefined
) => {
  let data = providerConnectionLoader.use(
    instanceId && providerConnectionId ? { instanceId, providerConnectionId } : null
  );

  return {
    ...data,
    useUpdateMutator: data.useMutator('update'),
    useDeleteMutator: data.useMutator('delete'),
    useTestMutator: data.useMutator('test')
  };
};
