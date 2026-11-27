import type { DashboardOrganizationsEventDeliveriesListQuery } from '@metorial/dashboard-sdk';
import {
  col,
  createDataList,
  defineStatus,
  f,
  withDefaults,
  type StatusDefinition
} from '@metorial/data-list';
import { Paths } from '@metorial/frontend-config';
import { EventDeliveryPreview, instancesLoader, useEventDeliveries } from '@metorial/state';
import { RenderDate, Text } from '@metorial/ui';
import { useMemo, type ComponentProps } from 'react';
import { Link } from 'react-router-dom';
import { useInstanceContext } from '../../lib/dataList';
import { defineEntityFilter, useEntityList } from '../entityFilters';
import {
  EVENT_DELIVERY_STATUS_LABELS,
  EventDeliveryStatus,
  getEventDeliveryStatusColor,
  getEventDeliveryStatusLabel
} from './shared';

export type EventDeliveriesFilters = Omit<
  DashboardOrganizationsEventDeliveriesListQuery,
  'limit' | 'after' | 'before' | 'cursor'
>;

export let eventDeliveryStatus = defineStatus(
  Object.fromEntries(
    (Object.keys(EVENT_DELIVERY_STATUS_LABELS) as EventDeliveryStatus[]).map(status => [
      status,
      {
        label: getEventDeliveryStatusLabel(status),
        color: getEventDeliveryStatusColor(status)
      }
    ])
  ) as Record<EventDeliveryStatus, StatusDefinition>
);

let instanceEntityFilter = (organizationId: string) =>
  defineEntityFilter({
    id: 'instanceId',
    label: 'Instance',
    noun: 'instances',
    mode: 'recent',
    useList: q => {
      let list = useEntityList(instancesLoader.use(q ? { organizationId } : null), item => ({
        id: item.id,
        label: item.name,
        description: item.project.name,
        slug: item.slug
      }));

      let ids = q?.ids;
      let items = useMemo(
        () => (ids ? list.items.filter(item => ids.includes(item.id)) : list.items),
        [list.items, ids]
      );

      return { items, isLoading: list.isLoading };
    }
  })();

let EventDeliveriesList = createDataList<{
  organizationId: string;
  eventDestinationId: string;
  filters?: EventDeliveriesFilters;
}>('event-deliveries')
  .context(useInstanceContext)
  .filters(props => ({
    status: f.status(eventDeliveryStatus, { description: 'Filter by status' }),
    eventType: f.string('eventType', 'Event Type'),
    instanceId: f.entity(instanceEntityFilter(props.organizationId))
  }))
  .paginated(({ props, ctx, filters }) =>
    useEventDeliveries(
      props.organizationId,
      withDefaults(props.filters, {
        order: 'desc' as const,
        ...filters,
        instanceId: filters.instanceId ?? props.filters?.instanceId ?? ctx.instanceId,
        eventDestinationId: props.eventDestinationId
      })
    )
  )
  .columns([
    col.text({
      id: 'eventType',
      header: 'Event',
      weight: 'strong',
      get: row => row.eventType
    }),
    col.status(eventDeliveryStatus),
    col.text({ id: 'attemptCount', header: 'Attempts', get: row => row.attemptCount }),
    col.custom({
      id: 'activity',
      header: 'Last Activity',
      render: row => <RenderDate date={row.lastAttemptAt ?? row.createdAt} />
    }),
    col.date('nextAttemptAt', { header: 'Next Attempt', isDefault: false }),
    col.date('completedAt', { header: 'Completed', isDefault: false }),
    col.refId('eventId', row => row.eventId, { header: 'Event ID', isDefault: true }),
    col.refId('instanceId', row => row.instanceId, { header: 'Instance ID' }),
    col.id({ header: 'Delivery ID' })
  ])
  .link((row, _props, ctx) =>
    Paths.instance.eventDelivery(ctx.organization, ctx.project, ctx.instance, row.id)
  )
  .build();

export let EventDeliveriesTable = (props: ComponentProps<typeof EventDeliveriesList>) => (
  <EventDeliveriesList
    emptyState={{
      initial: 'No deliveries recorded for this destination yet.',
      filtered: 'No deliveries match your filters.'
    }}
    {...props}
  />
);

type RecentDeliveriesProps = {
  deliveries: EventDeliveryPreview[];
  destinationUrls?: Map<string, string>;
};

let createRecentDeliveriesList = (name: string, showDestination: boolean) =>
  createDataList<RecentDeliveriesProps>(name, { customizable: false })
    .context(useInstanceContext)
    .items(({ props }) => ({ items: props.deliveries }))
    .columns([
      ...(showDestination
        ? [
            col.custom<EventDeliveryPreview, RecentDeliveriesProps>({
              id: 'destination',
              header: 'Destination',
              render: (row, props) => (
                <Text size="2">
                  {props.destinationUrls?.get(row.eventDestinationId) ??
                    'Endpoint unavailable'}
                </Text>
              )
            })
          ]
        : []),
      col.custom<
        EventDeliveryPreview,
        RecentDeliveriesProps,
        ReturnType<typeof useInstanceContext>
      >({
        id: 'event',
        header: 'Event',
        render: (row, _props, ctx) => (
          <Link
            to={Paths.instance.event(ctx.organization, ctx.project, ctx.instance, row.eventId)}
          >
            <Text size="2" weight="strong">
              {row.eventType}
            </Text>
          </Link>
        )
      }),
      col.status(eventDeliveryStatus),
      col.createdAt({ header: 'Recorded' })
    ])
    .link((row, _props, ctx) =>
      Paths.instance.eventDelivery(ctx.organization, ctx.project, ctx.instance, row.id)
    )
    .build();

let RecentDeliveriesList = createRecentDeliveriesList('event-deliveries-recent', false);
let RecentDeliveriesWithDestinationList = createRecentDeliveriesList(
  'event-deliveries-recent-destination',
  true
);

export let EventDeliveriesSimpleTable = ({
  deliveries,
  destinationUrls,
  ...rest
}: RecentDeliveriesProps &
  Pick<
    ComponentProps<typeof RecentDeliveriesList>,
    'listVariant' | 'listLimit' | 'viewAllHref'
  >) =>
  destinationUrls ? (
    <RecentDeliveriesWithDestinationList
      listVariant="embedded"
      deliveries={deliveries}
      destinationUrls={destinationUrls}
      {...rest}
    />
  ) : (
    <RecentDeliveriesList listVariant="embedded" deliveries={deliveries} {...rest} />
  );

let DeliveryFailuresList = createDataList<{ deliveries: EventDeliveryPreview[] }>(
  'event-delivery-failures',
  { customizable: false }
)
  .context(useInstanceContext)
  .items(({ props }) => ({ items: props.deliveries }))
  .columns([
    col.text({ id: 'event', header: 'Event', weight: 'strong', get: row => row.eventType }),
    col.status(eventDeliveryStatus),
    col.text({
      id: 'error',
      header: 'Error',
      get: row => row.error?.message ?? row.error?.code
    }),
    col.custom({
      id: 'occurred',
      header: 'Occurred',
      render: row => <RenderDate date={row.lastAttemptAt ?? row.createdAt} />
    })
  ])
  .link((row, _props, ctx) =>
    Paths.instance.eventDelivery(ctx.organization, ctx.project, ctx.instance, row.id)
  )
  .build();

export let EventDeliveryFailuresList = (props: { deliveries: EventDeliveryPreview[] }) => (
  <DeliveryFailuresList listVariant="embedded" deliveries={props.deliveries} />
);
