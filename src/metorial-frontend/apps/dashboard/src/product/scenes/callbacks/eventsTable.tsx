import type { DashboardOrganizationsEventsListQuery } from '@metorial/dashboard-sdk';
import { Paths } from '@metorial/frontend-config';
import {
  EventPreview,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useEvents
} from '@metorial/state';
import {
  getEnumListFilterValue,
  getStringFilterValue,
  Table as DashboardTable,
  TableStateProvider,
  TableStateProviderResult
} from '@metorial/table';
import { Badge, RenderDate, Text } from '@metorial/ui';
import { ID } from '@metorial/ui-product';

type EventsTableProps = {
  organizationId: string;
  filters?: Omit<
    DashboardOrganizationsEventsListQuery,
    'limit' | 'after' | 'before' | 'cursor'
  >;
  organization: ReturnType<typeof useCurrentOrganization>;
  project: ReturnType<typeof useCurrentProject>;
  instance: ReturnType<typeof useCurrentInstance>;
};

let useEventsTableState: TableStateProvider<
  EventsTableProps,
  EventPreview,
  TableStateProviderResult<EventPreview>
> = (props, opts) => {
  let events = useEvents(props.organizationId, {
    order: 'desc',
    ...props.filters,
    source:
      getEnumListFilterValue(opts.filter.source, ['resource', 'callback']) ??
      props.filters?.source,
    eventType: getStringFilterValue(opts.filter.eventType) ?? props.filters?.eventType,
    callbackId: getStringFilterValue(opts.filter.callbackId) ?? props.filters?.callbackId,
    callbackTriggerKey:
      getStringFilterValue(opts.filter.callbackTriggerKey) ?? props.filters?.callbackTriggerKey
  });

  return {
    isLoading: events.isLoading,
    error: events.error,
    hasMoreAfter: events.data?.pagination.hasMoreAfter ?? false,
    hasMoreBefore: events.data?.pagination.hasMoreBefore ?? false,
    items: events.data?.items ?? [],
    loadNext: events.next,
    loadPrevious: events.previous
  };
};

let eventsTable = new DashboardTable<EventsTableProps, EventPreview>('events')
  .state(useEventsTableState)
  .columns([
    {
      id: 'eventType',
      isDefault: true,
      header: 'Event',
      render: event => (
        <Text size="2" weight="strong">
          {event.eventType}
        </Text>
      )
    },
    {
      id: 'source',
      isDefault: true,
      header: 'Source',
      render: event => (
        <Badge color={event.source === 'callback' ? 'blue' : 'gray'}>{event.source}</Badge>
      )
    },
    {
      id: 'callbackId',
      isDefault: true,
      header: 'Callback',
      render: event =>
        event.callbackId ? (
          <ID id={event.callbackId} copy={false} />
        ) : (
          <Text size="2" color="gray600">
            -
          </Text>
        )
    },
    {
      id: 'instanceId',
      isDefault: false,
      header: 'Instance',
      render: event =>
        event.instanceId ? (
          <ID id={event.instanceId} copy={false} />
        ) : (
          <Text size="2" color="gray600">
            -
          </Text>
        )
    },
    {
      id: 'createdAt',
      isDefault: true,
      header: 'Recorded',
      render: event => <RenderDate date={event.createdAt} />
    },
    {
      id: 'id',
      isDefault: true,
      header: 'Event ID',
      render: event => <ID id={event.id} />
    }
  ])
  .filters([
    {
      id: 'source',
      fields: ['source'],
      label: 'Source',
      description: 'Filter by source',
      type: 'select',
      options: [
        { id: 'callback', label: 'Callback' },
        { id: 'resource', label: 'Resource' }
      ]
    },
    {
      id: 'eventType',
      fields: ['eventType'],
      label: 'Event Type',
      description: 'Filter by event type',
      type: 'string'
    },
    {
      id: 'callbackId',
      fields: ['callbackId'],
      label: 'Callback ID',
      description: 'Filter by callback ID',
      type: 'string'
    },
    {
      id: 'callbackTriggerKey',
      fields: ['callbackTriggerKey'],
      label: 'Trigger Key',
      description: 'Filter by callback trigger key',
      type: 'string'
    }
  ])
  .link((event, props) =>
    Paths.instance.event(
      props.organization.data,
      props.project.data,
      props.instance.data,
      event.id
    )
  )
  .build();

export let EventsTable = ({
  organizationId,
  filters,
  emptyState
}: {
  organizationId: string;
  filters?: EventsTableProps['filters'];
  emptyState?: string;
}) => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  return eventsTable({
    organizationId,
    filters,
    instance,
    organization,
    project,
    emptyState: emptyState ?? 'No events recorded yet.'
  });
};
