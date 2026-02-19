import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceProviderDeploymentsConfigsGetConfigSchemaOutput = {
  object: 'provider_deployment.config_schema';
  schema: Record<string, any> | null;
};

export let mapDashboardInstanceProviderDeploymentsConfigsGetConfigSchemaOutput =
  mtMap.object<DashboardInstanceProviderDeploymentsConfigsGetConfigSchemaOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    schema: mtMap.objectField('schema', mtMap.passthrough())
  });
