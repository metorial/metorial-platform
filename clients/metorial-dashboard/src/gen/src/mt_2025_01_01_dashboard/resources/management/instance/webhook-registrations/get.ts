import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceWebhookRegistrationsGetOutput = {
  object: 'webhook_registration';
  id: string;
  status: 'awaiting_setup' | 'active' | 'archived' | 'deleted';
  purpose: 'webhook_receiver' | 'delivery_setup';
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
  authCredentialsId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstanceWebhookRegistrationsGetOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceWebhookRegistrationsGetOutput>(
    [
      'receive_url',
      ['provider', 0, 8],
      'auth_credentials_id',
      'created_at',
      'updated_at'
    ],
    1
  );
