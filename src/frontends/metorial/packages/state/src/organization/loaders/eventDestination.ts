import type {
  DashboardOrganizationsEventDestinationsCreateBody,
  DashboardOrganizationsEventDestinationsListOutput,
  DashboardOrganizationsEventDestinationsListQuery,
  DashboardOrganizationsEventDestinationsUpdateBody
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { autoPaginate } from '../../lib/autoPaginate';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export type EventDestinationPreview =
  DashboardOrganizationsEventDestinationsListOutput['items'][number];

export let eventDestinationsLoader = createLoader({
  name: 'eventDestinations',
  fetch: (i: { organizationId: string } & DashboardOrganizationsEventDestinationsListQuery) =>
    withAuth(sdk => {
      let { organizationId, ...query } = i;
      return sdk.eventDestinations.list(organizationId, query);
    }),
  mutators: {
    create: (
      body: DashboardOrganizationsEventDestinationsCreateBody,
      { input: { organizationId } }
    ) => withAuth(sdk => sdk.eventDestinations.create(organizationId, body))
  }
});

export let useEventDestinations = (
  organizationId: string | null | undefined,
  query?: DashboardOrganizationsEventDestinationsListQuery
) => {
  let data = usePaginator(pagination =>
    eventDestinationsLoader.use(
      organizationId ? { organizationId, ...pagination, ...query } : null
    )
  );

  return {
    ...data,
    useCreateMutator: data.useMutator('create')
  };
};

export let allEventDestinationsLoader = createLoader({
  name: 'allEventDestinations',
  parents: [eventDestinationsLoader],
  fetch: (
    i: { organizationId: string } & Omit<
      DashboardOrganizationsEventDestinationsListQuery,
      'limit'
    >
  ) =>
    withAuth(sdk => {
      let { organizationId, ...query } = i;
      return autoPaginate(cursor =>
        sdk.eventDestinations.list(organizationId, { ...query, ...cursor })
      );
    }),
  mutators: {}
});

export let useAllEventDestinations = (
  organizationId: string | null | undefined,
  query?: Omit<DashboardOrganizationsEventDestinationsListQuery, 'limit'>
) => allEventDestinationsLoader.use(organizationId ? { organizationId, ...query } : null);

export let eventDestinationLoader = createLoader({
  name: 'eventDestination',
  parents: [eventDestinationsLoader],
  fetch: (i: { organizationId: string; eventDestinationId: string }) =>
    withAuth(sdk => sdk.eventDestinations.get(i.organizationId, i.eventDestinationId)),
  mutators: {
    update: (
      body: DashboardOrganizationsEventDestinationsUpdateBody,
      { input: { organizationId, eventDestinationId } }
    ) =>
      withAuth(sdk => sdk.eventDestinations.update(organizationId, eventDestinationId, body)),
    archive: (_: {}, { input: { organizationId, eventDestinationId } }) =>
      withAuth(sdk => sdk.eventDestinations.archive(organizationId, eventDestinationId)),
    rotateWebhookSecret: (_: {}, { input: { organizationId, eventDestinationId } }) =>
      withAuth(sdk =>
        sdk.eventDestinations.rotateWebhookSecret(organizationId, eventDestinationId)
      )
  }
});

export let useEventDestination = (
  organizationId: string | null | undefined,
  eventDestinationId: string | null | undefined
) => {
  let data = eventDestinationLoader.use(
    organizationId && eventDestinationId ? { organizationId, eventDestinationId } : null
  );

  return {
    ...data,
    useUpdateMutator: data.useMutator('update'),
    useArchiveMutator: data.useMutator('archive'),
    useRotateWebhookSecretMutator: data.useMutator('rotateWebhookSecret')
  };
};

export let useCreateEventDestination = eventDestinationsLoader.createExternalMutator(
  (i: { organizationId: string } & DashboardOrganizationsEventDestinationsCreateBody) =>
    withAuth(sdk => sdk.eventDestinations.create(i.organizationId, i)),
  { disableToast: true }
);
