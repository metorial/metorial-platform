import type { DashboardOrganizationsEventsListQuery } from '@metorial/dashboard-sdk';
import { Paths } from '@metorial/frontend-config';
import {
  EventPreview,
  callbacksLoader,
  chatConnectionsLoader,
  providersLoader,
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useEventTypes,
  useEvents,
  useProviderTriggers,
  useProvidersByIds
} from '@metorial/state';
import {
  Table as DashboardTable,
  TableFilter,
  TableFilterEntityOptions,
  TableStateProvider,
  TableStateProviderResult,
  getDateRangeFilterValue,
  getEnumListFilterValue,
  getListFilterValue
} from '@metorial/table';
import { Badge, RenderDate, Text } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import { useMemo } from 'react';
import { CHAT_EVENT_CATALOG, sentenceCase } from './listenerEditor';

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
    instanceId: props.instance.data?.id,
    ...props.filters,
    source:
      getEnumListFilterValue(opts.filter.source, ['resource', 'callback', 'chat', 'ping']) ??
      props.filters?.source,
    eventType: getListFilterValue(opts.filter.eventType) ?? props.filters?.eventType,
    callbackId: getListFilterValue(opts.filter.callbackId) ?? props.filters?.callbackId,
    chatConnectionId:
      getListFilterValue(opts.filter.chatConnectionId) ?? props.filters?.chatConnectionId,
    providerId: getListFilterValue(opts.filter.providerId) ?? props.filters?.providerId,
    createdAt: getDateRangeFilterValue(opts.filter.createdAt) ?? props.filters?.createdAt
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

let useEventNameFilterOptions = (
  organizationId: string | null | undefined,
  instanceId: string | null | undefined
) => {
  let eventTypes = useEventTypes(organizationId);
  let providerTriggers = useProviderTriggers(
    instanceId,
    instanceId ? { userManagedCallbacks: true } : null
  );

  let triggerProviderIds = useMemo(() => {
    let ids = [
      ...new Set((providerTriggers.data?.items ?? []).map(trigger => trigger.providerId))
    ];
    return ids.length ? ids : null;
  }, [providerTriggers.data?.items]);
  let triggerProviders = useProvidersByIds(instanceId, triggerProviderIds);
  let triggerProviderNames = useMemo(() => {
    let names = new Map<string, string>();
    for (let provider of triggerProviders.data ?? []) names.set(provider.id, provider.name);
    return names;
  }, [triggerProviders.data]);

  let items = useMemo(() => {
    let resourceItems = (eventTypes.data?.items ?? []).map(eventType => ({
      id: eventType.name,
      label: sentenceCase(eventType.name),
      description: eventType.description ?? undefined
    }));

    let triggerItems = (providerTriggers.data?.items ?? []).map(trigger => ({
      id: `callback.${trigger.key}`,
      label: `Callback · ${trigger.name || sentenceCase(trigger.key)}`,
      description: triggerProviderNames.get(trigger.providerId) ?? trigger.description ?? undefined
    }));

    let chatItems = CHAT_EVENT_CATALOG.map(event => ({
      id: event.id,
      label: `Chat · ${event.label}`,
      description: event.description ?? undefined
    }));

    return [...resourceItems, ...triggerItems, ...chatItems, { id: 'ping', label: 'Ping' }];
  }, [eventTypes.data?.items, providerTriggers.data?.items, triggerProviderNames]);

  let isLoading = eventTypes.isLoading || providerTriggers.isLoading;

  return (): TableFilterEntityOptions => ({
    items,
    isLoading,
    empty: 'No matching events found.'
  });
};

let makeCallbackOptionsProvider =
  (instanceId: string | null | undefined) =>
  ({ search }: { search: string }): TableFilterEntityOptions => {
    let callbacks = callbacksLoader.use(
      instanceId ? { instanceId, search, limit: 50, status: 'active' } : null
    );

    return {
      items: (callbacks.data?.items ?? []).map(item => ({ id: item.id, label: item.name })),
      isLoading: callbacks.isLoading,
      empty: search ? 'No matching callbacks found.' : 'No callbacks available.'
    };
  };

let useCallbackValueLabels = (instanceId: string | null | undefined, ids: string[]) => {
  let uniqueIds = ids.length ? [...new Set(ids)] : null;
  let callbacks = callbacksLoader.use(
    instanceId && uniqueIds ? { instanceId, id: uniqueIds, limit: uniqueIds.length } : null
  );

  return useMemo(() => {
    let labels: Record<string, string> = {};
    for (let item of callbacks.data?.items ?? []) labels[item.id] = item.name;
    return labels;
  }, [callbacks.data]);
};

