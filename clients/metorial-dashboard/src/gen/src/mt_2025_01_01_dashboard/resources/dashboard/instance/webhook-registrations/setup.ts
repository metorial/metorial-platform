import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceWebhookRegistrationsSetupOutput = {
  object: 'webhook_registration';
  id: string;
  status: 'awaiting_setup' | 'active' | 'archived' | 'deleted';
  name: string;
  description: string | null;
  metadata: Record<string, any> | null;
  receiveUrl: string | null;
  setup: {
    object: 'webhook_registration.setup';
    status: 'pending' | 'completed';
    document: string | null;
    schema: { type: 'json_schema'; schema: Record<string, any> } | null;
  };
  provider: {
    object: 'provider#preview';
    id: string;
    name: string;
    description: string | null;
    slug: string;
    createdAt: Date;
    updatedAt: Date;
  };
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstanceWebhookRegistrationsSetupOutput =
  mtMap.object<DashboardInstanceWebhookRegistrationsSetupOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    receiveUrl: mtMap.objectField('receive_url', mtMap.passthrough()),
    setup: mtMap.objectField(
      'setup',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        status: mtMap.objectField('status', mtMap.passthrough()),
        document: mtMap.objectField('document', mtMap.passthrough()),
        schema: mtMap.objectField('schema', mtMap.passthrough())
      })
    ),
    provider: mtMap.objectField(
      'provider',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough()),
        description: mtMap.objectField('description', mtMap.passthrough()),
        slug: mtMap.objectField('slug', mtMap.passthrough()),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date())
      })
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type DashboardInstanceWebhookRegistrationsSetupBody = {
  userConfig: Record<string, any>;
};

export let mapDashboardInstanceWebhookRegistrationsSetupBody =
  mtMap.object<DashboardInstanceWebhookRegistrationsSetupBody>({
    userConfig: mtMap.objectField('user_config', mtMap.passthrough())
  });

