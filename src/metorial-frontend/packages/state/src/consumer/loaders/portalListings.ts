import type {
  DashboardInstancePortalsListingsListOutput,
  DashboardInstancePortalsListingsListQuery,
  DashboardInstancePortalsListingsUpdateBody,
  DashboardInstanceProviderTemplatesCreateBody,
  DashboardInstanceProviderTemplatesListQuery
} from '@metorial/dashboard-sdk';
import { createLoader, useMutation } from '@metorial/data-hooks';
import { autoPaginate } from '../../lib/autoPaginate';
import { withAuth } from '../../user';
import { allPortalConsumerAccessLoader, portalConsumerAccessLoader } from './portalConsumers';

export type PortalAccessListing = DashboardInstancePortalsListingsListOutput['items'][number];

export let allPortalAccessListingsLoader = createLoader({
  name: 'allPortalAccessListings',
  parents: [],
  fetch: (
    i: {
      instanceId: string;
      portalId: string;
    } & Omit<DashboardInstancePortalsListingsListQuery, 'after' | 'before' | 'cursor'>
  ) =>
    withAuth(sdk =>
      autoPaginate(cursor =>
        sdk.portals.consumerAccessListings.list(i.instanceId, i.portalId, {
          ...i,
          ...cursor,
          limit: i.limit ?? 100
        })
      )
    ),
  mutators: {}
});

export let useAllPortalAccessListings = (
  instanceId: string | null | undefined,
  portalId: string | null | undefined,
  query?: Omit<DashboardInstancePortalsListingsListQuery, 'after' | 'before' | 'cursor'> | null
) =>
  allPortalAccessListingsLoader.use(
    instanceId && portalId && query !== null
      ? { instanceId, portalId, ...(query ?? {}) }
      : null
  );

export let useUpdatePortalAccessListing = () =>
  useMutation(
    (
      i: DashboardInstancePortalsListingsUpdateBody & {
        instanceId: string;
        portalId: string;
        consumerAccessListingId: string;
      }
    ) =>
      withAuth(sdk =>
        sdk.portals.consumerAccessListings.update(
          i.instanceId,
          i.portalId,
          i.consumerAccessListingId,
          i
        )
      ),
    {
      onSuccess: () => {
        allPortalAccessListingsLoader.refetchAll();
        allPortalConsumerAccessLoader.refetchAll();
        portalConsumerAccessLoader.refetchAll();
      }
    }
  );

export let allIntegrationProviderTemplatesLoader = createLoader({
  name: 'allIntegrationProviderTemplates',
  parents: [],
  fetch: (
    i: { instanceId: string } & Omit<
      DashboardInstanceProviderTemplatesListQuery,
      'after' | 'before' | 'cursor'
    >
  ) =>
    withAuth(sdk =>
      autoPaginate(cursor =>
        sdk.providerTemplates.list(i.instanceId, {
          ...i,
          ...cursor,
          limit: i.limit ?? 100
        })
      )
    ),
  mutators: {}
});

export let useAllIntegrationProviderTemplates = (
  instanceId: string | null | undefined,
  query?: Omit<
    DashboardInstanceProviderTemplatesListQuery,
    'after' | 'before' | 'cursor'
  > | null
) =>
  allIntegrationProviderTemplatesLoader.use(
    instanceId && query !== null ? { instanceId, ...(query ?? {}) } : null
  );

export let useCreateIntegrationProviderTemplate =
  allIntegrationProviderTemplatesLoader.createExternalMutator(
    (i: DashboardInstanceProviderTemplatesCreateBody & { instanceId: string }) =>
      withAuth(sdk => sdk.providerTemplates.create(i.instanceId, i)),
    { disableToast: true }
  );
