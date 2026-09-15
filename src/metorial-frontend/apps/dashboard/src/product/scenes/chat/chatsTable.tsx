import { Paths } from '@metorial/frontend-config';
import {
  useChats,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  type ChatPreview
} from '@metorial/state';
import {
  Table as DashboardTable,
  getDateRangeFilterValue,
  getEnumListFilterValue,
  getStringFilterValue,
  type FilterPayload
} from '@metorial/table';
import { Badge, RenderDate, Text } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { capitalize, getChatStatusColor } from './shared';

type ChatsTableProps = {
  instanceId: string;
  chatConnectionId?: string;
  chatInstanceId?: string;
  organization: ReturnType<typeof useCurrentOrganization>;
  project: ReturnType<typeof useCurrentProject>;
  instance: ReturnType<typeof useCurrentInstance>;
};

let getStatusFilterValue = (value: FilterPayload | undefined) =>
  getEnumListFilterValue(value, ['active', 'archived', 'deleted']);

let useChatsTableState = (
  props: ChatsTableProps,
  opts: { filter: Record<string, FilterPayload>; search?: string }
) => {
  let chats = useChats(props.instanceId, {
    chatConnectionId: props.chatConnectionId,
    chatInstanceId: props.chatInstanceId,
    order: 'desc',
    status: getStatusFilterValue(opts.filter.status) ?? ['active'],
    id: getStringFilterValue(opts.filter.id),
    search: opts.search,
    createdAt: getDateRangeFilterValue(opts.filter.createdAt),
    updatedAt: getDateRangeFilterValue(opts.filter.updatedAt)
  });

  return {
    isLoading: chats.isLoading,
    error: chats.error,
    hasMoreAfter: chats.data?.pagination.hasMoreAfter ?? false,
    hasMoreBefore: chats.data?.pagination.hasMoreBefore ?? false,
    items: chats.data?.items ?? [],
    loadNext: chats.next,
    loadPrevious: chats.previous
  };
};

let chatsTable = new DashboardTable<ChatsTableProps, ChatPreview>('chats')
  .state<ChatsTableProps, ChatPreview, ReturnType<typeof useChatsTableState>>(
    useChatsTableState
  )
  .columns([
    {
      id: 'name',
      isDefault: true,
      header: 'Name',
      render: (chat: ChatPreview) => (
        <Text size="2" weight="strong">
          {chat.name}
        </Text>
      )
    },
    {
      id: 'status',
      isDefault: false,
      header: 'Status',
      render: (chat: ChatPreview) => (
        <Badge color={getChatStatusColor(chat.status)}>{capitalize(chat.status)}</Badge>
      )
    },
    {
      id: 'chatInstanceId',
      isDefault: false,
      header: 'Instance',
      render: (chat: ChatPreview) => <ID id={chat.chatInstanceId} />
    },
    {
      id: 'createdAt',
      isDefault: true,
      header: 'Created',
      render: (chat: ChatPreview) => <RenderDate date={chat.createdAt} />
    },
    {
      id: 'updatedAt',
      isDefault: false,
      header: 'Updated',
      render: (chat: ChatPreview) => <RenderDate date={chat.updatedAt} />
    },
    {
      id: 'id',
      isDefault: true,
      header: 'ID',
      render: (chat: ChatPreview) => <ID id={chat.id} />
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
        { id: 'active', label: 'Active' },
        { id: 'archived', label: 'Archived' },
        { id: 'deleted', label: 'Deleted' }
      ]
    },
    {
      id: 'id',
      fields: ['id'],
      label: 'Chat ID',
      description: 'Filter by chat ID',
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
  .search('Search chats...')
  .link(((chat: ChatPreview, props: ChatsTableProps) =>
    Paths.instance.chat(
      props.organization.data,
      props.project.data,
      props.instance.data,
      chat.id
    )) as any)
  .build();

export let ChatsTable = (p: {
  instanceId: string;
  chatConnectionId?: string;
  chatInstanceId?: string;
}) => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  return chatsTable({
    instanceId: p.instanceId,
    chatConnectionId: p.chatConnectionId,
    chatInstanceId: p.chatInstanceId,
    instance,
    organization,
    project,
    emptyState: 'No chats have been synced yet.'
  });
};
