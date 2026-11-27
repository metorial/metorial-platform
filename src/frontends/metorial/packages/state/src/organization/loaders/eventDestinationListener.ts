import type {
  DashboardOrganizationsEventDestinationListenersCreateBody,
  DashboardOrganizationsEventDestinationListenersListOutput,
  DashboardOrganizationsEventDestinationListenersListQuery,
  DashboardOrganizationsEventDestinationListenersUpdateBody
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { autoPaginate } from '../../lib/autoPaginate';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';
import { eventDestinationLoader, eventDestinationsLoader } from './eventDestination';

export type EventDestinationListenerPreview =
  DashboardOrganizationsEventDestinationListenersListOutput['items'][number];

export let eventDestinationListenersLoader = createLoader({
  name: 'eventDestinationListeners',
  parents: [eventDestinationsLoader, eventDestinationLoader],
  fetch: (
    i: {
      organizationId: string;
    } & DashboardOrganizationsEventDestinationListenersListQuery
  ) =>
    withAuth(sdk => {
      let { organizationId, ...query } = i;
      return sdk.eventDestinations.listeners.list(organizationId, query);
    }),
  mutators: {}
});

export let useEventDestinationListeners = (
  organizationId: string | null | undefined,
  query?: DashboardOrganizationsEventDestinationListenersListQuery
) => {
  return usePaginator(pagination =>
    eventDestinationListenersLoader.use(
      organizationId ? { organizationId, ...pagination, ...query } : null
    )
  );
};

export let allEventDestinationListenersLoader = createLoader({
  name: 'allEventDestinationListeners',
  parents: [eventDestinationsLoader, eventDestinationLoader, eventDestinationListenersLoader],
  fetch: (
    i: { organizationId: string } & Omit<
      DashboardOrganizationsEventDestinationListenersListQuery,
      'limit'
    >
  ) =>
    withAuth(sdk => {
      let { organizationId, ...query } = i;
      return autoPaginate(cursor =>
        sdk.eventDestinations.listeners.list(organizationId, { ...query, ...cursor })
      );
    }),
  mutators: {}
});

export let useAllEventDestinationListeners = (
  organizationId: string | null | undefined,
  query?: Omit<DashboardOrganizationsEventDestinationListenersListQuery, 'limit'>
) =>
  allEventDestinationListenersLoader.use(organizationId ? { organizationId, ...query } : null);

export let useCreateEventDestinationListener =
  eventDestinationListenersLoader.createExternalMutator(
    (
      i: {
        organizationId: string;
      } & DashboardOrganizationsEventDestinationListenersCreateBody
    ) => withAuth(sdk => sdk.eventDestinations.listeners.create(i.organizationId, i)),
    { disableToast: true }
  );

export let useUpdateEventDestinationListener =
  eventDestinationListenersLoader.createExternalMutator(
    (
      i: {
        organizationId: string;
        eventDestinationListenerId: string;
      } & DashboardOrganizationsEventDestinationListenersUpdateBody
    ) =>
      withAuth(sdk =>
        sdk.eventDestinations.listeners.update(
          i.organizationId,
          i.eventDestinationListenerId,
          i
        )
      ),
    { disableToast: true }
  );

export let useDeleteEventDestinationListener =
  eventDestinationListenersLoader.createExternalMutator(
    (i: { organizationId: string; eventDestinationListenerId: string }) =>
      withAuth(sdk =>
        sdk.eventDestinations.listeners.delete(i.organizationId, i.eventDestinationListenerId)
      )
  );
