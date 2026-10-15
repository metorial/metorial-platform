import { createMapper } from '@metorial/util-resource-mapper/compact';

export type WebhookRegistrationsListOutput = {
  items: {
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
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapWebhookRegistrationsListOutput =
  /* @__PURE__ */ createMapper<WebhookRegistrationsListOutput>(
    [7, [1, ['receive_url', ['provider', 0, 8], 'created_at', 'updated_at']]],
    1
  );

export type WebhookRegistrationsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  id?: string | string[] | undefined;
  providerId?: string | string[] | undefined;
  status?:
    | 'awaiting_setup'
    | 'active'
    | 'archived'
    | 'deleted'
    | ('awaiting_setup' | 'active' | 'archived' | 'deleted')[]
    | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
  updatedAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapWebhookRegistrationsListQuery =
  /* @__PURE__ */ createMapper<WebhookRegistrationsListQuery>([
    3,
    [[0, [1, ['provider_id', ['created_at', 1, 5], ['updated_at', 1, 5]]]]]
  ]);
