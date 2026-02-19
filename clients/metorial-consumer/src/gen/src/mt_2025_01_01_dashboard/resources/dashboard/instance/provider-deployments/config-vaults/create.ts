import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceProviderDeploymentsConfigVaultsCreateOutput = {
  object: 'provider.config_vault';
  id: string;
  name: string | null;
  description: string | null;
  metadata: Record<string, any> | null;
  providerId: string;
  providerDeploymentId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstanceProviderDeploymentsConfigVaultsCreateOutput =
  mtMap.object<DashboardInstanceProviderDeploymentsConfigVaultsCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
    providerDeploymentId: mtMap.objectField('provider_deployment_id', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type DashboardInstanceProviderDeploymentsConfigVaultsCreateBody = {
  name: string;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
  data: Record<string, any>;
};

export let mapDashboardInstanceProviderDeploymentsConfigVaultsCreateBody =
  mtMap.object<DashboardInstanceProviderDeploymentsConfigVaultsCreateBody>({
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    data: mtMap.objectField('data', mtMap.passthrough())
  });
