import { DashboardInstanceServersVariantsListQuery } from '@metorial/consumer-sdk/src/gen/src/mt_2025_01_01_pulsar';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../lib/usePaginator';
import { withSdk } from './client';

export let serverVariantsLoader = createLoader({
  name: 'serverVariants',
  parents: [],
  fetch: (i: { serverId: string } & DashboardInstanceServersVariantsListQuery) =>
    withSdk(sdk => sdk.servers.variants.list(i.serverId, i)),
  mutators: {}
});

export let useServerVariants = (
  serverId: string | null | undefined,
  query?: DashboardInstanceServersVariantsListQuery
) => {
  let data = usePaginator(pagination =>
    serverVariantsLoader.use(serverId ? { serverId, ...pagination, ...query } : null)
  );

  return data;
};

export let serverVariantLoader = createLoader({
  name: 'serverVariant',
  parents: [],
  fetch: (i: { serverId: string; serverVariantId: string }) =>
    withSdk(sdk => sdk.servers.variants.get(i.serverId, i.serverVariantId)),
  mutators: {}
});

export let useServerVariant = (
  serverId: string | null | undefined,
  serverVariantId: string | null | undefined
) => {
  let data = serverVariantLoader.use(
    serverId && serverVariantId ? { serverId, serverVariantId } : null
  );

  return data;
};
