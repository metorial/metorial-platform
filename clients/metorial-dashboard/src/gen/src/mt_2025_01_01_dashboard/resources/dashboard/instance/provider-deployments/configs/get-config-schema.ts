import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceProviderDeploymentsConfigsGetConfigSchemaOutput = {
  object: 'provider.capabilities.config.schema';
  schema: { type: 'json_schema'; schema: Record<string, any> } | null;
  visibility: 'plain' | 'encrypted';
  specificationId: string;
  providerId: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstanceProviderDeploymentsConfigsGetConfigSchemaOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceProviderDeploymentsConfigsGetConfigSchemaOutput>(
    ['specification_id', 'provider_id', 'created_at', 'updated_at'],
    1
  );

export type DashboardInstanceProviderDeploymentsConfigsGetConfigSchemaQuery = {
  providerId?: string | undefined;
  providerConfigId?: string | undefined;
  providerVersionId?: string | undefined;
  providerDeploymentId?: string | undefined;
};

export let mapDashboardInstanceProviderDeploymentsConfigsGetConfigSchemaQuery =
  /* @__PURE__ */ mapObject<DashboardInstanceProviderDeploymentsConfigsGetConfigSchemaQuery>(
    [
      'provider_id',
      'provider_config_id',
      'provider_version_id',
      'provider_deployment_id'
    ]
  );
