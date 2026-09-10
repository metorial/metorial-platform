import type { DashboardInstanceCallbackEventsListQuery } from '@metorial/dashboard-sdk';
import { Paths } from '@metorial/frontend-config';
import {
  CallbackEventPreview,
  useCallbackEvents,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject
} from '@metorial/state';
import {
  getConstrainedEnumListFilterValue,
  getDateRangeFilterValue,
  getEnumListFilterValue,
  getStringFilterValue,
  Table as DashboardTable,
  TableStateProvider,
  TableStateProviderResult
} from '@metorial/table';
import { Badge, RenderDate, Text } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { getCallbackEventStatusColor } from './shared';

type CallbackEventsTableProps = {
  instanceId: string;
  filters?: Omit<
    DashboardInstanceCallbackEventsListQuery,
    'limit' | 'after' | 'before' | 'cursor'
  >;
  organization: ReturnType<typeof useCurrentOrganization>;
  project: ReturnType<typeof useCurrentProject>;
  instance: ReturnType<typeof useCurrentInstance>;
};

let useCallbackEventsTableState: TableStateProvider<
  CallbackEventsTableProps,
  CallbackEventPreview,
  TableStateProviderResult<CallbackEventPreview>
> = (props, opts) => {
  let events = useCallbackEvents(props.instanceId, {
    order: 'desc',
    ...props.filters,
    status: getConstrainedEnumListFilterValue(
      opts.filter.status,
      ['pending', 'processed', 'failed'],
      props.filters?.status
    ),
    source:
      getEnumListFilterValue(opts.filter.source, ['webhook', 'polling']) ??
      props.filters?.source,
    callbackId: getStringFilterValue(opts.filter.callbackId) ?? props.filters?.callbackId,
    integrationId:
      getStringFilterValue(opts.filter.integrationId) ?? props.filters?.integrationId,
    providerId: getStringFilterValue(opts.filter.providerId) ?? props.filters?.providerId,
    providerTriggerKey:
      getStringFilterValue(opts.filter.providerTriggerKey) ??
      props.filters?.providerTriggerKey,
    occurredAt: getDateRangeFilterValue(opts.filter.occurredAt) ?? props.filters?.occurredAt
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

let callbackEventsTable = new DashboardTable<CallbackEventsTableProps, CallbackEventPreview>(
  'callback-events'
)
  .state(useCallbackEventsTableState)
  .columns([
    {
      id: 'trigger',
      isDefault: true,
      header: 'Trigger',
      render: event => (
        <div>
          <Text size="2" weight="strong">
            {event.providerTriggerKey}
          </Text>
          {event.mappedType ? (
            <Text size="1" color="gray600">
              {event.mappedType}
              {event.mappedId ? ` · ${event.mappedId}` : ''}
            </Text>
          ) : null}
        </div>
      )
    },
    {
      id: 'status',
      isDefault: true,
      header: 'Status',
      render: event => (
        <Badge color={getCallbackEventStatusColor(event.status)}>{event.status}</Badge>
      )
    },
    {
      id: 'source',
      isDefault: true,
      header: 'Source',
      render: event => <Text size="2">{event.source}</Text>
    },
    {
      id: 'callbackId',
      isDefault: true,
      header: 'Callback',
      render: event => <ID id={event.callbackId} copy={false} />
    },
    {
      id: 'callbackInstanceId',
      isDefault: false,
      header: 'Callback Instance',
      render: event => <ID id={event.callbackInstanceId} copy={false} />
    },
    {
      id: 'occurredAt',
      isDefault: true,
      header: 'Occurred',
      render: event => <RenderDate date={event.occurredAt} />
    },
    {
      id: 'createdAt',
      isDefault: false,
      header: 'Recorded',
      render: event => <RenderDate date={event.createdAt} />
    },
    {
      id: 'id',
      isDefault: false,
      header: 'Event ID',
      render: event => <ID id={event.id} />
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
        { id: 'pending', label: 'Pending' },
        { id: 'processed', label: 'Processed' },
        { id: 'failed', label: 'Failed' }
      ]
    },
    {
      id: 'source',
      fields: ['source'],
      label: 'Source',
      description: 'Filter by source',
      type: 'select',
      options: [
        { id: 'webhook', label: 'Webhook' },
        { id: 'polling', label: 'Polling' }
      ]
    },
    {
      id: 'providerTriggerKey',
      fields: ['providerTriggerKey'],
      label: 'Trigger Key',
      description: 'Filter by trigger key',
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
      id: 'integrationId',
      fields: ['integrationId'],
      label: 'Integration ID',
      description: 'Filter by integration ID',
      type: 'string'
    },
    {
      id: 'providerId',
      fields: ['providerId'],
      label: 'Provider ID',
      description: 'Filter by provider ID',
      type: 'string'
    },
    {
      id: 'occurredAt',
      fields: ['occurredAt'],
      label: 'Occurred',
      description: 'Filter by occurred date',
      type: 'date'
    }
  ])
  .link((event, props) =>
    Paths.instance.callbackEvent(
      props.organization.data,
      props.project.data,
      props.instance.data,
      event.id
    )
  )
  .build();

export let CallbackEventsTable = ({
  instanceId,
  filters,
  emptyState
}: {
  instanceId: string;
  filters?: CallbackEventsTableProps['filters'];
  emptyState?: string;
}) => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  return callbackEventsTable({
    instanceId,
    filters,
    instance,
    organization,
    project,
    emptyState: emptyState ?? 'No callback events recorded yet.'
  });
};
