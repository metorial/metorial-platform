import { mtMap } from '@metorial/util-resource-mapper';

export type WebhookRegistrationsCreateOutput = {
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

export let mapWebhookRegistrationsCreateOutput =
  mtMap.object<WebhookRegistrationsCreateOutput>({
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
        document: mtMap.objectField('document', mtMap.passthrough())
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

export type WebhookRegistrationsCreateBody = {
  providerId: string;
  name: string;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
};

export let mapWebhookRegistrationsCreateBody =
  mtMap.object<WebhookRegistrationsCreateBody>({
    providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough())
  });

