import type { DashboardOrganizationsEventsListQuery } from '@metorial/dashboard-sdk';
import {
  col,
  createDataList,
  defineStatus,
  f,
  withDefaults,
  type TableFilterEntityOptions
} from '@metorial/data-list';
import { Paths } from '@metorial/frontend-config';
import {
  useEventTypes,
  useEvents,
  useProviderTriggers,
  useProvidersByIds
} from '@metorial/state';
import { useMemo, type ComponentProps } from 'react';
import { useInstanceContext } from '../../lib/dataList';
import { entityFilters } from '../entityFilters';
import { CHAT_EVENT_CATALOG, sentenceCase } from './listenerEditor';

export type EventsFilters = Omit<
  DashboardOrganizationsEventsListQuery,
  'limit' | 'after' | 'before' | 'cursor'
>;

let eventSource = defineStatus({
  callback: { label: 'Callback', color: 'blue' },
  resource: { label: 'Resource', color: 'gray' },
  chat: { label: 'Chat', color: 'gray' },
  ping: { label: 'Ping', color: 'gray' }
});

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
      description:
        triggerProviderNames.get(trigger.providerId) ?? trigger.description ?? undefined
    }));

    let chatItems = CHAT_EVENT_CATALOG.map(event => ({
      id: event.id,
      label: `Chat · ${event.label}`,
      description: event.description ?? undefined
    }));

    return [...resourceItems, ...triggerItems, ...chatItems, { id: 'ping', label: 'Ping' }];
  }, [eventTypes.data?.items, providerTriggers.data?.items, triggerProviderNames]);

  let isLoading = eventTypes.isLoading || providerTriggers.isLoading;

  return {
    items,
    isLoading,
    empty: 'No matching events found.'
  } satisfies TableFilterEntityOptions;
};

let EventsList = createDataList<{
  organizationId: string;
  filters?: EventsFilters;
}>('events')
  .context(useInstanceContext)
  .filters((props, ctx) => {
    let instanceId = ctx.instanceId;

    return {
      source: f.status(eventSource, {
        id: 'source',
        label: 'Source',
        description: 'Filter by source',
        pinned: true
      }),
      eventType: f.entity({
        id: 'eventType',
        fields: ['eventType'],
        label: 'Event',
        description: 'Filter by event name',
        type: 'entity',
        pinned: true,
        remoteSearch: false,
        searchPlaceholder: 'Search events…',
        useOptions: () => useEventNameFilterOptions(props.organizationId, instanceId)
      }),
      callbackId: f.entity(entityFilters.callback(instanceId, { pinned: true })),
      chatConnectionId: f.entity(entityFilters.chatConnection(instanceId, { pinned: true })),
      providerId: f.entity(entityFilters.provider(instanceId, { pinned: true })),
      createdAt: f.createdAt({ pinned: true })
    };
  })
  .paginated(({ props, ctx, filters }) =>
    useEvents(
      props.organizationId,
      withDefaults(props.filters, {
        order: 'desc' as const,
        instanceId: props.filters?.instanceId ?? ctx.instanceId,
        ...filters
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
    col.status(eventSource, { id: 'source', header: 'Source', get: row => row.source }),
    col.refId('callbackId', row => row.callbackId, { header: 'Callback', copy: false }),
    col.refId('chatConnectionId', row => row.chatConnectionId, {
      header: 'Chat Connection',
      copy: false
    }),
    col.refId('providerId', row => row.providerId, { header: 'Provider', copy: false }),
    col.refId('instanceId', row => row.instanceId, { header: 'Instance', copy: false }),
    col.createdAt({ header: 'Recorded' }),
    col.id({ header: 'Event ID', isDefault: true })
  ])
  .link((row, _props, ctx) =>
    Paths.instance.event(ctx.organization, ctx.project, ctx.instance, row.id)
  )
  .build();

export let EventsTable = (props: ComponentProps<typeof EventsList>) => (
  <EventsList
    emptyState={{
      initial: 'No events recorded yet.',
      filtered: 'No events match your filters.'
    }}
    {...props}
  />
);
