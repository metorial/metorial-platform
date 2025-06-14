import { createLoader } from '@metorial/data-hooks';
import { DashboardInstanceServersVariantsListQuery } from '@metorial/generated/src/mt_2025_01_01_dashboard';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let serverVariantsLoader = createLoader({
  name: 'serverVariants',
  parents: [],
  fetch: (
    i: { instanceId: string; serverId: string } & DashboardInstanceServersVariantsListQuery
  ) => withAuth(sdk => sdk.servers.variants.list(i.instanceId, i.serverId, i)),
  mutators: {}
});

export let useServerVariants = (
  instanceId: string | null | undefined,
  serverId: string | null | undefined,
  query?: DashboardInstanceServersVariantsListQuery
) => {
  let data = usePaginator(pagination =>
    serverVariantsLoader.use(
      instanceId && serverId ? { instanceId, serverId, ...pagination, ...query } : null
    )
  );

  return data;
};

export let serverVariantLoader = createLoader({
  name: 'serverVariant',
  parents: [],
  fetch: (i: { instanceId: string; serverId: string; serverVariantId: string }) =>
    withAuth(sdk => sdk.servers.variants.get(i.instanceId, i.serverId, i.serverVariantId)),
  mutators: {}
});

export let useServerVariant = (
  instanceId: string | null | undefined,
  serverId: string | null | undefined,
  serverVariantId: string | null | undefined
) => {
  let data = serverVariantLoader.use(
    instanceId && serverId && serverVariantId
      ? { instanceId, serverId, serverVariantId }
      : null
  );

  return data;
};
