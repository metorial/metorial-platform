import type {
  DashboardOrganizationsEventsListOutput,
  DashboardOrganizationsEventsListQuery
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export type EventPreview = DashboardOrganizationsEventsListOutput['items'][number];

export let eventsLoader = createLoader({
  name: 'events',
  fetch: (i: { organizationId: string } & DashboardOrganizationsEventsListQuery) =>
    withAuth(sdk => {
      let { organizationId, ...query } = i;
      return sdk.events.list(organizationId, query);
    }),
  mutators: {}
});

export let useEvents = (
  organizationId: string | null | undefined,
  query?: DashboardOrganizationsEventsListQuery
) => {
  return usePaginator(pagination =>
    eventsLoader.use(organizationId ? { organizationId, ...pagination, ...query } : null)
  );
};

export let eventLoader = createLoader({
  name: 'event',
  parents: [eventsLoader],
  fetch: (i: { organizationId: string; eventId: string }) =>
    withAuth(sdk => sdk.events.get(i.organizationId, i.eventId)),
  mutators: {}
});

export let useEvent = (
  organizationId: string | null | undefined,
  eventId: string | null | undefined
) => eventLoader.use(organizationId && eventId ? { organizationId, eventId } : null);

export let eventTypesLoader = createLoader({
  name: 'eventTypes',
  fetch: (i: { organizationId: string }) =>
    withAuth(sdk => sdk.events.types.list(i.organizationId)),
  mutators: {}
});

export let useEventTypes = (organizationId: string | null | undefined) =>
  eventTypesLoader.use(organizationId ? { organizationId } : null);
