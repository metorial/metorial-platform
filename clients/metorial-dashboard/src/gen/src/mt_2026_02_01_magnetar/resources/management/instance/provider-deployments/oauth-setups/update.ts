import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceProviderDeploymentsOauthSetupsUpdateOutput = {
  object: 'provider.oauth_setup';
  id: string;
  status: string | null;
  isEphemeral: boolean;
  providerId: string;
  name: string | null;
  description: string | null;
  metadata: Record<string, any> | null;
  redirectUrl: string | null;
  url: string | null;
  authConfig: {
    id: string;
    status: string | null;
    type: string | null;
    name: string | null;
    description: string | null;
    metadata: Record<string, any> | null;
    providerId: string;
    providerDeploymentId: string | null;
    providerAuthMethodId: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  credentials: {
    id: string;
    type: string | null;
    name: string | null;
    description: string | null;
    metadata: Record<string, any> | null;
    providerId: string;
    clientId: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  authMethod: {
    object: 'provider.auth_method';
    id: string;
    type: 'oauth' | 'token' | 'custom';
    name: string;
    description: string | null;
    inputSchema: Record<string, any> | null;
    scopes:
      | {
          object: 'provider.auth_method.scope';
          id: string;
          scope: string;
          name: string;
          description: string | null;
        }[]
      | null;
    providerId: string;
    providerSpecificationId: string;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  deployment: { id: string; name: string | null; providerId: string } | null;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date | null;
};

export let mapManagementInstanceProviderDeploymentsOauthSetupsUpdateOutput =
  mtMap.object<ManagementInstanceProviderDeploymentsOauthSetupsUpdateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    isEphemeral: mtMap.objectField('is_ephemeral', mtMap.passthrough()),
    providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    redirectUrl: mtMap.objectField('redirect_url', mtMap.passthrough()),
    url: mtMap.objectField('url', mtMap.passthrough()),
    authConfig: mtMap.objectField(
      'auth_config',
      mtMap.object({
        id: mtMap.objectField('id', mtMap.passthrough()),
        status: mtMap.objectField('status', mtMap.passthrough()),
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
      })
    ),
    credentials: mtMap.objectField(
      'credentials',
      mtMap.object({
        id: mtMap.objectField('id', mtMap.passthrough()),
        type: mtMap.objectField('type', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough()),
        description: mtMap.objectField('description', mtMap.passthrough()),
        metadata: mtMap.objectField('metadata', mtMap.passthrough()),
        providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
        clientId: mtMap.objectField('client_id', mtMap.passthrough()),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date())
      })
    ),
    authMethod: mtMap.objectField(
      'auth_method',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        type: mtMap.objectField('type', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough()),
        description: mtMap.objectField('description', mtMap.passthrough()),
        inputSchema: mtMap.objectField('input_schema', mtMap.passthrough()),
        scopes: mtMap.objectField(
          'scopes',
          mtMap.array(
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              scope: mtMap.objectField('scope', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough()),
              description: mtMap.objectField('description', mtMap.passthrough())
            })
          )
        ),
        providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
        providerSpecificationId: mtMap.objectField(
          'provider_specification_id',
          mtMap.passthrough()
        ),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date())
      })
    ),
    deployment: mtMap.objectField(
      'deployment',
      mtMap.object({
        id: mtMap.objectField('id', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough()),
        providerId: mtMap.objectField('provider_id', mtMap.passthrough())
      })
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date()),
    expiresAt: mtMap.objectField('expires_at', mtMap.date())
  });

export type ManagementInstanceProviderDeploymentsOauthSetupsUpdateBody = {
  name?: string | undefined;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
};

export let mapManagementInstanceProviderDeploymentsOauthSetupsUpdateBody =
  mtMap.object<ManagementInstanceProviderDeploymentsOauthSetupsUpdateBody>({
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough())
  });

