import {
  DashboardInstanceMagicMcpTokensCreateBody,
  DashboardInstanceMagicMcpTokensListQuery,
  DashboardInstanceMagicMcpTokensUpdateBody
} from '@metorial/consumer-sdk/src/gen/src/mt_2025_01_01_pulsar';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../lib/usePaginator';
import { withSdk } from './client';

export let magicMcpTokensLoader = createLoader({
  name: 'magicMcpTokens',
  parents: [],
  fetch: (i: DashboardInstanceMagicMcpTokensListQuery) =>
    withSdk(sdk => sdk.magicMcp.tokens.list(i)),
  mutators: {
    update: (
      i: DashboardInstanceMagicMcpTokensUpdateBody & {
        magicMcpTokenId: string;
      }
    ) => withSdk(sdk => sdk.magicMcp.tokens.update(i.magicMcpTokenId, i)),

    delete: (i: { magicMcpTokenId: string }) =>
      withSdk(sdk => sdk.magicMcp.tokens.delete(i.magicMcpTokenId))
  }
});

export let useCreateMagicMcpToken = magicMcpTokensLoader.createExternalMutator(
  (i: DashboardInstanceMagicMcpTokensCreateBody) =>
    withSdk(sdk => sdk.magicMcp.tokens.create(i)),
  {
    disableToast: true
  }
);

export let useMagicMcpTokens = (query?: DashboardInstanceMagicMcpTokensListQuery) => {
  let data = usePaginator(pagination => magicMcpTokensLoader.use({ ...pagination, ...query }));

  return {
    ...data,
    createMutator: useCreateMagicMcpToken,
    revokeMutator: data.useMutator('delete'),
    updateMutator: data.useMutator('update')
  };
};

export let magicMcpTokenLoader = createLoader({
  name: 'magicMcpToken',
  parents: [magicMcpTokensLoader],
  fetch: (i: { magicMcpTokenId: string }) =>
    withSdk(sdk => sdk.magicMcp.tokens.get(i.magicMcpTokenId)),
  mutators: {
    update: (i: DashboardInstanceMagicMcpTokensUpdateBody, { input: { magicMcpTokenId } }) =>
      withSdk(sdk => sdk.magicMcp.tokens.update(magicMcpTokenId, i)),

    delete: (_, { input: { magicMcpTokenId } }) =>
      withSdk(sdk => sdk.magicMcp.tokens.delete(magicMcpTokenId))
  }
});

export let useMagicMcpToken = (magicMcpTokenId: string | null | undefined) => {
  let data = magicMcpTokenLoader.use(magicMcpTokenId ? { magicMcpTokenId } : null);

  return {
    ...data,
    useUpdateMutator: data.useMutator('update'),
    useDeleteMutator: data.useMutator('delete')
  };
};
