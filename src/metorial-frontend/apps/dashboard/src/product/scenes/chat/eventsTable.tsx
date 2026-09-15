import { Paths } from '@metorial/frontend-config';
import {
  useChatEvents,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  type ChatEventPreview
} from '@metorial/state';
import {
  getDateRangeFilterValue,
  getStringFilterValue,
  Table as DashboardTable,
  type FilterPayload
} from '@metorial/table';
import { Badge, RenderDate, Text } from '@metorial/ui';
import { ID } from '@metorial/ui-product';

type ChatEventsTableProps = {
  instanceId: string;
  chatConnectionId?: string;
  chatInstanceId?: string;
  chatId?: string;
  organization: ReturnType<typeof useCurrentOrganization>;
  project: ReturnType<typeof useCurrentProject>;
  instance: ReturnType<typeof useCurrentInstance>;
};

let useChatEventsTableState = (
  props: ChatEventsTableProps,
  opts: { filter: Record<string, FilterPayload> }
) => {
  let chatEvents = useChatEvents(props.instanceId, {
    chatConnectionId: props.chatConnectionId,
    chatInstanceId: props.chatInstanceId,
    chatId: props.chatId,
    order: 'desc',
    type: getStringFilterValue(opts.filter.type),
    occurredAt: getDateRangeFilterValue(opts.filter.occurredAt)
  });

  return {
    isLoading: chatEvents.isLoading,
    error: chatEvents.error,
    hasMoreAfter: chatEvents.data?.pagination.hasMoreAfter ?? false,
    hasMoreBefore: chatEvents.data?.pagination.hasMoreBefore ?? false,
    items: chatEvents.data?.items ?? [],
    loadNext: chatEvents.next,
    loadPrevious: chatEvents.previous
  };
};

let chatEventsTable = new DashboardTable<ChatEventsTableProps, ChatEventPreview>('chat-events')
  .state<ChatEventsTableProps, ChatEventPreview, ReturnType<typeof useChatEventsTableState>>(
    useChatEventsTableState
  )
  .columns([
    {
      id: 'type',
      isDefault: true,
      header: 'Type',
      render: (chatEvent: ChatEventPreview) => (
        <Text size="2" weight="strong">
          {chatEvent.type}
        </Text>
      )
    },
    {
      id: 'source',
      isDefault: true,
      header: 'Source',
      render: (chatEvent: ChatEventPreview) => (
        <Badge color={chatEvent.source === 'webhook' ? 'blue' : 'gray'}>
          {chatEvent.source}
        </Badge>
      )
    },
    {
      id: 'chatId',
      isDefault: false,
      header: 'Chat',
      render: (chatEvent: ChatEventPreview) => <ID id={chatEvent.chatId} />
    },
    {
      id: 'occurredAt',
      isDefault: true,
      header: 'Occurred',
      render: (chatEvent: ChatEventPreview) => <RenderDate date={chatEvent.occurredAt} />
    },
    {
      id: 'createdAt',
      isDefault: false,
      header: 'Recorded',
      render: (chatEvent: ChatEventPreview) => <RenderDate date={chatEvent.createdAt} />
    },
    {
      id: 'id',
      isDefault: true,
      header: 'ID',
      render: (chatEvent: ChatEventPreview) => <ID id={chatEvent.id} />
    }
  ])
  .filters([
    {
      id: 'type',
      fields: ['type'],
      label: 'Type',
      description: 'Filter by event type',
      type: 'string'
    },
    {
      id: 'occurredAt',
      fields: ['occurredAt'],
      label: 'Occurred',
      description: 'Filter by occurrence date',
      type: 'date'
    }
  ])
  .link(((chatEvent: ChatEventPreview, props: ChatEventsTableProps) =>
    Paths.instance.chatEvent(
      props.organization.data,
      props.project.data,
      props.instance.data,
      chatEvent.id
    )) as any)
  .build();

export let ChatEventsTable = (p: {
  instanceId: string;
  chatConnectionId?: string;
  chatInstanceId?: string;
  chatId?: string;
}) => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  return chatEventsTable({
    instanceId: p.instanceId,
    chatConnectionId: p.chatConnectionId,
    chatInstanceId: p.chatInstanceId,
    chatId: p.chatId,
    instance,
    organization,
    project,
    emptyState: 'No chat events have been received yet.'
  });
};
