import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceWebhookRegistrationsUpdateOutput = {
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

export let mapManagementInstanceWebhookRegistrationsUpdateOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceWebhookRegistrationsUpdateOutput>(
    ['receive_url', ['provider', 0, 8], 'created_at', 'updated_at'],
    1
  );

export type ManagementInstanceWebhookRegistrationsUpdateBody = {
  name?: string | undefined;
  description?: string | null | undefined;
  metadata?: Record<string, any> | null | undefined;
};

export let mapManagementInstanceWebhookRegistrationsUpdateBody =
  /* @__PURE__ */ createMapper<ManagementInstanceWebhookRegistrationsUpdateBody>(
    0
  );
