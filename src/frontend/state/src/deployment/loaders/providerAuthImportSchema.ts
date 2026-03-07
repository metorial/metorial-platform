import {
  DashboardInstanceProviderDeploymentsAuthConfigsImportsGetSchemaOutput,
  DashboardInstanceProviderDeploymentsAuthConfigsImportsGetSchemaQuery
} from '@metorial/dashboard-sdk';
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
    withAuth(sdk =>
      sdk.providerDeployments.authConfigs.imports.getSchema(i.instanceId, {
        providerId: i.providerId,
        providerDeploymentId: i.providerDeploymentId,
        providerAuthConfigId: i.providerAuthConfigId,
        providerAuthMethodId: i.providerAuthMethodId
      })
    ) as Promise<DashboardInstanceProviderDeploymentsAuthConfigsImportsGetSchemaOutput>,
  mutators: {}
});

export let useProviderAuthImportSchema = (
  instanceId: string | null | undefined,
  opts?: DashboardInstanceProviderDeploymentsAuthConfigsImportsGetSchemaQuery | null
) => {
  let data = providerAuthImportSchemaLoader.use(
    instanceId && opts ? { instanceId, ...opts } : null
  );

  return data;
};
