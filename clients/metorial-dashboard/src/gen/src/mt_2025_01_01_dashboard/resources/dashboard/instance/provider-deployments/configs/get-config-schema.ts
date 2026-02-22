import { mtMap } from '@metorial/util-resource-mapper';

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
  mtMap.object<DashboardInstanceProviderDeploymentsConfigsGetConfigSchemaOutput>(
    {
      object: mtMap.objectField('object', mtMap.passthrough()),
      schema: mtMap.objectField(
        'schema',
        mtMap.object({
          type: mtMap.objectField('type', mtMap.passthrough()),
          schema: mtMap.objectField('schema', mtMap.passthrough())
        })
      ),
      visibility: mtMap.objectField('visibility', mtMap.passthrough()),
      specificationId: mtMap.objectField(
        'specification_id',
        mtMap.passthrough()
      ),
      providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
      createdAt: mtMap.objectField('created_at', mtMap.date()),
      updatedAt: mtMap.objectField('updated_at', mtMap.date())
    }
  );

export type DashboardInstanceProviderDeploymentsConfigsGetConfigSchemaQuery = {
  providerId?: string | undefined;
  providerConfigId?: string | undefined;
  providerVersionId?: string | undefined;
  providerDeploymentId?: string | undefined;
};

export let mapDashboardInstanceProviderDeploymentsConfigsGetConfigSchemaQuery =
  mtMap.object<DashboardInstanceProviderDeploymentsConfigsGetConfigSchemaQuery>(
    {
      providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
      providerConfigId: mtMap.objectField(
        'provider_config_id',
        mtMap.passthrough()
      ),
      providerVersionId: mtMap.objectField(
        'provider_version_id',
        mtMap.passthrough()
      ),
      providerDeploymentId: mtMap.objectField(
        'provider_deployment_id',
        mtMap.passthrough()
      )
    }
  );

