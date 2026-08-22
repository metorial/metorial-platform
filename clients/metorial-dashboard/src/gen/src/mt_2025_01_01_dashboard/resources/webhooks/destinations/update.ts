import { mtMap } from '@metorial/util-resource-mapper';

export type WebhooksDestinationsUpdateOutput = {
  object: 'webhook.destination';
  id: string;
  status: 'active' | 'archived' | 'deleted';
  name: string;
  description: string | null;
  metadata: Record<string, any> | null;
  url: string;
  method: 'POST' | 'PUT' | 'PATCH';
  signingSecretConfigured: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export let mapWebhooksDestinationsUpdateOutput =
  mtMap.object<WebhooksDestinationsUpdateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    url: mtMap.objectField('url', mtMap.passthrough()),
    method: mtMap.objectField('method', mtMap.passthrough()),
    signingSecretConfigured: mtMap.objectField(
      'signing_secret_configured',
      mtMap.passthrough()
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type WebhooksDestinationsUpdateBody = {
  name?: string | undefined;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
  url?: string | undefined;
  method?: 'POST' | 'PUT' | 'PATCH' | undefined;
};

export let mapWebhooksDestinationsUpdateBody =
  mtMap.object<WebhooksDestinationsUpdateBody>({
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    url: mtMap.objectField('url', mtMap.passthrough()),
    method: mtMap.objectField('method', mtMap.passthrough())
  });

