import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceProviderDeploymentsAuthConfigsImportsGetSchemaOutput =
  {
    object: 'provider_auth_config.import_schema';
    schema: Record<string, any> | null;
  };

export let mapDashboardInstanceProviderDeploymentsAuthConfigsImportsGetSchemaOutput =
  mtMap.object<DashboardInstanceProviderDeploymentsAuthConfigsImportsGetSchemaOutput>(
    {
      object: mtMap.objectField('object', mtMap.passthrough()),
      schema: mtMap.objectField('schema', mtMap.passthrough())
    }
  );

