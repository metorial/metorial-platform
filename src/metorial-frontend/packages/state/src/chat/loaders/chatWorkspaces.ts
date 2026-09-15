import type {
  DashboardInstanceChatWorkspacesListOutput,
  DashboardInstanceChatWorkspacesListQuery
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { autoPaginate } from '../../lib/autoPaginate';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';
import { chatInstancesLoader } from './chatInstances';

export type ChatWorkspace = DashboardInstanceChatWorkspacesListOutput['items'][number];

export let chatWorkspacesLoader = createLoader({
  name: 'chatWorkspaces',
  parents: [chatInstancesLoader],
  fetch: (i: { instanceId: string } & DashboardInstanceChatWorkspacesListQuery) =>
    withAuth(sdk => {
      let { instanceId, ...query } = i;
      return sdk.chat.workspaces.list(instanceId, query);
    }),
  mutators: {}
});

export let useChatWorkspaces = (
  instanceId: string | null | undefined,
  chatInstanceId: string | null | undefined,
  query?: Omit<DashboardInstanceChatWorkspacesListQuery, 'chatInstanceId'>
) =>
  usePaginator(pagination =>
    chatWorkspacesLoader.use(
      instanceId && chatInstanceId
        ? { instanceId, chatInstanceId, ...pagination, ...query }
        : null
    )
  );

export let allChatWorkspacesLoader = createLoader({
  name: 'allChatWorkspaces',
  parents: [chatInstancesLoader, chatWorkspacesLoader],
  fetch: (
    i: { instanceId: string } & Omit<DashboardInstanceChatWorkspacesListQuery, 'limit'>
  ) =>
    withAuth(sdk => {
      let { instanceId, ...query } = i;
      return autoPaginate(cursor =>
        sdk.chat.workspaces.list(instanceId, { ...query, ...cursor })
      );
    }),
  mutators: {}
});

export let useAllChatWorkspaces = (
  instanceId: string | null | undefined,
  chatInstanceId: string | null | undefined
) =>
  allChatWorkspacesLoader.use(
    instanceId && chatInstanceId ? { instanceId, chatInstanceId } : null
  );
