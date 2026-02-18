import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceProviderDeploymentsConfigsUpdateOutput = {
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

export let mapDashboardInstanceProviderDeploymentsConfigsUpdateOutput =
  mtMap.object<DashboardInstanceProviderDeploymentsConfigsUpdateOutput>({
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

export type DashboardInstanceProviderDeploymentsConfigsUpdateBody = {
  name?: string | undefined;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
};

export let mapDashboardInstanceProviderDeploymentsConfigsUpdateBody =
  mtMap.object<DashboardInstanceProviderDeploymentsConfigsUpdateBody>({
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough())
  });

