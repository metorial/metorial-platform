import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceProviderDeploymentsAuthConfigsCreateOutput = {
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

export let mapDashboardInstanceProviderDeploymentsAuthConfigsCreateOutput =
  mtMap.object<DashboardInstanceProviderDeploymentsAuthConfigsCreateOutput>({
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

export type DashboardInstanceProviderDeploymentsAuthConfigsCreateBody = {
  name: string;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
  providerAuthMethodId: string;
  credentials:
    | { type: 'reference'; providerAuthCredentialsId: string }
    | { type: 'new'; data: Record<string, any> };
};

export let mapDashboardInstanceProviderDeploymentsAuthConfigsCreateBody =
  mtMap.object<DashboardInstanceProviderDeploymentsAuthConfigsCreateBody>({
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    providerAuthMethodId: mtMap.objectField(
      'provider_auth_method_id',
      mtMap.passthrough()
    ),
    credentials: mtMap.objectField(
      'credentials',
      mtMap.union([
        mtMap.unionOption(
          'object',
          mtMap.object({
            type: mtMap.objectField('type', mtMap.passthrough()),
            providerAuthCredentialsId: mtMap.objectField(
              'provider_auth_credentials_id',
              mtMap.passthrough()
            ),
            data: mtMap.objectField('data', mtMap.passthrough())
          })
        )
      ])
    )
  });

