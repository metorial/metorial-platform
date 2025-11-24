import { createLoader } from '@metorial/data-hooks';
import { withSdk } from './client';

export let serverLoader = createLoader({
  name: 'server',
  parents: [],
  fetch: (i: { serverId: string }) => withSdk(sdk => sdk.servers.get(i.serverId)),
  mutators: {}
});

export let useServer = (serverId: string | null | undefined) => {
  let data = serverLoader.use(serverId ? { serverId } : null);

  return data;
};
