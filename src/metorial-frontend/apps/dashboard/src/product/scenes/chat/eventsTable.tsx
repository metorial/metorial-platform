import { col, createDataList, f, withDefaults } from '@metorial/data-list';
import { Paths } from '@metorial/frontend-config';
import { useChatEvents } from '@metorial/state';
import { Badge } from '@metorial/ui';
import { useMemo } from 'react';
import { useInstanceContext } from '../../lib/dataList';

let ChatEventsList = createDataList<{
  instanceId: string;
  chatConnectionId?: string;
  chatInstanceId?: string;
  chatId?: string;
}>('chat-events')
  .context(useInstanceContext)
  .filters(() => ({
    type: f.string('type', 'Type', { description: 'Filter by event type' }),
    occurredAt: f.date('occurredAt', 'Occurred', { description: 'Filter by occurrence date' })
  }))
  .paginated(({ props, filters, limit }) =>
    useChatEvents(
      props.instanceId,
      withDefaults(
        {
          chatConnectionId: props.chatConnectionId,
          chatInstanceId: props.chatInstanceId,
          chatId: props.chatId,
          order: 'desc' as const,
          limit: limit ?? 100
        },
        filters
      )
    )
  )
  .columns([
    col.text({ id: 'type', header: 'Type', weight: 'strong', get: row => row.type }),
    col.custom({
      id: 'source',
      header: 'Source',
      render: row => (
        <Badge color={row.source === 'webhook' ? 'blue' : 'gray'}>{row.source}</Badge>
      )
    }),
    col.refId('chatId', row => row.chatId, { header: 'Chat' }),
    col.date('occurredAt', { header: 'Occurred', isDefault: true }),
    col.createdAt({ header: 'Recorded', isDefault: false }),
    col.id({ isDefault: true })
  ])
  .link((row, _props, ctx) =>
    Paths.instance.chatEvent(ctx.organization, ctx.project, ctx.instance, row.id)
  )
  .build();

export let ChatEventsTable = (p: Parameters<typeof ChatEventsList>[0]) => (
  <ChatEventsList emptyState="No chat events have been received yet." {...p} />
);

let FAILURE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

let ChatInvocationFailuresList = createDataList<{
  instanceId: string;
  chatConnectionId: string;
}>('chat-invocation-failures')
  .context(useInstanceContext)
  .paginated(({ props, limit }) => {
    let since = useMemo(() => new Date(Date.now() - FAILURE_WINDOW_MS), []);

    return useChatEvents(props.instanceId, {
      chatConnectionId: props.chatConnectionId,
      type: 'chat.invocation.failed',
      occurredAt: { gt: since },
      order: 'desc',
      limit
    });
  })
  .columns([
    col.text({
      id: 'operation',
      header: 'Operation',
      weight: 'strong',
      get: row => row.error?.operation
    }),
    col.text({
      id: 'error',
      header: 'Error',
      get: row => row.error?.message ?? row.error?.code
    }),
    col.date('occurredAt', { header: 'Occurred', isDefault: true })
  ])
  .link((row, _props, ctx) =>
    Paths.instance.chatEvent(ctx.organization, ctx.project, ctx.instance, row.id)
  )
  .build();

export let ChatInvocationFailuresTable = (p: {
  instanceId: string;
  chatConnectionId: string;
  limit?: number;
  viewAllHref?: string;
}) => (
  <ChatInvocationFailuresList
    instanceId={p.instanceId}
    chatConnectionId={p.chatConnectionId}
    listVariant="preview"
    listLimit={p.limit ?? 5}
    viewAllHref={p.viewAllHref}
  />
);
