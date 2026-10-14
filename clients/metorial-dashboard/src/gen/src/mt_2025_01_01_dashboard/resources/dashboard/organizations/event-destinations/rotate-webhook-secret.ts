import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardOrganizationsEventDestinationsRotateWebhookSecretOutput = {
  object: 'event.destination';
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  status: 'active' | 'archived';
  type: 'webhook';
  webhook: { url: string; method: 'POST'; signingSecret: string | null } | null;
  retry: {
    strategy: 'exponential' | 'linear' | 'fixed';
    maxAttempts: number;
    baseDelaySeconds: number;
    maxDelaySeconds: number;
  };
  listeners: {
    object: 'event.destination_listener';
    id: string;
    instanceId: string;
    eventDestinationId: string;
    type: 'event' | 'callback' | 'chat';
    eventTypes: string[] | null;
    callbackId: string | null;
    triggers: string[] | null;
    chatConnectionId: string | null;
    providerId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
};

export let mapDashboardOrganizationsEventDestinationsRotateWebhookSecretOutput =
  /* @__PURE__ */ mapObject<DashboardOrganizationsEventDestinationsRotateWebhookSecretOutput>(
    [
      'organization_id',
      ['webhook', 0, [1, ['signing_secret']]],
      [
        'retry',
        0,
        [1, ['max_attempts', 'base_delay_seconds', 'max_delay_seconds']]
      ],
      [
        'listeners',
        0,
        [
          2,
          [
            1,
            [
              'instance_id',
              'event_destination_id',
              'event_types',
              'callback_id',
              'chat_connection_id',
              'provider_id',
              'created_at',
              'updated_at'
            ]
          ]
        ]
      ],
      'created_at',
      'updated_at',
      'archived_at'
    ],
    1
  );
