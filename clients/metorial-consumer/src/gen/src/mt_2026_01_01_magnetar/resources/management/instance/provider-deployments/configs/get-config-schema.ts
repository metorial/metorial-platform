import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceProviderDeploymentsConfigsGetConfigSchemaOutput =
  {
    object: 'provider_deployment.config_schema';
    schema: Record<string, any> | null;
  };

export let mapManagementInstanceProviderDeploymentsConfigsGetConfigSchemaOutput =
  mtMap.object<ManagementInstanceProviderDeploymentsConfigsGetConfigSchemaOutput>(
    {
      object: mtMap.objectField('object', mtMap.passthrough()),
      schema: mtMap.objectField('schema', mtMap.passthrough())
    }
  );

