import { ConsumerMagicMcpSessionsListQuery } from '@metorial/consumer-sdk/src/gen/src/mt_2025_01_01_pulsar';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../lib/usePaginator';
import { withSdk } from './client';

export let magicMcpSessionsLoader = createLoader({
  name: 'magicMcpSessions',
  parents: [],
  fetch: (i: ConsumerMagicMcpSessionsListQuery) =>
    withSdk(sdk => sdk.magicMcp.sessions.list(i)),
  mutators: {}
});

export let useMagicMcpSessions = (query?: ConsumerMagicMcpSessionsListQuery) => {
  let data = usePaginator(pagination =>
    magicMcpSessionsLoader.use({ ...pagination, ...query })
  );

  return data;
};

export let magicMcpSessionLoader = createLoader({
  name: 'magicMcpSession',
  parents: [magicMcpSessionsLoader],
  fetch: (i: { magicMcpSessionId: string }) =>
    withSdk(sdk => sdk.magicMcp.sessions.get(i.magicMcpSessionId)),
  mutators: {}
});

export let useMagicMcpSession = (magicMcpSessionId: string | null | undefined) => {
  let data = magicMcpSessionLoader.use(magicMcpSessionId ? { magicMcpSessionId } : null);

  return data;
};
