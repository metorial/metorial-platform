import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceProviderDeploymentsSetupSessionsDeleteOutput = {
  object: 'provider.setup_session';
  id: string;
  type: 'oauth';
  status: string;
  name: string | null;
  description: string | null;
  metadata: Record<string, any> | null;
  providerId: string;
  providerDeploymentId: string | null;
  providerAuthMethodId: string;
  redirectUrl: string | null;
  url: string | null;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date | null;
  authConfig: {
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
  } | null;
};

export let mapManagementInstanceProviderDeploymentsSetupSessionsDeleteOutput =
  mtMap.object<ManagementInstanceProviderDeploymentsSetupSessionsDeleteOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    type: mtMap.objectField('type', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
    providerDeploymentId: mtMap.objectField('provider_deployment_id', mtMap.passthrough()),
    providerAuthMethodId: mtMap.objectField('provider_auth_method_id', mtMap.passthrough()),
    redirectUrl: mtMap.objectField('redirect_url', mtMap.passthrough()),
    url: mtMap.objectField('url', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date()),
    expiresAt: mtMap.objectField('expires_at', mtMap.date()),
    authConfig: mtMap.objectField(
      'auth_config',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        type: mtMap.objectField('type', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough()),
        description: mtMap.objectField('description', mtMap.passthrough()),
        metadata: mtMap.objectField('metadata', mtMap.passthrough()),
        providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
        providerDeploymentId: mtMap.objectField('provider_deployment_id', mtMap.passthrough()),
        providerAuthMethodId: mtMap.objectField(
          'provider_auth_method_id',
          mtMap.passthrough()
        ),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date())
      })
    )
  });
