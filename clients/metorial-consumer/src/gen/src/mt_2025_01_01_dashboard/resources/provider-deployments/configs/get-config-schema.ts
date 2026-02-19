import { mtMap } from '@metorial/util-resource-mapper';

export type ProviderDeploymentsConfigsGetConfigSchemaOutput = {
  object: 'provider_deployment.config_schema';
  schema: Record<string, any> | null;
};

export let mapProviderDeploymentsConfigsGetConfigSchemaOutput =
  mtMap.object<ProviderDeploymentsConfigsGetConfigSchemaOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    schema: mtMap.objectField('schema', mtMap.passthrough())
  });
