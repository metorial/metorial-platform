import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../lib/usePaginator';
import { type PortalMagicMcpClient, withMagicMcpClient } from './magicMcpServer';

export type MagicMcpTokensListQuery = NonNullable<
  Parameters<PortalMagicMcpClient['magicMcp']['tokens']['list']>[0]
>;
export type MagicMcpTokensCreateBody =
  Parameters<PortalMagicMcpClient['magicMcp']['tokens']['create']>[0];
export type MagicMcpTokensUpdateBody =
  Parameters<PortalMagicMcpClient['magicMcp']['tokens']['update']>[1];
export type MagicMcpTokensAddGroupsBody =
  Parameters<PortalMagicMcpClient['magicMcp']['tokens']['addGroups']>[1];
export type MagicMcpTokensRemoveGroupsBody =
  Parameters<PortalMagicMcpClient['magicMcp']['tokens']['removeGroups']>[1];
export type MagicMcpTokensGetOutput = Awaited<
  ReturnType<PortalMagicMcpClient['magicMcp']['tokens']['get']>
>;
export type MagicMcpTokensListOutput = Awaited<
  ReturnType<PortalMagicMcpClient['magicMcp']['tokens']['list']>
>;
export type MagicMcpTokenRow = MagicMcpTokensListOutput['items'][number];

export let magicMcpTokensLoader = createLoader({
  name: 'magicMcpTokens',
  parents: [],
  fetch: async (input: MagicMcpTokensListQuery) =>
    await withMagicMcpClient(client => client.magicMcp.tokens.list(input)),
  mutators: {
    update: async (
      input: MagicMcpTokensUpdateBody & {
        magicMcpTokenId: string;
      }
    ) =>
      await withMagicMcpClient(client =>
        client.magicMcp.tokens.update(input.magicMcpTokenId, {
          name: input.name,
          description: input.description,
          metadata: input.metadata
        })
      ),

    delete: async (input: { magicMcpTokenId: string }) =>
      await withMagicMcpClient(client => client.magicMcp.tokens.delete(input.magicMcpTokenId)),

    addGroups: async (
      input: MagicMcpTokensAddGroupsBody & {
        magicMcpTokenId: string;
      }
    ) =>
      await withMagicMcpClient(client =>
        client.magicMcp.tokens.addGroups(input.magicMcpTokenId, {
          magicMcpGroupIds: input.magicMcpGroupIds
        })
      ),

    removeGroups: async (
      input: MagicMcpTokensRemoveGroupsBody & {
        magicMcpTokenId: string;
      }
    ) =>
      await withMagicMcpClient(client =>
        client.magicMcp.tokens.removeGroups(input.magicMcpTokenId, {
          magicMcpGroupIds: input.magicMcpGroupIds
        })
      )
  }
});

export let useCreateMagicMcpToken = magicMcpTokensLoader.createExternalMutator(
  async (input: MagicMcpTokensCreateBody) =>
    await withMagicMcpClient(client =>
      client.magicMcp.tokens.create({
        name: input.name,
        description: input.description,
        metadata: input.metadata,
        groupIds: input.groupIds
      })
    ),
  {
    disableToast: true
  }
);

export let useMagicMcpTokens = (query?: MagicMcpTokensListQuery) => {
  let data = usePaginator(pagination =>
    magicMcpTokensLoader.use({
      ...pagination,
      ...query
    })
  );

  return {
    ...data,
    createMutator: useCreateMagicMcpToken,
    revokeMutator: data.useMutator('delete'),
    updateMutator: data.useMutator('update'),
    addGroupsMutator: data.useMutator('addGroups'),
    removeGroupsMutator: data.useMutator('removeGroups')
  };
};

export let magicMcpTokenLoader = createLoader({
  name: 'magicMcpToken',
  parents: [magicMcpTokensLoader],
  fetch: async (input: { magicMcpTokenId: string }) =>
    await withMagicMcpClient(client => client.magicMcp.tokens.get(input.magicMcpTokenId)),
  mutators: {
    update: async (input: MagicMcpTokensUpdateBody, { input: loaderInput }) =>
      await withMagicMcpClient(client =>
        client.magicMcp.tokens.update(loaderInput.magicMcpTokenId, input)
      ),

    delete: async (_, { input: loaderInput }) =>
      await withMagicMcpClient(client =>
        client.magicMcp.tokens.delete(loaderInput.magicMcpTokenId)
      ),

    addGroups: async (
      input: MagicMcpTokensAddGroupsBody,
      { input: loaderInput }
    ) =>
      await withMagicMcpClient(client =>
        client.magicMcp.tokens.addGroups(loaderInput.magicMcpTokenId, input)
      ),

    removeGroups: async (
      input: MagicMcpTokensRemoveGroupsBody,
      { input: loaderInput }
    ) =>
      await withMagicMcpClient(client =>
        client.magicMcp.tokens.removeGroups(loaderInput.magicMcpTokenId, input)
      )
  }
});

export let useMagicMcpToken = (magicMcpTokenId: string | null | undefined) => {
  let data = magicMcpTokenLoader.use(magicMcpTokenId ? { magicMcpTokenId } : null);

  return {
    ...data,
    useUpdateMutator: data.useMutator('update'),
    useDeleteMutator: data.useMutator('delete'),
    useAddGroupsMutator: data.useMutator('addGroups'),
    useRemoveGroupsMutator: data.useMutator('removeGroups')
  };
};
