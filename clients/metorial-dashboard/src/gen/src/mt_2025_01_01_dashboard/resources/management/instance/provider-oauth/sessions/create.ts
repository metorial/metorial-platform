import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceProviderOauthSessionsCreateOutput = {
  object: 'provider_oauth.session';
  id: string;
  status: 'pending' | 'opened' | 'completed' | 'failed';
  url: string;
  connection: {
    object: 'provider_oauth.connection';
    id: string;
    status: 'active' | 'archived';
    name: string;
    description: string | null;
    metadata: Record<string, any>;
    provider: { id: string; name: string; url: string; imageUrl: string };
    config: Record<string, any>;
    scopes: string[];
    clientId: string;
    instanceId: string;
    templateId: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  metadata: Record<string, any>;
  redirectUri: string | null;
  instanceId: string;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstanceProviderOauthSessionsCreateOutput =
  mtMap.object<ManagementInstanceProviderOauthSessionsCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    url: mtMap.objectField('url', mtMap.passthrough()),
    connection: mtMap.objectField(
      'connection',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        status: mtMap.objectField('status', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough()),
        description: mtMap.objectField('description', mtMap.passthrough()),
        metadata: mtMap.objectField('metadata', mtMap.passthrough()),
        provider: mtMap.objectField(
          'provider',
          mtMap.object({
            id: mtMap.objectField('id', mtMap.passthrough()),
            name: mtMap.objectField('name', mtMap.passthrough()),
            url: mtMap.objectField('url', mtMap.passthrough()),
            imageUrl: mtMap.objectField('image_url', mtMap.passthrough())
          })
        ),
        config: mtMap.objectField('config', mtMap.passthrough()),
        scopes: mtMap.objectField('scopes', mtMap.array(mtMap.passthrough())),
        clientId: mtMap.objectField('client_id', mtMap.passthrough()),
        instanceId: mtMap.objectField('instance_id', mtMap.passthrough()),
        templateId: mtMap.objectField('template_id', mtMap.passthrough()),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date())
      })
    ),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    redirectUri: mtMap.objectField('redirect_uri', mtMap.passthrough()),
    instanceId: mtMap.objectField('instance_id', mtMap.passthrough()),
    completedAt: mtMap.objectField('completed_at', mtMap.date()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type ManagementInstanceProviderOauthSessionsCreateBody = {
  metadata?: Record<string, any> | undefined;
  redirectUri?: string | undefined;
} & ({ serverDeploymentId: string } | { connectionId: string });

export let mapManagementInstanceProviderOauthSessionsCreateBody = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      metadata: mtMap.objectField('metadata', mtMap.passthrough()),
      redirectUri: mtMap.objectField('redirect_uri', mtMap.passthrough()),
      serverDeploymentId: mtMap.objectField(
        'server_deployment_id',
        mtMap.passthrough()
      ),
      connectionId: mtMap.objectField('connection_id', mtMap.passthrough())
    })
  )
]);

