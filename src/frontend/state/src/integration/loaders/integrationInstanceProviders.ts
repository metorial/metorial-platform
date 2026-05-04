import type {
  DashboardInstanceIntegrationInstanceProvidersListOutput,
  DashboardInstanceIntegrationInstanceProvidersListQuery,
  DashboardInstanceIntegrationInstanceProvidersSetBody
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';
import {
  integrationInstanceLoader,
  integrationInstancesLoader
} from './integrationInstances';

export type IntegrationInstanceProvider =
  DashboardInstanceIntegrationInstanceProvidersListOutput['items'][number];

export let integrationInstanceProvidersLoader = createLoader({
  name: 'integrationInstanceProviders',
  parents: [integrationInstancesLoader, integrationInstanceLoader],
  fetch: (
    i: { instanceId: string } & DashboardInstanceIntegrationInstanceProvidersListQuery
  ) =>
    withAuth(sdk => {
      let { instanceId, ...query } = i;
      return sdk.integration.instances.providers.list(instanceId, query);
    }),
  mutators: {}
});

export let useIntegrationInstanceProviders = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceIntegrationInstanceProvidersListQuery
) => {
  let data = usePaginator(pagination =>
    integrationInstanceProvidersLoader.use(
      instanceId ? { instanceId, ...pagination, ...query } : null
    )
  );

  return data;
};

export let useSetIntegrationInstanceProvider =
  integrationInstanceProvidersLoader.createExternalMutator(
    (
      i: {
        instanceId: string;
        integrationInstanceId: string;
        providerId: string;
      } & DashboardInstanceIntegrationInstanceProvidersSetBody
    ) =>
      withAuth(sdk =>
        sdk.integration.instances.providers.set(
          i.instanceId,
          i.integrationInstanceId,
          i.providerId,
          i
        )
      ),
    { disableToast: true }
  );

export let useDeleteIntegrationInstanceProvider =
  integrationInstanceProvidersLoader.createExternalMutator(
    (i: { instanceId: string; integrationInstanceProviderId: string }) =>
      withAuth(sdk =>
        sdk.integration.instances.providers.delete(
          i.instanceId,
          i.integrationInstanceProviderId
        )
      ),
    { disableToast: true }
  );
