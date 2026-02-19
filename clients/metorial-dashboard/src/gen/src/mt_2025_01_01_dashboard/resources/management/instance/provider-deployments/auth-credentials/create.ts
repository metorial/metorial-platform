import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceProviderDeploymentsAuthCredentialsCreateOutput = {
  object: 'provider.auth_credentials';
  id: string;
  type: 'oauth';
  name: string | null;
  description: string | null;
  metadata: Record<string, any> | null;
  providerId: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstanceProviderDeploymentsAuthCredentialsCreateOutput =
  mtMap.object<ManagementInstanceProviderDeploymentsAuthCredentialsCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    type: mtMap.objectField('type', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type ManagementInstanceProviderDeploymentsAuthCredentialsCreateBody = {
  name: string;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
  config: {
    type: 'oauth';
    clientId: string;
    clientSecret: string;
    scopes: string[];
  };
};

export let mapManagementInstanceProviderDeploymentsAuthCredentialsCreateBody =
  mtMap.object<ManagementInstanceProviderDeploymentsAuthCredentialsCreateBody>({
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    config: mtMap.objectField(
      'config',
      mtMap.object({
        type: mtMap.objectField('type', mtMap.passthrough()),
        clientId: mtMap.objectField('clientId', mtMap.passthrough()),
        clientSecret: mtMap.objectField('clientSecret', mtMap.passthrough()),
        scopes: mtMap.objectField('scopes', mtMap.array(mtMap.passthrough()))
      })
    )
  });