let makeChatConnectionOptionsProvider =
  (instanceId: string | null | undefined) =>
  ({ search }: { search: string }): TableFilterEntityOptions => {
    let connections = chatConnectionsLoader.use(
      instanceId ? { instanceId, search, limit: 50, status: 'active' } : null
    );

    return {
      items: (connections.data?.items ?? []).map(item => ({ id: item.id, label: item.name })),
      isLoading: connections.isLoading,
      empty: search ? 'No matching chat connections found.' : 'No chat connections available.'
    };
  };

let useChatConnectionValueLabels = (instanceId: string | null | undefined, ids: string[]) => {
  let uniqueIds = ids.length ? [...new Set(ids)] : null;
  let connections = chatConnectionsLoader.use(
    instanceId && uniqueIds ? { instanceId, id: uniqueIds, limit: uniqueIds.length } : null
  );

  return useMemo(() => {
    let labels: Record<string, string> = {};
    for (let item of connections.data?.items ?? []) labels[item.id] = item.name;
    return labels;
  }, [connections.data]);
};

let makeProviderOptionsProvider =
  (instanceId: string | null | undefined) =>
  ({ search }: { search: string }): TableFilterEntityOptions => {
    let providers = providersLoader.use(instanceId ? { instanceId, search, limit: 50 } : null);

    return {
      items: (providers.data?.items ?? []).map(item => ({ id: item.id, label: item.name })),
      isLoading: providers.isLoading,
      empty: search ? 'No matching providers found.' : 'No providers available.'
    };
  };

let useProviderValueLabels = (instanceId: string | null | undefined, ids: string[]) => {
  let providers = useProvidersByIds(instanceId, ids.length ? ids : null);

  return useMemo(() => {
    let labels: Record<string, string> = {};
    for (let item of providers.data ?? []) labels[item.id] = item.name;
    return labels;
  }, [providers.data]);
};

let useEventLogFilters = (
  organizationId: string | null | undefined,
  instanceId: string | null | undefined
): TableFilter<EventPreview>[] => {
  let eventNameOptions = useEventNameFilterOptions(organizationId, instanceId);

  return useMemo<TableFilter<EventPreview>[]>(
    () => [
      {
        id: 'source',
        fields: ['source'],
        label: 'Source',
        description: 'Filter by source',
        type: 'select',
        pinned: true,
        options: [
          { id: 'callback', label: 'Callback' },
          { id: 'resource', label: 'Resource' },
          { id: 'chat', label: 'Chat' },
          { id: 'ping', label: 'Ping' }
        ]
      },
      {
        id: 'eventType',
        fields: ['eventType'],
        label: 'Event',
        description: 'Filter by event name',
        type: 'entity',
        pinned: true,
        remoteSearch: false,
        searchPlaceholder: 'Search events...',
        useOptions: eventNameOptions
      },
      {
        id: 'callbackId',
        fields: ['callbackId'],
        label: 'Callback',
        description: 'Filter by callback',
        type: 'entity',
        pinned: true,
        searchPlaceholder: 'Search callbacks...',
        useOptions: makeCallbackOptionsProvider(instanceId),
        useValueLabels: ids => useCallbackValueLabels(instanceId, ids)
      },
      {
        id: 'chatConnectionId',
        fields: ['chatConnectionId'],
        label: 'Chat Connection',
        description: 'Filter by chat connection',
        type: 'entity',
        pinned: true,
        searchPlaceholder: 'Search chat connections...',
        useOptions: makeChatConnectionOptionsProvider(instanceId),
        useValueLabels: ids => useChatConnectionValueLabels(instanceId, ids)
      },
      {
        id: 'providerId',
        fields: ['providerId'],
        label: 'Provider',
        description: 'Filter by provider',
        type: 'entity',
        pinned: true,
        searchPlaceholder: 'Search providers...',
        useOptions: makeProviderOptionsProvider(instanceId),
        useValueLabels: ids => useProviderValueLabels(instanceId, ids)
      },
      {
        id: 'createdAt',
        fields: ['createdAt'],
        label: 'Created',
        description: 'Filter by created date',
        type: 'date',
        pinned: true
      }
    ],
    [instanceId, eventNameOptions]
  );
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
      isDefault: false,
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
      id: 'chatConnectionId',
      isDefault: false,
      header: 'Chat Connection',
      render: event =>
        event.chatConnectionId ? (
          <ID id={event.chatConnectionId} copy={false} />
        ) : (
          <Text size="2" color="gray600">
            -
          </Text>
        )
    },
    {
      id: 'providerId',
      isDefault: false,
      header: 'Provider',
      render: event =>
        event.providerId ? (
          <ID id={event.providerId} copy={false} />
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
  let tableFilters = useEventLogFilters(organizationId, instance.data?.id);

  return eventsTable({
    organizationId,
    filters,
    instance,
    organization,
    project,
    tableFilters,
    emptyState: emptyState ?? 'No events recorded yet.'
  });
};
