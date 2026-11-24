import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceIncomingWebhooksListOutput = {
  items: {
    object: 'incoming_webhook';
    id: string;
    status: string;
    attemptCount: number;
    webhookRegistrationId: string | null;
    providerId: string;
    receivedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceIncomingWebhooksListOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceIncomingWebhooksListOutput>(
    [
      7,
      [
        1,
        [
          'attempt_count',
          'webhook_registration_id',
          'provider_id',
          'received_at'
        ]
      ]
    ],
    1
  );

export type DashboardInstanceIncomingWebhooksListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  webhookRegistrationId?: string | string[] | undefined;
  providerId?: string | string[] | undefined;
  status?:
    | 'pending'
    | 'failed_retrying'
    | 'failed_final'
    | 'succeeded'
    | ('pending' | 'failed_retrying' | 'failed_final' | 'succeeded')[]
    | undefined;
};

export let mapDashboardInstanceIncomingWebhooksListQuery =
  /* @__PURE__ */ createMapper<DashboardInstanceIncomingWebhooksListQuery>([
    3,
    [[0, [1, ['webhook_registration_id', 'provider_id']]]]
  ]);
