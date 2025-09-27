import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceProviderOauthConnectionsCreateOutput = {
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

export let mapManagementInstanceProviderOauthConnectionsCreateOutput =
  mtMap.object<ManagementInstanceProviderOauthConnectionsCreateOutput>({
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
  });

export type ManagementInstanceProviderOauthConnectionsCreateBody = {
  templateId?: string | undefined;
  name?: string | undefined;
  description?: string | undefined;
  discoveryUrl?: string | undefined;
  config: Record<string, any>;
  scopes: string[];
  metadata?: Record<string, any> | undefined;
} & (
  | { clientId: string; clientSecret: string }
  | { autoRegistrationId: string }
);

export let mapManagementInstanceProviderOauthConnectionsCreateBody =
  mtMap.union([
    mtMap.unionOption(
      'object',
      mtMap.object({
        templateId: mtMap.objectField('template_id', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough()),
        description: mtMap.objectField('description', mtMap.passthrough()),
        discoveryUrl: mtMap.objectField('discovery_url', mtMap.passthrough()),
        config: mtMap.objectField('config', mtMap.passthrough()),
        scopes: mtMap.objectField('scopes', mtMap.array(mtMap.passthrough())),
        metadata: mtMap.objectField('metadata', mtMap.passthrough()),
        clientId: mtMap.objectField('client_id', mtMap.passthrough()),
        clientSecret: mtMap.objectField('client_secret', mtMap.passthrough()),
        autoRegistrationId: mtMap.objectField(
          'auto_registration_id',
          mtMap.passthrough()
        )
      })
    )
  ]);

