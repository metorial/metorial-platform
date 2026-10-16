import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceProviderDeploymentsAuthConfigsImportsGetSchemaOutput =
  {
    object: 'provider.capabilities.auth_config.schema';
    schema: { type: 'json_schema'; schema: Record<string, any> } | null;
    visibility: 'encrypted';
    specificationId: string;
    providerId: string;
    createdAt: Date;
    updatedAt: Date;
  };

export let mapManagementInstanceProviderDeploymentsAuthConfigsImportsGetSchemaOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceProviderDeploymentsAuthConfigsImportsGetSchemaOutput>(
    ['specification_id', 'provider_id', 'created_at', 'updated_at'],
    1
  );

export type ManagementInstanceProviderDeploymentsAuthConfigsImportsGetSchemaQuery =
  {
    providerId?: string | undefined;
    providerDeploymentId?: string | undefined;
    providerAuthConfigId?: string | undefined;
    providerAuthMethodId?: string | undefined;
  };

export let mapManagementInstanceProviderDeploymentsAuthConfigsImportsGetSchemaQuery =
  /* @__PURE__ */ mapObject<ManagementInstanceProviderDeploymentsAuthConfigsImportsGetSchemaQuery>(
    [
      'provider_id',
      'provider_deployment_id',
      'provider_auth_config_id',
      'provider_auth_method_id'
    ]
  );
