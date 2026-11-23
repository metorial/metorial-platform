import { mapObject } from '@metorial/util-resource-mapper/compact';

export type AiGatewayVirtualModelsReplayOutput = {
  object: 'ai_gateway.virtual_model.replay';
  results: {
    inferenceLogId: string;
    receivedAt: Date;
    original: { ruleId: string | null; model: string | null };
    replayed: {
      ruleId: string | null;
      model: string | null;
      trace: {
        ruleId: string;
        outcome: 'matched' | 'not_matched' | 'error' | 'signals_unavailable';
        error: string | null;
      }[];
      decision: {
        model: 'clef-flash' | 'clef' | 'jev';
        source: 'customer' | 'platform' | null;
        cached: boolean;
        latencyMs: number;
        inputTokens: number;
        costUsd: number;
        signals: Record<
          string,
          | { type: 'boolean'; value: boolean; probability: number }
          | {
              type: 'choice';
              choice: string;
              probability: number;
              confidence: number;
              probabilities: Record<string, number>;
            }
          | {
              type: 'score';
              score: number;
              level: number;
              probability: number;
              confidence: number;
              probabilities: number[];
            }
        > | null;
        error: {
          code:
            | 'timeout'
            | 'unreachable'
            | 'rate_limited'
            | 'rejected'
            | 'invalid_response'
            | 'unavailable';
          message: string;
        } | null;
      } | null;
    } | null;
    changed: boolean;
    error: string | null;
  }[];
  summary: { replayed: number; changed: number; decisionCostUsd: number };
};

export let mapAiGatewayVirtualModelsReplayOutput =
  /* @__PURE__ */ mapObject<AiGatewayVirtualModelsReplayOutput>(
    [
      [
        'results',
        0,
        [
          2,
          [
            1,
            [
              'inference_log_id',
              'received_at',
              ['original', 0, [1, ['rule_id']]],
              [
                'replayed',
                0,
                [
                  1,
                  [
                    'rule_id',
                    ['trace', 0, [2, [1, ['rule_id']]]],
                    [
                      'decision',
                      0,
                      [1, ['latency_ms', 'input_tokens', 'cost_usd']]
                    ]
                  ]
                ]
              ]
            ]
          ]
        ]
      ],
      ['summary', 0, [1, ['decision_cost_usd']]]
    ],
    1
  );

export type AiGatewayVirtualModelsReplayBody = {
  definition?:
    | {
        decision?:
          | {
              model: 'clef-flash' | 'clef' | 'jev';
              connectionId?: string | undefined;
              timeoutMs?: number | undefined;
              onError?: 'default' | 'fail' | undefined;
              context?:
                | {
                    priorTurns?: number | undefined;
                    maxChars?: number | undefined;
                    includeSystem?: boolean | undefined;
                    includeToolNames?: boolean | undefined;
                  }
                | undefined;
            }
          | undefined;
        signals?:
          | Record<
              string,
              | { type: 'boolean'; instructions: string }
              | {
                  type: 'choice';
                  instructions: string;
                  options: Record<string, string>;
                }
              | { type: 'score'; instructions: string; levels: string[] }
            >
          | undefined;
        rules: {
          id: string;
          description?: string | undefined;
          when: string;
          models: { model: string; weight?: number | undefined }[];
          overrides?:
            | {
                reasoningEffort?:
                  'minimal' | 'low' | 'medium' | 'high' | undefined;
                maxOutputTokens?: number | undefined;
                temperature?: number | undefined;
              }
            | undefined;
        }[];
        default: {
          models: { model: string; weight?: number | undefined }[];
          overrides?:
            | {
                reasoningEffort?:
                  'minimal' | 'low' | 'medium' | 'high' | undefined;
                maxOutputTokens?: number | undefined;
                temperature?: number | undefined;
              }
            | undefined;
        };
        stickiness?:
          { metadataKey: string; ttlSeconds?: number | undefined } | undefined;
      }
    | undefined;
  limit?: number | undefined;
};

export let mapAiGatewayVirtualModelsReplayBody =
  /* @__PURE__ */ mapObject<AiGatewayVirtualModelsReplayBody>([
    [
      'definition',
      0,
      [
        1,
        [
          [
            'decision',
            0,
            [
              1,
              [
                'connection_id',
                'timeout_ms',
                'on_error',
                [
                  'context',
                  0,
                  [
                    1,
                    [
                      'prior_turns',
                      'max_chars',
                      'include_system',
                      'include_tool_names'
                    ]
                  ]
                ]
              ]
            ]
          ],
          [
            'rules',
            0,
            [
              2,
              [
                1,
                [
                  [
                    'overrides',
                    0,
                    [1, ['reasoning_effort', 'max_output_tokens']]
                  ]
                ]
              ]
            ]
          ],
          [
            'default',
            0,
            [
              1,
              [['overrides', 0, [1, ['reasoning_effort', 'max_output_tokens']]]]
            ]
          ],
          ['stickiness', 0, [1, ['metadata_key', 'ttl_seconds']]]
        ]
      ]
    ]
  ]);
