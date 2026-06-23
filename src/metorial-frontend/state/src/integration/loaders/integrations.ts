import type {
  DashboardInstanceIntegrationsCreateBody,
  DashboardInstanceIntegrationsListOutput,
  DashboardInstanceIntegrationsListQuery,
  DashboardInstanceIntegrationsUpdateBody
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';

export type IntegrationPreview = DashboardInstanceIntegrationsListOutput['items'][number];
export type IntegrationCreateBody = DashboardInstanceIntegrationsCreateBody;

export let integrationsLoader = createLoader({
  name: 'integrations',
  parents: [],
  fetch: (i: { instanceId: string } & DashboardInstanceIntegrationsListQuery) =>
    withAuth(sdk => {
      let { instanceId, ...query } = i;
      return sdk.integration.list(instanceId, query);
    }),
  mutators: {}
});

export let useIntegrations = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceIntegrationsListQuery
) => {
  let data = usePaginator(pagination =>
    integrationsLoader.use(instanceId ? { instanceId, ...pagination, ...query } : null)
  );

  return data;
};

export let useCreateIntegration = integrationsLoader.createExternalMutator(
  (i: { instanceId: string } & DashboardInstanceIntegrationsCreateBody) =>
    withAuth(sdk => sdk.integration.create(i.instanceId, i)),
  { disableToast: true }
);

export let useDeleteIntegration = integrationsLoader.createExternalMutator(
  (i: { instanceId: string; integrationId: string }) =>
    withAuth(sdk => sdk.integration.delete(i.instanceId, i.integrationId))
);

export let integrationLoader = createLoader({
  name: 'integration',
  parents: [integrationsLoader],
  fetch: (i: { instanceId: string; integrationId: string }) =>
    withAuth(sdk => sdk.integration.get(i.instanceId, i.integrationId)),
  mutators: {
    update: (
      body: DashboardInstanceIntegrationsUpdateBody,
      { input: { instanceId, integrationId } }
    ) => withAuth(sdk => sdk.integration.update(instanceId, integrationId, body)),
    delete: (_, { input: { instanceId, integrationId } }) =>
      withAuth(sdk => sdk.integration.delete(instanceId, integrationId))
  }
});

export let useIntegration = (
  instanceId: string | null | undefined,
  integrationId: string | null | undefined
) => {
  let data = integrationLoader.use(
    instanceId && integrationId ? { instanceId, integrationId } : null
  );

  return {
    ...data,
    useUpdateMutator: data.useMutator('update'),
    useDeleteMutator: data.useMutator('delete')
  };
};
