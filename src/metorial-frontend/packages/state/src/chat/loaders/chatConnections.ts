import type {
  DashboardInstanceChatConnectionsCreateBody,
  DashboardInstanceChatConnectionsGetOutput,
  DashboardInstanceChatConnectionsListOutput,
  DashboardInstanceChatConnectionsListQuery,
  DashboardInstanceChatConnectionsUpdateBody
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export type ChatConnectionPreview =
  DashboardInstanceChatConnectionsListOutput['items'][number];
export type ChatConnection = DashboardInstanceChatConnectionsGetOutput;
export type ChatConnectionProvider = ChatConnection['providers'][number];

export let chatConnectionsLoader = createLoader({
  name: 'chatConnections',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceChatConnectionsListQuery) =>
    withAuth(sdk => {
      let { instanceId, ...query } = i;
      return sdk.chat.connections.list(instanceId, query);
    }),
  mutators: {}
});

export let useChatConnections = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceChatConnectionsListQuery
) =>
  usePaginator(pagination =>
    chatConnectionsLoader.use(instanceId ? { instanceId, ...pagination, ...query } : null)
  );

export let useHasChatConnections = (instanceId: string | null | undefined) => {
  let data = chatConnectionsLoader.use(instanceId ? { instanceId, limit: 1 } : null);

  return { ...data, hasChatConnections: (data.data?.items.length ?? 0) > 0 };
};

export let useCreateChatConnection = chatConnectionsLoader.createExternalMutator(
  (i: { instanceId: string } & DashboardInstanceChatConnectionsCreateBody) => {
    let { instanceId, ...body } = i;
    return withAuth(sdk => sdk.chat.connections.create(instanceId, body));
  },
  { disableToast: true }
);

export let useDeleteChatConnection = chatConnectionsLoader.createExternalMutator(
  (i: { instanceId: string; chatConnectionId: string }) =>
    withAuth(sdk => sdk.chat.connections.delete(i.instanceId, i.chatConnectionId))
);

export let chatConnectionLoader = createLoader({
  name: 'chatConnection',
  parents: [chatConnectionsLoader],
  fetch: (i: { instanceId: string; chatConnectionId: string }) =>
    withAuth(sdk => sdk.chat.connections.get(i.instanceId, i.chatConnectionId)),
  mutators: {
    update: (
      body: DashboardInstanceChatConnectionsUpdateBody,
      { input: { instanceId, chatConnectionId } }
    ) => withAuth(sdk => sdk.chat.connections.update(instanceId, chatConnectionId, body)),
    delete: (_, { input: { instanceId, chatConnectionId } }) =>
      withAuth(sdk => sdk.chat.connections.delete(instanceId, chatConnectionId))
  }
});

export let useChatConnection = (
  instanceId: string | null | undefined,
  chatConnectionId: string | null | undefined
) => {
  let data = chatConnectionLoader.use(
    instanceId && chatConnectionId ? { instanceId, chatConnectionId } : null
  );

  return {
    ...data,
    useUpdateMutator: data.useMutator('update'),
    useDeleteMutator: data.useMutator('delete')
  };
};
