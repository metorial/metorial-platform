import {
  DashboardInstanceServerConfigVaultsCreateBody,
  DashboardInstanceServerConfigVaultsListQuery,
  DashboardInstanceServerConfigVaultsUpdateBody
} from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let serverConfigVaultsLoader = createLoader({
  name: 'serverConfigVaults',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceServerConfigVaultsListQuery) =>
    withAuth(sdk => sdk.servers.configVaults.list(i.instanceId, i)),
  mutators: {}
});

export let useCreateServerConfigVault = serverConfigVaultsLoader.createExternalMutator(
  (i: DashboardInstanceServerConfigVaultsCreateBody & { instanceId: string }) =>
    withAuth(sdk => sdk.servers.configVaults.create(i.instanceId, i)),
  {
    disableToast: true
  }
);

export let useServerConfigVaults = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceServerConfigVaultsListQuery
) => {
  let data = usePaginator(pagination =>
    serverConfigVaultsLoader.use(instanceId ? { instanceId, ...pagination, ...query } : null)
  );

  return data;
};

export let serverConfigVaultLoader = createLoader({
  name: 'serverConfigVault',
  parents: [serverConfigVaultsLoader],
  fetch: (i: { instanceId: string; serverConfigVaultId: string }) =>
    withAuth(sdk => sdk.servers.configVaults.get(i.instanceId, i.serverConfigVaultId)),
  mutators: {
    update: (
      i: DashboardInstanceServerConfigVaultsUpdateBody,
      { input: { instanceId, serverConfigVaultId } }
    ) => withAuth(sdk => sdk.servers.configVaults.update(instanceId, serverConfigVaultId, i))
  }
});

export let useServerConfigVault = (
  instanceId: string | null | undefined,
  serverConfigVaultId: string | null | undefined
) => {
  let data = serverConfigVaultLoader.use(
    instanceId && serverConfigVaultId ? { instanceId, serverConfigVaultId } : null
  );

  return {
    ...data,
    useUpdateMutator: data.useMutator('update')
  };
};
