import { mapObject } from '@metorial/util-resource-mapper/compact';

export type AiGatewayVirtualModelsInsightsGetOutput = {
  object: 'ai_gateway.virtual_model.insights';
  since: Date;
  days: number;
  routes: {
    ruleId: string | null;
    model: string | null;
    requests: number;
    failed: number;
    billedUsd: number;
    inputTokens: number;
    outputTokens: number;
    avgTotalMs: number | null;
  }[];
  decision: {
    calls: number;
    cached: number;
    failed: number;
    costUsd: number;
    avgLatencyMs: number | null;
  };
  billedUsd: number;
  savings: {
    baselineModel: string;
    baselineUsd: number;
    spentUsd: number;
    savedUsd: number;
    priced: boolean;
  } | null;
};

export let mapAiGatewayVirtualModelsInsightsGetOutput =
  /* @__PURE__ */ mapObject<AiGatewayVirtualModelsInsightsGetOutput>([
    ['since', 0, 4],
    [
      'routes',
      0,
      [
        2,
        [
          1,
          [
            'rule_id',
            'billed_usd',
            'input_tokens',
            'output_tokens',
            'avg_total_ms'
          ]
        ]
      ]
    ],
    ['decision', 0, [1, ['cost_usd', 'avg_latency_ms']]],
    'billed_usd',
    [
      'savings',
      0,
      [1, ['baseline_model', 'baseline_usd', 'spent_usd', 'saved_usd']]
    ]
  ]);

export type AiGatewayVirtualModelsInsightsGetQuery = {
  days?: number | undefined;
  baselineModel?: string | undefined;
};

export let mapAiGatewayVirtualModelsInsightsGetQuery =
  /* @__PURE__ */ mapObject<AiGatewayVirtualModelsInsightsGetQuery>([
    'baseline_model'
  ]);
