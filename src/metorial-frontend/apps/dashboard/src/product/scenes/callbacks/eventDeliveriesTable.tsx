import type { DashboardOrganizationsEventDeliveriesListQuery } from '@metorial/dashboard-sdk';
import { Paths } from '@metorial/frontend-config';
import {
  EventDeliveryPreview,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useEventDeliveries
} from '@metorial/state';
import {
  Table as DashboardTable,
  getEnumListFilterValue,
  getStringFilterValue,
  TableStateProvider,
  TableStateProviderResult
} from '@metorial/table';
import { Badge, Button, RenderDate, Text } from '@metorial/ui';
import { ID, Table } from '@metorial/ui-product';
import { Link } from 'react-router-dom';
import {
  EVENT_DELIVERY_STATUS_LABELS,
  EventDeliveryStatus,
  getEventDeliveryStatusColor,
  getEventDeliveryStatusLabel
} from './shared';

type EventDeliveriesTableProps = {
  organizationId: string;
  eventDestinationId: string;
  filters?: Omit<
    DashboardOrganizationsEventDeliveriesListQuery,
    'limit' | 'after' | 'before' | 'cursor'
  >;
  organization: ReturnType<typeof useCurrentOrganization>;
  project: ReturnType<typeof useCurrentProject>;
  instance: ReturnType<typeof useCurrentInstance>;
};

let deliveryStatuses = Object.keys(EVENT_DELIVERY_STATUS_LABELS) as EventDeliveryStatus[];

let useEventDeliveriesTableState: TableStateProvider<
  EventDeliveriesTableProps,
  EventDeliveryPreview,
  TableStateProviderResult<EventDeliveryPreview>
> = (props, opts) => {
  let deliveries = useEventDeliveries(props.organizationId, {
    order: 'desc',
    ...props.filters,
    status:
      getEnumListFilterValue(opts.filter.status, deliveryStatuses) ?? props.filters?.status,
    eventType: getStringFilterValue(opts.filter.eventType) ?? props.filters?.eventType,
    eventId: getStringFilterValue(opts.filter.eventId) ?? props.filters?.eventId,
    instanceId:
      getStringFilterValue(opts.filter.instanceId) ??
      props.filters?.instanceId ??
      props.instance.data?.id,
    eventDestinationId: props.eventDestinationId
  });

  return {
    isLoading: deliveries.isLoading,
    error: deliveries.error,
    hasMoreAfter: deliveries.data?.pagination.hasMoreAfter ?? false,
    hasMoreBefore: deliveries.data?.pagination.hasMoreBefore ?? false,
    items: deliveries.data?.items ?? [],
    loadNext: deliveries.next,
    loadPrevious: deliveries.previous
  };
};

