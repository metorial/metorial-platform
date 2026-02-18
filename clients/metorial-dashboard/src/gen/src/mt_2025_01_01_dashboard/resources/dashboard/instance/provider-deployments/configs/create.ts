import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceProviderDeploymentsConfigsCreateOutput = {
  object: 'provider.config';
  id: string;
  name: string | null;
  description: string | null;
  metadata: Record<string, any> | null;
  providerId: string;
  providerDeploymentId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstanceProviderDeploymentsConfigsCreateOutput =
  mtMap.object<DashboardInstanceProviderDeploymentsConfigsCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
    providerDeploymentId: mtMap.objectField(
      'provider_deployment_id',
      mtMap.passthrough()
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type DashboardInstanceProviderDeploymentsConfigsCreateBody = {
  name: string;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
  config:
    | { type: 'new'; data: Record<string, any> }
    | { type: 'vault'; providerConfigVaultId: string };
};

export let mapDashboardInstanceProviderDeploymentsConfigsCreateBody =
  mtMap.object<DashboardInstanceProviderDeploymentsConfigsCreateBody>({
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    config: mtMap.objectField(
      'config',
      mtMap.union([
        mtMap.unionOption(
          'object',
          mtMap.object({
            type: mtMap.objectField('type', mtMap.passthrough()),
            data: mtMap.objectField('data', mtMap.passthrough()),
            providerConfigVaultId: mtMap.objectField(
              'provider_config_vault_id',
              mtMap.passthrough()
            )
          })
        )
      ])
    )
  });

