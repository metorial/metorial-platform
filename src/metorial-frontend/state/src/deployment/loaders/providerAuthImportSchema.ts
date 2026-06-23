import { DashboardInstanceProviderDeploymentsAuthConfigsImportsGetSchemaQuery } from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { withAuth } from '../../user';

export let providerAuthImportSchemaLoader = createLoader({
  name: 'providerAuthImportSchema',
  parents: [],
  fetch: (
    i: {
      instanceId: string;
    } & DashboardInstanceProviderDeploymentsAuthConfigsImportsGetSchemaQuery
  ) =>
    withAuth(async sdk => {
      return await sdk.providerDeployments.authConfigs.imports.getSchema(i.instanceId, i);
    }),
  mutators: {}
});

export let useProviderAuthImportSchema = (
  instanceId: string | null | undefined,
  opts: DashboardInstanceProviderDeploymentsAuthConfigsImportsGetSchemaQuery | null
) => {
  let data = providerAuthImportSchemaLoader.use(
    instanceId && opts ? { instanceId, ...opts } : null
  );

  return data;
};
