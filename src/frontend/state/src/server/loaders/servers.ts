import { createLoader } from '@metorial/data-hooks';
import { withAuth } from '../../user';

export let serverLoader = createLoader({
  name: 'server',
  parents: [],
  fetch: (i: { instanceId: string; serverId: string }) =>
    withAuth(sdk => sdk.servers.get(i.instanceId, i.serverId)),
  mutators: {}
});

export let useServer = (
  instanceId: string | null | undefined,
  serverId: string | null | undefined
) => {
  let data = serverLoader.use(instanceId && serverId ? { instanceId, serverId } : null);

  return data;
};
