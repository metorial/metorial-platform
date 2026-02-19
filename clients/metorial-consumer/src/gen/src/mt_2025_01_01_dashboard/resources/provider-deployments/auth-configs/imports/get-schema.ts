import { mtMap } from '@metorial/util-resource-mapper';

export type ProviderDeploymentsAuthConfigsImportsGetSchemaOutput = {
  object: 'provider_auth_config.import_schema';
  schema: Record<string, any> | null;
};

export let mapProviderDeploymentsAuthConfigsImportsGetSchemaOutput =
  mtMap.object<ProviderDeploymentsAuthConfigsImportsGetSchemaOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    schema: mtMap.objectField('schema', mtMap.passthrough())
  });
