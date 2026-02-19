import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceProviderDeploymentsAuthConfigsImportsGetSchemaOutput = {
  object: 'provider_auth_config.import_schema';
  schema: Record<string, any> | null;
};

export let mapManagementInstanceProviderDeploymentsAuthConfigsImportsGetSchemaOutput =
  mtMap.object<ManagementInstanceProviderDeploymentsAuthConfigsImportsGetSchemaOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    schema: mtMap.objectField('schema', mtMap.passthrough())
  });
