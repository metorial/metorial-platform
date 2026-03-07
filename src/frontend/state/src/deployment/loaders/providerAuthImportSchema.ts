import {
  DashboardInstanceProviderDeploymentsAuthConfigsImportsGetSchemaOutput,
  DashboardInstanceProviderDeploymentsAuthConfigsImportsGetSchemaQuery
} from '@metorial/dashboard-sdk';
import { createLoader } from '@metorial/data-hooks';
import { isMetorialSDKError } from '@metorial/util-endpoint';
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
      try {
        return await sdk.providerDeployments.authConfigs.imports.getSchema(i.instanceId, {
          providerId: i.providerId,
          providerDeploymentId: i.providerDeploymentId,
          providerAuthConfigId: i.providerAuthConfigId,
          providerAuthMethodId: i.providerAuthMethodId
        });
      } catch (error) {
        if (
          isMetorialSDKError(error) &&
          error.code === 'not_found' &&
          error.response?.entity === 'provider.auth_import'
        ) {
          return null;
        }

        throw error;
      }
    }) as Promise<DashboardInstanceProviderDeploymentsAuthConfigsImportsGetSchemaOutput | null>,
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
