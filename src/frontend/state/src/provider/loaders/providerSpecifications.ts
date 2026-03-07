import { DashboardInstanceProvidersSpecificationsListQuery } from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export let providerSpecificationsLoader = createLoader({
  name: 'providerSpecifications',
  parents: [],
  fetch: (
    i: { instanceId: string } & DashboardInstanceProvidersSpecificationsListQuery
  ) => withAuth(sdk => sdk.providers.specifications.list(i.instanceId, i)),
  mutators: {}
});

export let useProviderSpecifications = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceProvidersSpecificationsListQuery | null
) => {
  let data = usePaginator(pagination =>
    providerSpecificationsLoader.use(
      instanceId && query !== null ? { ...pagination, ...query, instanceId } : null
    )
  );

  return data;
};

export let providerSpecificationLoader = createLoader({
  name: 'providerSpecification',
  parents: [providerSpecificationsLoader],
  fetch: (i: { instanceId: string; providerSpecificationId: string }) =>
    withAuth(sdk => sdk.providers.specifications.get(i.instanceId, i.providerSpecificationId)),
  mutators: {}
});

export let useProviderSpecification = (
  instanceId: string | null | undefined,
  providerSpecificationId: string | null | undefined
) => {
  let data = providerSpecificationLoader.use(
    instanceId && providerSpecificationId ? { instanceId, providerSpecificationId } : null
  );

  return data;
};
