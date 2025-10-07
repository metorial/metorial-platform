import {
  DashboardInstanceMagicMcpTokensCreateBody,
  DashboardInstanceMagicMcpTokensListQuery,
  DashboardInstanceMagicMcpTokensUpdateBody
} from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let magicMcpTokensLoader = createLoader({
  name: 'magicMcpTokens',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceMagicMcpTokensListQuery) =>
    withAuth(sdk => sdk.magicMcp.tokens.list(i.instanceId, i)),
  mutators: {
    update: (
      i: DashboardInstanceMagicMcpTokensUpdateBody & {
        magicMcpTokenId: string;
      },
      { input: { instanceId } }
    ) => withAuth(sdk => sdk.magicMcp.tokens.update(instanceId, i.magicMcpTokenId, i)),

    delete: (i: { magicMcpTokenId: string }, { input: { instanceId } }) =>
      withAuth(sdk => sdk.magicMcp.tokens.delete(instanceId, i.magicMcpTokenId))
  }
});

export let useCreateMagicMcpToken = magicMcpTokensLoader.createExternalMutator(
  (i: DashboardInstanceMagicMcpTokensCreateBody & { instanceId: string }) =>
    withAuth(sdk => sdk.magicMcp.tokens.create(i.instanceId, i)),
  {
    disableToast: true
  }
);

export let useMagicMcpTokens = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceMagicMcpTokensListQuery
) => {
  let data = usePaginator(pagination =>
    magicMcpTokensLoader.use(instanceId ? { instanceId, ...pagination, ...query } : null)
  );

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
  fetch: (i: { instanceId: string; magicMcpTokenId: string }) =>
    withAuth(sdk => sdk.magicMcp.tokens.get(i.instanceId, i.magicMcpTokenId)),
  mutators: {
    update: (
      i: DashboardInstanceMagicMcpTokensUpdateBody,
      { input: { instanceId, magicMcpTokenId } }
    ) => withAuth(sdk => sdk.magicMcp.tokens.update(instanceId, magicMcpTokenId, i)),

    delete: (_, { input: { instanceId, magicMcpTokenId } }) =>
      withAuth(sdk => sdk.magicMcp.tokens.delete(instanceId, magicMcpTokenId))
  }
});

export let useMagicMcpToken = (
  instanceId: string | null | undefined,
  magicMcpTokenId: string | null | undefined
) => {
  let data = magicMcpTokenLoader.use(
    instanceId && magicMcpTokenId ? { instanceId, magicMcpTokenId } : null
  );

  return {
    ...data,
    useUpdateMutator: data.useMutator('update'),
    useDeleteMutator: data.useMutator('delete')
  };
};
