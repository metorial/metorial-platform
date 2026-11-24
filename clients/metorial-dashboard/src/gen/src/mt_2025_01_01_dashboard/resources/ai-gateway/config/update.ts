import { mapObject } from '@metorial/util-resource-mapper/compact';

export type AiGatewayConfigUpdateOutput = {
  object: 'ai_gateway.config';
  logRetentionDays: number;
  settings: {
    contentLogging: { enabled: boolean; retentionDays: number };
    metorialProvider: { enabled: boolean };
    fallbacks: { enabled: boolean };
    zeroDataRetention: { required: boolean };
  };
  limits: {
    metric: 'requests' | 'tokens' | 'spend_usd';
    amount: number;
    interval: '1m' | '1h' | '1d' | '1mo';
  }[];
  planLimits: {
    metric: 'requests' | 'tokens' | 'metorial_spend_usd';
    amount: number;
    intervalSeconds: number;
  }[];
  disabled: { reason: string | null; since: Date } | null;
  billingRestriction: { reason: string | null; since: Date } | null;
  updatedAt: Date;
};

export let mapAiGatewayConfigUpdateOutput =
  /* @__PURE__ */ mapObject<AiGatewayConfigUpdateOutput>(
    [
      'log_retention_days',
      [
        'settings',
        0,
        [
          1,
          [
            ['content_logging', 1, [1, ['retention_days']]],
            'metorial_provider',
            'zero_data_retention'
          ]
        ]
      ],
      ['plan_limits', 1, [2, [1, ['interval_seconds']]]],
      ['disabled', 0, [1, [['since', 0, 4]]]],
      ['billing_restriction', 1, [1, [['since', 0, 4]]]],
      'updated_at'
    ],
    1
  );

export type AiGatewayConfigUpdateBody = {
  logRetentionDays?: number | undefined;
  settings?:
    | {
        contentLogging?:
          | {
              enabled?: boolean | undefined;
              retentionDays?: number | undefined;
            }
          | undefined;
        metorialProvider?: { enabled?: boolean | undefined } | undefined;
        fallbacks?: { enabled?: boolean | undefined } | undefined;
        zeroDataRetention?: { required?: boolean | undefined } | undefined;
      }
    | undefined;
  limits?:
    | {
        metric: 'requests' | 'tokens' | 'spend_usd';
        amount: number;
        interval: '1m' | '1h' | '1d' | '1mo';
      }[]
    | undefined;
};

export let mapAiGatewayConfigUpdateBody =
  /* @__PURE__ */ mapObject<AiGatewayConfigUpdateBody>([
    'log_retention_days',
    [
      'settings',
      0,
      [
        1,
        [
          ['content_logging', 1, [1, ['retention_days']]],
          'metorial_provider',
          'zero_data_retention'
        ]
      ]
    ]
  ]);
