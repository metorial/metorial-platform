import { mtMap } from '@metorial/util-resource-mapper';

export type ProviderDeploymentsAuthConfigsImportsGetSchemaOutput = {
  object: 'provider.capabilities.auth_config.schema';
  schema: { type: 'json_schema'; schema: Record<string, any> } | null;
  visibility: 'encrypted';
  specificationId: string;
  providerId: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapProviderDeploymentsAuthConfigsImportsGetSchemaOutput =
  mtMap.object<ProviderDeploymentsAuthConfigsImportsGetSchemaOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    schema: mtMap.objectField(
      'schema',
      mtMap.object({
        type: mtMap.objectField('type', mtMap.passthrough()),
        schema: mtMap.objectField('schema', mtMap.passthrough())
      })
    ),
    visibility: mtMap.objectField('visibility', mtMap.passthrough()),
    specificationId: mtMap.objectField('specification_id', mtMap.passthrough()),
    providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type ProviderDeploymentsAuthConfigsImportsGetSchemaQuery = {
  providerId?: string | undefined;
  providerDeploymentId?: string | undefined;
  providerAuthConfigId?: string | undefined;
  providerAuthMethodId?: string | undefined;
};

export let mapProviderDeploymentsAuthConfigsImportsGetSchemaQuery =
  mtMap.object<ProviderDeploymentsAuthConfigsImportsGetSchemaQuery>({
    providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
    providerDeploymentId: mtMap.objectField(
      'provider_deployment_id',
      mtMap.passthrough()
    ),
    providerAuthConfigId: mtMap.objectField(
      'provider_auth_config_id',
      mtMap.passthrough()
    ),
    providerAuthMethodId: mtMap.objectField(
      'provider_auth_method_id',
      mtMap.passthrough()
    )
  });

