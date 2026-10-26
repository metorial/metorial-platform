import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceWebhookRegistrationsCreateOutput = {
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

export let mapManagementInstanceWebhookRegistrationsCreateOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceWebhookRegistrationsCreateOutput>(
    ['receive_url', ['provider', 0, 8], 'created_at', 'updated_at'],
    1
  );

export type ManagementInstanceWebhookRegistrationsCreateBody = {
  providerId: string;
  providerAuthCredentialsId?: string | undefined;
  name: string;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
};

export let mapManagementInstanceWebhookRegistrationsCreateBody =
  /* @__PURE__ */ mapObject<ManagementInstanceWebhookRegistrationsCreateBody>([
    'provider_id',
    'provider_auth_credentials_id'
  ]);
