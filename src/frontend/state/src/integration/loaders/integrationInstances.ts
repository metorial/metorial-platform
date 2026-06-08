import type {
  DashboardInstanceIntegrationsInstancesCreateBody,
  DashboardInstanceIntegrationsInstancesCreateSessionOutput,
  DashboardInstanceIntegrationsInstancesListOutput,
  DashboardInstanceIntegrationsInstancesListQuery,
  DashboardInstanceIntegrationsInstancesUpdateBody
} from '@metorial/dashboard-sdk';
import { createLoader, useMutation } from '@metorial/data-hooks';
import { usePaginator } from '../../lib/usePaginator';
import { withAuth } from '../../user';
import { integrationLoader, integrationsLoader } from './integrations';

export type IntegrationInstance =
  DashboardInstanceIntegrationsInstancesListOutput['items'][number];

export let integrationInstancesLoader = createLoader({
  name: 'integrationInstances',
  parents: [integrationsLoader, integrationLoader],
  fetch: (i: { instanceId: string } & DashboardInstanceIntegrationsInstancesListQuery) =>
    withAuth(sdk => {
      let { instanceId, ...query } = i;
      return sdk.integration.instances.list(instanceId, query);
    }),
  mutators: {}
});

export let useIntegrationInstances = (
  instanceId: string | null | undefined,
  query?: DashboardInstanceIntegrationsInstancesListQuery
) => {
  let data = usePaginator(pagination =>
    integrationInstancesLoader.use(instanceId ? { instanceId, ...pagination, ...query } : null)
  );

  return data;
};

export let useCreateIntegrationInstance = integrationInstancesLoader.createExternalMutator(
  (i: { instanceId: string } & DashboardInstanceIntegrationsInstancesCreateBody) =>
    withAuth(sdk => sdk.integration.instances.create(i.instanceId, i)),
  { disableToast: true }
);

export let useDeleteIntegrationInstance = integrationInstancesLoader.createExternalMutator(
  (i: { instanceId: string; integrationInstanceId: string }) =>
    withAuth(sdk => sdk.integration.instances.delete(i.instanceId, i.integrationInstanceId))
);

export let integrationInstanceLoader = createLoader({
  name: 'integrationInstance',
  parents: [integrationInstancesLoader],
  fetch: (i: { instanceId: string; integrationInstanceId: string }) =>
    withAuth(sdk => sdk.integration.instances.get(i.instanceId, i.integrationInstanceId)),
  mutators: {
    update: (
      body: DashboardInstanceIntegrationsInstancesUpdateBody,
      { input: { instanceId, integrationInstanceId } }
    ) =>
      withAuth(sdk =>
        sdk.integration.instances.update(instanceId, integrationInstanceId, body)
      ),
    delete: (_, { input: { instanceId, integrationInstanceId } }) =>
      withAuth(sdk => sdk.integration.instances.delete(instanceId, integrationInstanceId))
  }
});

export let useIntegrationInstance = (
  instanceId: string | null | undefined,
  integrationInstanceId: string | null | undefined
) => {
  let data = integrationInstanceLoader.use(
    instanceId && integrationInstanceId ? { instanceId, integrationInstanceId } : null
  );

  return {
    ...data,
    useUpdateMutator: data.useMutator('update'),
    useDeleteMutator: data.useMutator('delete')
  };
};

export let useCreateIntegrationInstanceSession = () =>
  useMutation(
    (i: {
      instanceId: string;
      integrationInstanceId: string;
    }): Promise<DashboardInstanceIntegrationsInstancesCreateSessionOutput> =>
      withAuth(sdk =>
        sdk.integration.instances.createSession(i.instanceId, i.integrationInstanceId, {})
      ),
    { disableToast: true }
  );
