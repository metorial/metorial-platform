import type {
  DashboardInstanceIntegrationProvidersCreateBody,
  DashboardInstanceIntegrationProvidersListOutput,
  DashboardInstanceIntegrationProvidersListQuery,
  DashboardInstanceIntegrationProvidersUpdateBody
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { autoPaginate } from '../../lib/autoPaginate';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';
import { integrationLoader, integrationsLoader } from './integrations';

export type IntegrationProvider =
  DashboardInstanceIntegrationProvidersListOutput['items'][number];

export let integrationProvidersLoader = createLoader({
  name: 'integrationProviders',
  parents: [integrationsLoader, integrationLoader],
  fetch: (i: { instanceId: string } & DashboardInstanceIntegrationProvidersListQuery) =>
    withAuth(sdk => {
      let { instanceId, ...query } = i;
      return sdk.integration.providers.list(instanceId, query);
    }),
  mutators: {}
});

export let useIntegrationProviders = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceIntegrationProvidersListQuery
) => {
  let data = usePaginator(pagination =>
    integrationProvidersLoader.use(instanceId ? { instanceId, ...pagination, ...query } : null)
  );

  return data;
};

export let allIntegrationProvidersLoader = createLoader({
  name: 'allIntegrationProviders',
  parents: [integrationsLoader, integrationLoader, integrationProvidersLoader],
  fetch: (i: { instanceId: string; integrationId: string }) =>
    withAuth(sdk =>
      autoPaginate(cursor =>
        sdk.integration.providers.list(i.instanceId, {
          ...cursor,
          integrationId: i.integrationId
        })
      )
    ),
  mutators: {}
});

export let useAllIntegrationProviders = (
  instanceId: string | null | undefined,
  integrationId: string | null | undefined
) => {
  return allIntegrationProvidersLoader.use(
    instanceId && integrationId ? { instanceId, integrationId } : null
  );
};

export let useCreateIntegrationProvider = integrationProvidersLoader.createExternalMutator(
  (i: { instanceId: string } & DashboardInstanceIntegrationProvidersCreateBody) =>
    withAuth(sdk => sdk.integration.providers.create(i.instanceId, i)),
  { disableToast: true }
);

export let useUpdateIntegrationProvider = integrationProvidersLoader.createExternalMutator(
  (
    i: {
      instanceId: string;
      integrationProviderId: string;
    } & DashboardInstanceIntegrationProvidersUpdateBody
  ) =>
    withAuth(sdk =>
      sdk.integration.providers.update(i.instanceId, i.integrationProviderId, i)
    ),
  { disableToast: true }
);

export let useDeleteIntegrationProvider = integrationProvidersLoader.createExternalMutator(
  (i: { instanceId: string; integrationProviderId: string }) =>
    withAuth(sdk => sdk.integration.providers.delete(i.instanceId, i.integrationProviderId)),
  { disableToast: true }
);
