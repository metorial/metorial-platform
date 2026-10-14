import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceProviderDeploymentsConfigsGetConfigSchemaOutput =
  {
    object: 'provider.capabilities.config.schema';
    schema: { type: 'json_schema'; schema: Record<string, any> } | null;
    visibility: 'plain' | 'encrypted';
    specificationId: string;
    providerId: string;
    createdAt: Date;
    updatedAt: Date;
  };

export let mapManagementInstanceProviderDeploymentsConfigsGetConfigSchemaOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceProviderDeploymentsConfigsGetConfigSchemaOutput>(
    ['specification_id', 'provider_id', 'created_at', 'updated_at'],
    1
  );

export type ManagementInstanceProviderDeploymentsConfigsGetConfigSchemaQuery = {
  providerId?: string | undefined;
  providerConfigId?: string | undefined;
  providerVersionId?: string | undefined;
  providerDeploymentId?: string | undefined;
};

export let mapManagementInstanceProviderDeploymentsConfigsGetConfigSchemaQuery =
  /* @__PURE__ */ mapObject<ManagementInstanceProviderDeploymentsConfigsGetConfigSchemaQuery>(
    [
      'provider_id',
      'provider_config_id',
      'provider_version_id',
      'provider_deployment_id'
    ]
  );
