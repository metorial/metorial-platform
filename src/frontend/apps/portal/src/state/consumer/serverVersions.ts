import { DashboardInstanceServersVersionsListQuery } from '@metorial/consumer-sdk/src/gen/src/mt_2025_01_01_pulsar';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../lib/usePaginator';
import { withSdk } from './client';

export let serverVersionsLoader = createLoader({
  name: 'serverVersions',
  parents: [],
  fetch: (i: { serverId: string } & DashboardInstanceServersVersionsListQuery) =>
    withSdk(sdk => sdk.servers.versions.list(i.serverId, i)),
  mutators: {}
});

export let useServerVersions = (
  serverId: string | null | undefined,
  query?: DashboardInstanceServersVersionsListQuery
) => {
  let data = usePaginator(pagination =>
    serverVersionsLoader.use(serverId ? { serverId, ...pagination, ...query } : null)
  );

  return data;
};

export let serverVersionLoader = createLoader({
  name: 'serverVersion',
  parents: [],
  fetch: (i: { serverId: string; serverVersionId: string }) =>
    withSdk(sdk => sdk.servers.versions.get(i.serverId, i.serverVersionId)),
  mutators: {}
});

export let useServerVersion = (
  serverId: string | null | undefined,
  serverVersionId: string | null | undefined
) => {
  let data = serverVersionLoader.use(
    serverId && serverVersionId ? { serverId, serverVersionId } : null
  );

  return data;
};
