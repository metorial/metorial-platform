import { DashboardInstanceProviderDeploymentsConfigsGetConfigSchemaQuery } from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { withAuth } from '../../user';

type ProviderConfigSchemaQuery =
  DashboardInstanceProviderDeploymentsConfigsGetConfigSchemaQuery;

export let providerConfigSchemaLoader = createLoader({
  name: 'providerConfigSchema',
  parents: [],
  fetch: (i: { instanceId: string } & ProviderConfigSchemaQuery) =>
    withAuth(sdk => sdk.providerDeployments.configs.getConfigSchema(i.instanceId, i)),
  mutators: {}
});

export let useProviderConfigSchemaTarget = (
  instanceId: string | null | undefined,
  query?: ProviderConfigSchemaQuery | null
) => {
  let data = providerConfigSchemaLoader.use(
    instanceId && query ? { instanceId, ...query } : null
  );

  return data;
};

export let useProviderDeploymentConfigSchema = (
  instanceId: string | null | undefined,
  providerDeploymentId: string | null | undefined
) => {
  let data = useProviderConfigSchemaTarget(
    instanceId,
    providerDeploymentId ? { providerDeploymentId } : null
  );

  return data;
};
