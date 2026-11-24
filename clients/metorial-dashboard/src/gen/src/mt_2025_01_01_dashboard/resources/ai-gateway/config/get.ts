import { mapObject } from '@metorial/util-resource-mapper/compact';

export type AiGatewayConfigGetOutput = {
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

export let mapAiGatewayConfigGetOutput =
  /* @__PURE__ */ mapObject<AiGatewayConfigGetOutput>(
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
