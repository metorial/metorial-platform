import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceChatConnectionsCreateOutput = {
  object: 'chat.connection';
  id: string;
  status: 'active' | 'archived' | 'deleted';
  slug: string;
  name: string;
  description: string | null;
  metadata: Record<string, any>;
  providers: {
    object: 'chat.connection_provider';
    id: string;
    status: 'active' | 'archived' | 'deleted';
    provider: {
      object: 'provider#preview';
      id: string;
      name: string;
      description: string | null;
      slug: string;
      createdAt: Date;
      updatedAt: Date;
    };
    deployment: {
      object: 'provider.deployment#preview';
      id: string;
      isDefault: boolean;
      name: string | null;
      description: string | null;
      metadata: Record<string, any> | null;
      providerId: string;
      createdAt: Date;
      updatedAt: Date;
    } | null;
    config: {
      object: 'provider.config#preview';
      id: string;
      isDefault: boolean;
      name: string | null;
      description: string | null;
      metadata: Record<string, any> | null;
      providerId: string;
      createdAt: Date;
      updatedAt: Date;
    } | null;
    authMethodId: string | null;
    authCredentialsId: string | null;
    name: string;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstanceChatConnectionsCreateOutput =
  mtMap.object<ManagementInstanceChatConnectionsCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    slug: mtMap.objectField('slug', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    providers: mtMap.objectField(
      'providers',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
          provider: mtMap.objectField(
            'provider',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough()),
              description: mtMap.objectField(
                'description',
                mtMap.passthrough()
              ),
              slug: mtMap.objectField('slug', mtMap.passthrough()),
              createdAt: mtMap.objectField('created_at', mtMap.date()),
              updatedAt: mtMap.objectField('updated_at', mtMap.date())
            })
          ),
          deployment: mtMap.objectField(
            'deployment',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              isDefault: mtMap.objectField('is_default', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough()),
              description: mtMap.objectField(
                'description',
                mtMap.passthrough()
              ),
              metadata: mtMap.objectField('metadata', mtMap.passthrough()),
              providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
              createdAt: mtMap.objectField('created_at', mtMap.date()),
              updatedAt: mtMap.objectField('updated_at', mtMap.date())
            })
          ),
          config: mtMap.objectField(
            'config',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              isDefault: mtMap.objectField('is_default', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough()),
              description: mtMap.objectField(
                'description',
                mtMap.passthrough()
              ),
              metadata: mtMap.objectField('metadata', mtMap.passthrough()),
              providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
              createdAt: mtMap.objectField('created_at', mtMap.date()),
              updatedAt: mtMap.objectField('updated_at', mtMap.date())
            })
          ),
          authMethodId: mtMap.objectField(
            'auth_method_id',
            mtMap.passthrough()
          ),
          authCredentialsId: mtMap.objectField(
            'auth_credentials_id',
            mtMap.passthrough()
          ),
          name: mtMap.objectField('name', mtMap.passthrough()),
          description: mtMap.objectField('description', mtMap.passthrough()),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          updatedAt: mtMap.objectField('updated_at', mtMap.date())
        })
      )
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type ManagementInstanceChatConnectionsCreateBody = {
  name: string;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
  privateMetadata?: Record<string, any> | undefined;
  provider: {
    providerId: string;
    providerDeploymentId?: string | undefined;
    providerAuthMethodId?: string | null | undefined;
    providerAuthCredentialsId?: string | null | undefined;
    providerConfigId?: string | null | undefined;
    name?: string | undefined;
    description?: string | undefined;
    metadata?: Record<string, any> | undefined;
  };
};

export let mapManagementInstanceChatConnectionsCreateBody =
  mtMap.object<ManagementInstanceChatConnectionsCreateBody>({
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    privateMetadata: mtMap.objectField('private_metadata', mtMap.passthrough()),
    provider: mtMap.objectField(
      'provider',
      mtMap.object({
        providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
        providerDeploymentId: mtMap.objectField(
          'provider_deployment_id',
          mtMap.passthrough()
        ),
        providerAuthMethodId: mtMap.objectField(
          'provider_auth_method_id',
          mtMap.passthrough()
        ),
        providerAuthCredentialsId: mtMap.objectField(
          'provider_auth_credentials_id',
          mtMap.passthrough()
        ),
        providerConfigId: mtMap.objectField(
          'provider_config_id',
          mtMap.passthrough()
        ),
        name: mtMap.objectField('name', mtMap.passthrough()),
        description: mtMap.objectField('description', mtMap.passthrough()),
        metadata: mtMap.objectField('metadata', mtMap.passthrough())
      })
    )
  });