let eventDeliveriesTable = new DashboardTable<EventDeliveriesTableProps, EventDeliveryPreview>(
  'event-deliveries'
)
  .state(useEventDeliveriesTableState)
  .columns([
    {
      id: 'eventType',
      isDefault: true,
      header: 'Event',
      render: delivery => (
        <Text size="2" weight="strong">
          {delivery.eventType}
        </Text>
      )
    },
    {
      id: 'status',
      isDefault: true,
      header: 'Status',
      render: delivery => (
        <Badge color={getEventDeliveryStatusColor(delivery.status)}>
          {getEventDeliveryStatusLabel(delivery.status)}
        </Badge>
      )
    },
    {
      id: 'attemptCount',
      isDefault: true,
      header: 'Attempts',
      render: delivery => <Text size="2">{delivery.attemptCount}</Text>
    },
    {
      id: 'activity',
      isDefault: true,
      header: 'Last Activity',
      render: delivery => <RenderDate date={delivery.lastAttemptAt ?? delivery.createdAt} />
    },
    {
      id: 'nextAttemptAt',
      isDefault: false,
      header: 'Next Attempt',
      render: delivery =>
        delivery.nextAttemptAt ? (
          <RenderDate date={delivery.nextAttemptAt} />
        ) : (
          <Text size="2" color="gray600">
            -
          </Text>
        )
    },
    {
      id: 'completedAt',
      isDefault: false,
      header: 'Completed',
      render: delivery =>
        delivery.completedAt ? (
          <RenderDate date={delivery.completedAt} />
        ) : (
          <Text size="2" color="gray600">
            -
          </Text>
        )
    },
    {
      id: 'eventId',
      isDefault: true,
      header: 'Event ID',
      render: delivery => <ID id={delivery.eventId} />
    },
    {
      id: 'instanceId',
      isDefault: false,
      header: 'Instance ID',
      render: delivery =>
        delivery.instanceId ? (
          <ID id={delivery.instanceId} />
        ) : (
          <Text size="2" color="gray600">
            -
          </Text>
        )
    },
    {
      id: 'id',
      isDefault: false,
      header: 'Delivery ID',
      render: delivery => <ID id={delivery.id} />
    }
  ])
  .filters([
    {
      id: 'status',
      fields: ['status'],
      label: 'Status',
      description: 'Filter by delivery status',
      type: 'select',
      options: deliveryStatuses.map(status => ({
        id: status,
        label: EVENT_DELIVERY_STATUS_LABELS[status]
      }))
    },
    {
      id: 'eventType',
      fields: ['eventType'],
      label: 'Event Type',
      description: 'Filter by event type',
      type: 'string'
    },
    {
      id: 'eventId',
      fields: ['eventId'],
      label: 'Event ID',
      description: 'Filter by event ID',
      type: 'string'
    },
    {
      id: 'instanceId',
      fields: ['instanceId'],
      label: 'Instance ID',
      description: 'Filter by instance ID',
      type: 'string'
    }
  ])
  .link((delivery, props) =>
    Paths.instance.eventDelivery(
      props.organization.data,
      props.project.data,
      props.instance.data,
      delivery.id
    )
  )
  .build();

export let EventDeliveriesTable = ({
  organizationId,
  eventDestinationId,
  filters,
  emptyState
}: {
  organizationId: string;
  eventDestinationId: string;
  filters?: EventDeliveriesTableProps['filters'];
  emptyState?: string;
}) => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  return eventDeliveriesTable({
    organizationId,
    eventDestinationId,
    filters,
    instance,
    organization,
    project,
    emptyState: emptyState ?? 'No deliveries recorded for this destination yet.'
  });
};

export let EventDeliveriesSimpleTable = ({
  deliveries,
  destinationUrls
}: {
  deliveries: EventDeliveryPreview[];
  destinationUrls?: Map<string, string>;
}) => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();
  let showDestination = !!destinationUrls;

  return (
    <Table
      headers={[
        ...(showDestination ? ['Destination'] : []),
        'Event',
        'Status',
        'Recorded',
        ''
      ]}
      data={deliveries.map(delivery => ({
        data: [
          ...(showDestination
            ? [
                <Text key="destination" size="2">
                  {destinationUrls?.get(delivery.eventDestinationId) ?? 'Endpoint unavailable'}
                </Text>
              ]
            : []),
          <Link
            key="event"
            to={Paths.instance.event(
              organization.data,
              project.data,
              instance.data,
              delivery.eventId
            )}
          >
            <Text size="2" weight="strong">
              {delivery.eventType}
            </Text>
          </Link>,
          <Badge key="status" color={getEventDeliveryStatusColor(delivery.status)}>
            {getEventDeliveryStatusLabel(delivery.status)}
          </Badge>,
          <RenderDate key="recorded" date={delivery.createdAt} />,
          <Link
            key="action"
            to={Paths.instance.eventDelivery(
              organization.data,
              project.data,
              instance.data,
              delivery.id
            )}
          >
            <Button size="1" as="span" variant="outline">
              View Details
            </Button>
          </Link>
        ]
      }))}
    />
  );
};
