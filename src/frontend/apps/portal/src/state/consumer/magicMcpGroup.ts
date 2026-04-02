import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../lib/usePaginator';
import { type PortalMagicMcpClient, withMagicMcpClient } from './magicMcpServer';

export type MagicMcpGroupsListQuery = NonNullable<
  Parameters<PortalMagicMcpClient['magicMcp']['groups']['list']>[0]
>;
export type MagicMcpGroupsCreateBody =
  Parameters<PortalMagicMcpClient['magicMcp']['groups']['create']>[0];
export type MagicMcpGroupsUpdateBody =
  Parameters<PortalMagicMcpClient['magicMcp']['groups']['update']>[1];
export type MagicMcpGroupsGetOutput = Awaited<
  ReturnType<PortalMagicMcpClient['magicMcp']['groups']['get']>
>;
export type MagicMcpGroupsListOutput = Awaited<
  ReturnType<PortalMagicMcpClient['magicMcp']['groups']['list']>
>;
export type MagicMcpGroupRow = MagicMcpGroupsListOutput['items'][number];

export let magicMcpGroupsLoader = createLoader({
  name: 'magicMcpGroups',
  parents: [],
  fetch: async (input: MagicMcpGroupsListQuery) =>
    await withMagicMcpClient(client => client.magicMcp.groups.list(input)),
  mutators: {
    update: async (
      input: MagicMcpGroupsUpdateBody & {
        magicMcpGroupId: string;
      }
    ) =>
      await withMagicMcpClient(client =>
        client.magicMcp.groups.update(input.magicMcpGroupId, {
          name: input.name,
          description: input.description,
          metadata: input.metadata
        })
      ),

    delete: async (input: { magicMcpGroupId: string }) =>
      await withMagicMcpClient(client => client.magicMcp.groups.delete(input.magicMcpGroupId))
  }
});

export let useCreateMagicMcpGroup = magicMcpGroupsLoader.createExternalMutator(
  async (input: MagicMcpGroupsCreateBody) =>
    await withMagicMcpClient(client => client.magicMcp.groups.create(input)),
  {
    disableToast: true
  }
);

export let useMagicMcpGroups = (query?: MagicMcpGroupsListQuery) => {
  let data = usePaginator(pagination =>
    magicMcpGroupsLoader.use({
      ...pagination,
      ...query
    })
  );

  return {
    ...data,
    createMutator: useCreateMagicMcpGroup,
    revokeMutator: data.useMutator('delete'),
    updateMutator: data.useMutator('update')
  };
};

export let magicMcpGroupLoader = createLoader({
  name: 'magicMcpGroup',
  parents: [magicMcpGroupsLoader],
  fetch: async (input: { magicMcpGroupId: string }) =>
    await withMagicMcpClient(client => client.magicMcp.groups.get(input.magicMcpGroupId)),
  mutators: {
    update: async (input: MagicMcpGroupsUpdateBody, { input: loaderInput }) =>
      await withMagicMcpClient(client =>
        client.magicMcp.groups.update(loaderInput.magicMcpGroupId, input)
      ),

    delete: async (_, { input: loaderInput }) =>
      await withMagicMcpClient(client =>
        client.magicMcp.groups.delete(loaderInput.magicMcpGroupId)
      ),

    addServers: async (
      input: { magicMcpServerIds: string[] },
      { input: loaderInput }
    ) =>
      await withMagicMcpClient(client =>
        client.magicMcp.groups.addServers(loaderInput.magicMcpGroupId, {
          magicMcpServerIds: input.magicMcpServerIds
        })
      ),

    removeServers: async (
      input: { magicMcpServerIds: string[] },
      { input: loaderInput }
    ) =>
      await withMagicMcpClient(client =>
        client.magicMcp.groups.removeServers(loaderInput.magicMcpGroupId, {
          magicMcpServerIds: input.magicMcpServerIds
        })
      )
  }
});

export let useMagicMcpGroup = (magicMcpGroupId: string | null | undefined) => {
  let data = magicMcpGroupLoader.use(magicMcpGroupId ? { magicMcpGroupId } : null);

  return {
    ...data,
    useUpdateMutator: data.useMutator('update'),
    useDeleteMutator: data.useMutator('delete'),
    useAddServersMutator: data.useMutator('addServers'),
    useRemoveServersMutator: data.useMutator('removeServers')
  };
};
