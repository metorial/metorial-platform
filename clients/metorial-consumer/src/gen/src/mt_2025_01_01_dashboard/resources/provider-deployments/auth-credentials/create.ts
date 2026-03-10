import { mtMap } from '@metorial/util-resource-mapper';

export type ProviderDeploymentsAuthCredentialsCreateOutput = {
  object: 'provider.auth_credentials';
  id: string;
  type: 'oauth';
  isDefault: boolean;
  name: string | null;
  description: string | null;
  metadata: Record<string, any> | null;
  providerId: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapProviderDeploymentsAuthCredentialsCreateOutput =
  mtMap.object<ProviderDeploymentsAuthCredentialsCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    type: mtMap.objectField('type', mtMap.passthrough()),
    isDefault: mtMap.objectField('is_default', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type ProviderDeploymentsAuthCredentialsCreateBody = {
  providerId: string;
  name?: string | undefined;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
  config: {
    type?: 'oauth' | undefined;
    clientId: string;
    clientSecret: string;
    scopes: string[];
  };
};

export let mapProviderDeploymentsAuthCredentialsCreateBody =
  mtMap.object<ProviderDeploymentsAuthCredentialsCreateBody>({
    providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    config: mtMap.objectField(
      'config',
      mtMap.object({
        type: mtMap.objectField('type', mtMap.passthrough()),
        clientId: mtMap.objectField('client_id', mtMap.passthrough()),
        clientSecret: mtMap.objectField('client_secret', mtMap.passthrough()),
        scopes: mtMap.objectField('scopes', mtMap.array(mtMap.passthrough()))
      })
    )
  });

