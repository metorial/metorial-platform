import { ServersCapabilitiesListQuery } from '@metorial/consumer-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { createLoader } from '@metorial/data-hooks';
import { withSdk } from './client';

export let serverCapabilitiesLoader = createLoader({
  name: 'serverCapabilities',
  parents: [],
  fetch: (i: ServersCapabilitiesListQuery) => withSdk(sdk => sdk.servers.capabilities.list(i)),
  mutators: {}
});

export let useServerCapabilities = (opts: ServersCapabilitiesListQuery | undefined | null) => {
  let data = serverCapabilitiesLoader.use(opts ? { ...opts } : null);

  return data;
};
