import { ConsumerMagicMcpGroupsListQuery } from '@metorial/consumer-sdk/src/gen/src/mt_2025_01_01_pulsar';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../lib/usePaginator';
import { withSdk } from './client';

export let magicMcpGroupsLoader = createLoader({
  name: 'magicMcpGroups',
  parents: [],
  fetch: (i: {} & ConsumerMagicMcpGroupsListQuery) =>
    withSdk(sdk => sdk.magicMcp.groups.list(i)),
  mutators: {}
});

export let useMagicMcpGroups = (query?: ConsumerMagicMcpGroupsListQuery) => {
  let data = usePaginator(pagination => magicMcpGroupsLoader.use({ ...pagination, ...query }));

  return {
    ...data
  };
};

export let magicMcpGroupLoader = createLoader({
  name: 'magicMcpGroup',
  parents: [magicMcpGroupsLoader],
  fetch: (i: { magicMcpGroupId: string }) =>
    withSdk(sdk => sdk.magicMcp.groups.get(i.magicMcpGroupId)),
  mutators: {}
});

export let useMagicMcpGroup = (magicMcpGroupId: string | null | undefined) => {
  let data = magicMcpGroupLoader.use(magicMcpGroupId ? { magicMcpGroupId } : null);

  return {
    ...data
  };
};
