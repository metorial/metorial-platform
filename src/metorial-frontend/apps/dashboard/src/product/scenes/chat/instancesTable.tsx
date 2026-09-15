import { Paths } from '@metorial/frontend-config';
import {
  useChatInstances,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useDeleteChatInstance,
  type ChatInstance
} from '@metorial/state';
import {
  Table as DashboardTable,
  getDateRangeFilterValue,
  getEnumListFilterValue,
  getStringFilterValue,
  type FilterPayload
} from '@metorial/table';
import { Avatar, Badge, confirm, Flex, RenderDate, Text } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { RiDeleteBinLine } from '@remixicon/react';
import { useState } from 'react';
import { capitalize, getChatStatusColor } from './shared';

type ChatInstancesTableProps = {
  instanceId: string;
  chatConnectionId: string;
  organization: ReturnType<typeof useCurrentOrganization>;
  project: ReturnType<typeof useCurrentProject>;
  instance: ReturnType<typeof useCurrentInstance>;
};

let getStatusFilterValue = (value: FilterPayload | undefined) =>
  getEnumListFilterValue(value, ['draft', 'active', 'archived', 'deleted']);

let useChatInstancesTableState = (
  props: ChatInstancesTableProps,
  opts: { filter: Record<string, FilterPayload>; search?: string }
) => {
  let chatInstances = useChatInstances(props.instanceId, {
    chatConnectionId: props.chatConnectionId,
    order: 'desc',
    status: getStatusFilterValue(opts.filter.status) ?? ['draft', 'active'],
    id: getStringFilterValue(opts.filter.id),
    search: opts.search,
    createdAt: getDateRangeFilterValue(opts.filter.createdAt),
    updatedAt: getDateRangeFilterValue(opts.filter.updatedAt)
  });

  return {
    isLoading: chatInstances.isLoading,
    error: chatInstances.error,
    hasMoreAfter: chatInstances.data?.pagination.hasMoreAfter ?? false,
    hasMoreBefore: chatInstances.data?.pagination.hasMoreBefore ?? false,
    items: chatInstances.data?.items ?? [],
    loadNext: chatInstances.next,
    loadPrevious: chatInstances.previous
  };
};

let useChatInstancesTableHookState = (
  _: ReturnType<typeof useChatInstancesTableState>,
  props: ChatInstancesTableProps
) => {
  let deleteChatInstance = useDeleteChatInstance();
  let [loadingIds, setLoadingIds] = useState<string[]>([]);

  return {
    deleteChatInstance,
    instanceId: props.instanceId,
    loadingIds,
    setLoadingIds
  };
};

let deleteChatInstanceImmediately = async (
  chatInstance: ChatInstance,
  state: ReturnType<typeof useChatInstancesTableHookState>
) => {
  state.setLoadingIds(current => [...new Set([...current, chatInstance.id])]);

  try {
    await state.deleteChatInstance.mutate({
      instanceId: state.instanceId,
      chatInstanceId: chatInstance.id
    });
  } finally {
    state.setLoadingIds(current => current.filter(id => id !== chatInstance.id));
  }
};

let chatInstancesTable = new DashboardTable<ChatInstancesTableProps, ChatInstance>(
  'chat-instances'
)
  .state(useChatInstancesTableState)
  .hookState(useChatInstancesTableHookState)
  .columns([
    {
      id: 'name',
      isDefault: true,
      header: 'Name',
      render: (chatInstance: ChatInstance) => (
        <div>
          <Text size="2" weight="strong">
            {chatInstance.name}
          </Text>
          {chatInstance.description && (
            <Text size="1" color="gray600">
              {chatInstance.description}
            </Text>
          )}
        </div>
      )
    },
    {
      id: 'status',
      isDefault: false,
      header: 'Status',
      render: (chatInstance: ChatInstance) => (
        <Badge color={getChatStatusColor(chatInstance.status)}>
          {capitalize(chatInstance.status)}
        </Badge>
      )
    },
    {
      id: 'identity',
      isDefault: true,
      header: 'Identity',
      render: (chatInstance: ChatInstance) =>
        chatInstance.identity ? (
          <Flex align="center" gap={8}>
            <Avatar
              entity={{
                name: chatInstance.identity.name || chatInstance.identity.username,
                photoUrl: chatInstance.identity.imageUrl ?? undefined
              }}
              size={24}
              noTooltip
            />
            <Text size="2">{chatInstance.identity.name || chatInstance.identity.username}</Text>
          </Flex>
        ) : (
          <Text size="2" color="gray600">
            Not connected
          </Text>
        )
    },
    {
      id: 'createdAt',
      isDefault: true,
      header: 'Created',
      render: (chatInstance: ChatInstance) => <RenderDate date={chatInstance.createdAt} />
    },
    {
      id: 'updatedAt',
      isDefault: false,
      header: 'Updated',
      render: (chatInstance: ChatInstance) => <RenderDate date={chatInstance.updatedAt} />
    },
    {
      id: 'id',
      isDefault: true,
      header: 'ID',
      render: (chatInstance: ChatInstance) => <ID id={chatInstance.id} />
    }
  ])
  .filters([
    {
      id: 'status',
      fields: ['status'],
      label: 'Status',
      description: 'Filter by status',
      type: 'select',
      options: [
        { id: 'draft', label: 'Draft' },
        { id: 'active', label: 'Active' },
        { id: 'archived', label: 'Archived' },
        { id: 'deleted', label: 'Deleted' }
      ]
    },
    {
      id: 'id',
      fields: ['id'],
      label: 'Instance ID',
      description: 'Filter by instance ID',
      type: 'string'
    },
    {
      id: 'createdAt',
      fields: ['createdAt'],
      label: 'Created',
      description: 'Filter by created date',
      type: 'date'
    },
    {
      id: 'updatedAt',
      fields: ['updatedAt'],
      label: 'Updated',
      description: 'Filter by updated date',
      type: 'date'
    }
  ])
  .search('Search chat instances...')
  .link(((chatInstance: ChatInstance, props: ChatInstancesTableProps) =>
    Paths.instance.chatInstance(
      props.organization.data,
      props.project.data,
      props.instance.data,
      chatInstance.id
    )) as any)
  .actions({
    deleteImmediate: async (chatInstances, state) => {
      let chatInstance = chatInstances[0];
      if (!chatInstance) return;

      await deleteChatInstanceImmediately(chatInstance, state);
    },
    delete: async (chatInstances, state) => {
      let chatInstance = chatInstances[0];
      if (!chatInstance) return;

      confirm({
        title: 'Delete instance',
        description: `Delete ${chatInstance.name}?`,
        confirmText: 'Delete',
        onConfirm: async () => {
          await deleteChatInstanceImmediately(chatInstance, state);
        }
      });
    }
  })
  .rowActions([
    {
      id: 'delete',
      label: 'Delete',
      icon: <RiDeleteBinLine />,
      action: 'delete'
    }
  ])
  .bulkActions([
    {
      id: 'delete-selected',
      label: 'Delete',
      icon: <RiDeleteBinLine />,
      action: 'deleteImmediate',
      bulkExecution: {
        mode: 'per-row',
        batchSize: 5
      }
    }
  ])
  .build();

export let ChatInstancesTable = (p: { instanceId: string; chatConnectionId: string }) => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  return chatInstancesTable({
    instanceId: p.instanceId,
    chatConnectionId: p.chatConnectionId,
    instance,
    organization,
    project,
    emptyState: 'No instances have been created for this chat connection yet.'
  });
};
