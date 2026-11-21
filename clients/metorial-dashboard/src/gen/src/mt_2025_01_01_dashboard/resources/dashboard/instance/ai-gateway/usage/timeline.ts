import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceAiGatewayUsageTimelineOutput = {
  object: 'ai_gateway.usage_timeline';
  interval: '5m' | '15m' | '1h' | '6h' | '1d';
  from: Date;
  to: Date;
  buckets: {
    start: Date;
    requests: number;
    succeeded: number;
    failed: number;
    cancelled: number;
    rejected: number;
    inputTokens: number;
    cachedInputTokens: number;
    outputTokens: number;
    costUsd: number;
    metorialCostUsd: number;
    averageLatencyMs: number | null;
  }[];
};

export let mapDashboardInstanceAiGatewayUsageTimelineOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceAiGatewayUsageTimelineOutput>([
    ['from', 0, 4],
    ['to', 0, 4],
    [
      'buckets',
      0,
      [
        2,
        [
          1,
          [
            ['start', 0, 4],
            'input_tokens',
            'cached_input_tokens',
            'output_tokens',
            'cost_usd',
            'metorial_cost_usd',
            'average_latency_ms'
          ]
        ]
      ]
    ]
  ]);

export type DashboardInstanceAiGatewayUsageTimelineQuery = {
  from: Date;
  to: Date;
  interval?: '5m' | '15m' | '1h' | '6h' | '1d' | undefined;
  tokenId?: string | undefined;
  consumerId?: string | undefined;
  model?: string | undefined;
  virtualModelId?: string | undefined;
};

export let mapDashboardInstanceAiGatewayUsageTimelineQuery =
  /* @__PURE__ */ mapObject<DashboardInstanceAiGatewayUsageTimelineQuery>([
    ['from', 0, 4],
    ['to', 0, 4],
    'token_id',
    'consumer_id',
    'virtual_model_id'
  ]);
