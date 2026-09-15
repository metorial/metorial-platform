import type {
  DashboardInstanceChatInstancesCreateBody,
  DashboardInstanceChatInstancesGetOutput,
  DashboardInstanceChatInstancesListOutput,
  DashboardInstanceChatInstancesListQuery,
  DashboardInstanceChatInstancesProviderGetOutput,
  DashboardInstanceChatInstancesProviderSetBody,
  DashboardInstanceChatInstancesUpdateBody
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { autoPaginate } from '../../lib/autoPaginate';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';
import { chatConnectionsLoader } from './chatConnections';

export type ChatInstancePreview = DashboardInstanceChatInstancesListOutput['items'][number];
export type ChatInstance = DashboardInstanceChatInstancesGetOutput;
export type ChatInstanceProvider = DashboardInstanceChatInstancesProviderGetOutput;

export let chatInstancesLoader = createLoader({
  name: 'chatInstances',
  parents: [chatConnectionsLoader],
  fetch: (i: { instanceId: string } & DashboardInstanceChatInstancesListQuery) =>
    withAuth(sdk => {
      let { instanceId, ...query } = i;
      return sdk.chat.instances.list(instanceId, query);
    }),
  mutators: {}
});

export let useChatInstances = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceChatInstancesListQuery
) =>
  usePaginator(pagination =>
    chatInstancesLoader.use(instanceId ? { instanceId, ...pagination, ...query } : null)
  );

export let allChatInstancesLoader = createLoader({
  name: 'allChatInstances',
  parents: [chatConnectionsLoader, chatInstancesLoader],
  fetch: (
    i: { instanceId: string } & Omit<DashboardInstanceChatInstancesListQuery, 'limit'>
  ) =>
    withAuth(sdk => {
      let { instanceId, ...query } = i;
      return autoPaginate(cursor =>
        sdk.chat.instances.list(instanceId, { ...query, ...cursor })
      );
    }),
  mutators: {}
});

export let useAllChatInstances = (
  instanceId: string | null | undefined,
  query?: Omit<DashboardInstanceChatInstancesListQuery, 'limit'>
) => allChatInstancesLoader.use(instanceId ? { instanceId, ...query } : null);

export let useCreateChatInstance = chatInstancesLoader.createExternalMutator(
  (i: { instanceId: string } & DashboardInstanceChatInstancesCreateBody) => {
    let { instanceId, ...body } = i;
    return withAuth(sdk => sdk.chat.instances.create(instanceId, body));
  }
);

export let useDeleteChatInstance = chatInstancesLoader.createExternalMutator(
  (i: { instanceId: string; chatInstanceId: string }) =>
    withAuth(sdk => sdk.chat.instances.delete(i.instanceId, i.chatInstanceId))
);

export let useSyncChatInstance = chatInstancesLoader.createExternalMutator(
  (i: { instanceId: string; chatInstanceId: string }) =>
    withAuth(sdk => sdk.chat.instances.sync(i.instanceId, i.chatInstanceId)),
  { disableToast: true }
);

export let useSetChatInstanceProvider = chatInstancesLoader.createExternalMutator(
  (
    i: {
      instanceId: string;
      chatInstanceId: string;
    } & DashboardInstanceChatInstancesProviderSetBody
  ) => {
    let { instanceId, chatInstanceId, ...body } = i;
    return withAuth(sdk => sdk.chat.instances.provider.set(instanceId, chatInstanceId, body));
  },
  { disableToast: true }
);

export let chatInstanceLoader = createLoader({
  name: 'chatInstance',
  parents: [chatInstancesLoader],
  fetch: (i: { instanceId: string; chatInstanceId: string }) =>
    withAuth(sdk => sdk.chat.instances.get(i.instanceId, i.chatInstanceId)),
  mutators: {
    update: (
      body: DashboardInstanceChatInstancesUpdateBody,
      { input: { instanceId, chatInstanceId } }
    ) => withAuth(sdk => sdk.chat.instances.update(instanceId, chatInstanceId, body)),
    delete: (_, { input: { instanceId, chatInstanceId } }) =>
      withAuth(sdk => sdk.chat.instances.delete(instanceId, chatInstanceId)),
    sync: (_, { input: { instanceId, chatInstanceId } }) =>
      withAuth(sdk => sdk.chat.instances.sync(instanceId, chatInstanceId))
  }
});

export let useChatInstance = (
  instanceId: string | null | undefined,
  chatInstanceId: string | null | undefined
) => {
  let data = chatInstanceLoader.use(
    instanceId && chatInstanceId ? { instanceId, chatInstanceId } : null
  );

  return {
    ...data,
    useUpdateMutator: data.useMutator('update'),
    useDeleteMutator: data.useMutator('delete'),
    useSyncMutator: data.useMutator('sync')
  };
};

export let chatInstanceProviderLoader = createLoader({
  name: 'chatInstanceProvider',
  parents: [chatInstancesLoader],
  fetch: (i: { instanceId: string; chatInstanceId: string }) =>
    withAuth(sdk => sdk.chat.instances.provider.get(i.instanceId, i.chatInstanceId)),
  mutators: {}
});

export let useChatInstanceProvider = (
  instanceId: string | null | undefined,
  chatInstanceId: string | null | undefined
) =>
  chatInstanceProviderLoader.use(
    instanceId && chatInstanceId ? { instanceId, chatInstanceId } : null
  );

export let chatInstanceAuthenticatedUserLoader = createLoader({
  name: 'chatInstanceAuthenticatedUser',
  parents: [chatInstanceProviderLoader],
  fetch: (i: { instanceId: string; chatInstanceId: string }) =>
    withAuth(sdk =>
      sdk.chat.instances.provider.authenticatedUser(i.instanceId, i.chatInstanceId)
    ),
  mutators: {}
});

export let useChatInstanceAuthenticatedUser = (
  instanceId: string | null | undefined,
  chatInstanceId: string | null | undefined
) =>
  chatInstanceAuthenticatedUserLoader.use(
    instanceId && chatInstanceId ? { instanceId, chatInstanceId } : null
  );
