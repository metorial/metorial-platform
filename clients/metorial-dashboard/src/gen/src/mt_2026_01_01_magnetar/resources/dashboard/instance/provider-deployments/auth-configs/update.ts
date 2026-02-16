import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceProviderDeploymentsAuthConfigsUpdateOutput = {
  object: 'provider.auth_config';
  id: string;
  type: 'manual' | 'oauth_automated' | 'oauth_manual';
  name: string | null;
  description: string | null;
  metadata: Record<string, any> | null;
  providerId: string;
  providerDeploymentId: string | null;
  providerAuthMethodId: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstanceProviderDeploymentsAuthConfigsUpdateOutput =
  mtMap.object<DashboardInstanceProviderDeploymentsAuthConfigsUpdateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    type: mtMap.objectField('type', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
    providerDeploymentId: mtMap.objectField(
      'provider_deployment_id',
      mtMap.passthrough()
    ),
    providerAuthMethodId: mtMap.objectField(
      'provider_auth_method_id',
      mtMap.passthrough()
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type DashboardInstanceProviderDeploymentsAuthConfigsUpdateBody = {
  name?: string | undefined;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
};

export let mapDashboardInstanceProviderDeploymentsAuthConfigsUpdateBody =
  mtMap.object<DashboardInstanceProviderDeploymentsAuthConfigsUpdateBody>({
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough())
  });

