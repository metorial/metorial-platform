import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../lib/usePaginator';
import { type PortalMagicMcpClient, withMagicMcpClient } from './magicMcpServer';

export type MagicMcpSessionsListQuery = NonNullable<
  Parameters<PortalMagicMcpClient['magicMcp']['sessions']['list']>[0]
>;
export type MagicMcpSessionsGetOutput = Awaited<
  ReturnType<PortalMagicMcpClient['magicMcp']['sessions']['get']>
>;
export type MagicMcpSessionsListOutput = Awaited<
  ReturnType<PortalMagicMcpClient['magicMcp']['sessions']['list']>
>;
export type MagicMcpSessionRow = MagicMcpSessionsListOutput['items'][number];

export let magicMcpSessionsLoader = createLoader({
  name: 'magicMcpSessions',
  parents: [],
  fetch: async (input: MagicMcpSessionsListQuery) =>
    await withMagicMcpClient(client => client.magicMcp.sessions.list(input)),
  mutators: {}
});

export let useMagicMcpSessions = (query?: MagicMcpSessionsListQuery) => {
  return usePaginator(pagination =>
    magicMcpSessionsLoader.use({
      ...pagination,
      ...query
    })
  );
};

export let magicMcpSessionLoader = createLoader({
  name: 'magicMcpSession',
  parents: [magicMcpSessionsLoader],
  fetch: async (input: { magicMcpSessionId: string }) =>
    await withMagicMcpClient(client => client.magicMcp.sessions.get(input.magicMcpSessionId)),
  mutators: {}
});

export let useMagicMcpSession = (magicMcpSessionId: string | null | undefined) => {
  return magicMcpSessionLoader.use(magicMcpSessionId ? { magicMcpSessionId } : null);
};
