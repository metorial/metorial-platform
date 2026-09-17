import type {
  DashboardOrganizationsEventDeliveriesListOutput,
  DashboardOrganizationsEventDeliveriesListQuery
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { autoPaginate } from '../../lib/autoPaginate';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export type EventDeliveryPreview =
  DashboardOrganizationsEventDeliveriesListOutput['items'][number];

export let eventDeliveriesLoader = createLoader({
  name: 'eventDeliveries',
  fetch: (i: { organizationId: string } & DashboardOrganizationsEventDeliveriesListQuery) =>
    withAuth(sdk => {
      let { organizationId, ...query } = i;
      return sdk.eventDeliveries.list(organizationId, query);
    }),
  mutators: {}
});

export let useEventDeliveries = (
  organizationId: string | null | undefined,
  query?: DashboardOrganizationsEventDeliveriesListQuery
) =>
  usePaginator(pagination =>
    eventDeliveriesLoader.use(
      organizationId ? { organizationId, ...pagination, ...query } : null
    )
  );

export let allEventDeliveriesLoader = createLoader({
  name: 'allEventDeliveries',
  parents: [eventDeliveriesLoader],
  fetch: (
    i: { organizationId: string } & Omit<
      DashboardOrganizationsEventDeliveriesListQuery,
      'limit'
    >
  ) =>
    withAuth(sdk => {
      let { organizationId, ...query } = i;
      return autoPaginate(cursor =>
        sdk.eventDeliveries.list(organizationId, { ...query, ...cursor })
      );
    }),
  mutators: {}
});

export let useAllEventDeliveries = (
  organizationId: string | null | undefined,
  query?: Omit<DashboardOrganizationsEventDeliveriesListQuery, 'limit'>
) => allEventDeliveriesLoader.use(organizationId ? { organizationId, ...query } : null);

export let eventDeliveryLoader = createLoader({
  name: 'eventDelivery',
  parents: [eventDeliveriesLoader, allEventDeliveriesLoader],
  fetch: (i: { organizationId: string; eventDeliveryId: string }) =>
    withAuth(sdk => sdk.eventDeliveries.get(i.organizationId, i.eventDeliveryId)),
  mutators: {
    retry: (_: {}, { input: { organizationId, eventDeliveryId } }) =>
      withAuth(sdk => sdk.eventDeliveries.retry(organizationId, eventDeliveryId))
  }
});

export let useEventDelivery = (
  organizationId: string | null | undefined,
  eventDeliveryId: string | null | undefined
) => {
  let data = eventDeliveryLoader.use(
    organizationId && eventDeliveryId ? { organizationId, eventDeliveryId } : null
  );

  return {
    ...data,
    useRetryMutator: data.useMutator('retry')
  };
};

export let eventDeliveryAttemptLoader = createLoader({
  name: 'eventDeliveryAttempt',
  parents: [eventDeliveryLoader],
  fetch: (i: { organizationId: string; eventDeliveryAttemptId: string }) =>
    withAuth(sdk => sdk.eventDeliveryAttempts.get(i.organizationId, i.eventDeliveryAttemptId)),
  mutators: {}
});

export let useEventDeliveryAttempt = (
  organizationId: string | null | undefined,
  eventDeliveryAttemptId: string | null | undefined
) =>
  eventDeliveryAttemptLoader.use(
    organizationId && eventDeliveryAttemptId
      ? { organizationId, eventDeliveryAttemptId }
      : null
  );
