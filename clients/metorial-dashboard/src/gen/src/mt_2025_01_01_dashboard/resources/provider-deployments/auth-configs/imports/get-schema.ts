import { mapObject } from '@metorial/util-resource-mapper/compact';

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
  /* @__PURE__ */ mapObject<ProviderDeploymentsAuthConfigsImportsGetSchemaOutput>(
    ['specification_id', 'provider_id', 'created_at', 'updated_at'],
    1
  );

export type ProviderDeploymentsAuthConfigsImportsGetSchemaQuery = {
  providerId?: string | undefined;
  providerDeploymentId?: string | undefined;
  providerAuthConfigId?: string | undefined;
  providerAuthMethodId?: string | undefined;
};

export let mapProviderDeploymentsAuthConfigsImportsGetSchemaQuery =
  /* @__PURE__ */ mapObject<ProviderDeploymentsAuthConfigsImportsGetSchemaQuery>(
    [
      'provider_id',
      'provider_deployment_id',
      'provider_auth_config_id',
      'provider_auth_method_id'
    ]
  );
