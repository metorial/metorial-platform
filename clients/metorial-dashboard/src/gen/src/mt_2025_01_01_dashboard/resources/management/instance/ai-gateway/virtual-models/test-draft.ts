import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceAiGatewayVirtualModelsTestDraftOutput = {
  object: 'ai_gateway.virtual_model.test';
  request: {
    dialect: 'openai_chat' | 'anthropic_messages' | 'open_responses';
    inputTokens: number;
    messageCount: number;
    userTurns: number;
    isContinuation: boolean;
    hasImages: boolean;
    hasFiles: boolean;
    hasAudio: boolean;
    toolCount: number;
  };
  route: {
    versionId: string | null;
    versionNumber: number | null;
    ruleId: string | null;
    reason: 'rule' | 'default' | 'sticky';
    trace: {
      ruleId: string;
      outcome: 'matched' | 'not_matched' | 'error' | 'signals_unavailable';
      error: string | null;
    }[];
    models: string[];
    skippedModels: {
      model: string;
      reason:
        | 'image_input'
        | 'audio_input'
        | 'file_input'
        | 'context_window'
        | 'tools'
        | 'unknown_model'
        | 'unavailable';
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
  overrides: {
    reasoningEffort: 'minimal' | 'low' | 'medium' | 'high' | null;
    maxOutputTokens: number | null;
    temperature: number | null;
  } | null;
  candidates: (
    | {
        model: string;
        requestedModel: string;
        connectionOwner: 'platform';
        provider: string;
        pricing: {
          currency: 'USD';
          text: {
            input: number | null;
            output: number | null;
            cacheRead: number | null;
            cacheWrite: { ttl: string | null; price: number }[];
            reasoning: number | null;
          } | null;
          image: {
            input: number | null;
            output: number | null;
            cacheRead: number | null;
            cacheWrite: { ttl: string | null; price: number }[];
            reasoning: number | null;
          } | null;
          audio: {
            input: number | null;
            output: number | null;
            cacheRead: number | null;
            cacheWrite: { ttl: string | null; price: number }[];
            reasoning: number | null;
          } | null;
          video: {
            input: number | null;
            output: number | null;
            cacheRead: number | null;
            cacheWrite: { ttl: string | null; price: number }[];
            reasoning: number | null;
          } | null;
          contextTiers: {
            minInputTokens: number;
            input: number | null;
            output: number | null;
            cacheRead: number | null;
          }[];
          units: {
            modality: 'text' | 'image' | 'audio' | 'video';
            direction: 'input' | 'output';
            unit: string;
            price: number;
          }[];
          webSearchPer1K: number | null;
          conditions: {
            label: string;
            description: string;
            modality: 'text' | 'image' | 'audio' | 'video';
            rates: {
              input: number | null;
              output: number | null;
              cacheRead: number | null;
              cacheWrite: { ttl: string | null; price: number }[];
              reasoning: number | null;
            };
          }[];
        } | null;
      }
    | {
        model: string;
        requestedModel: string;
        connectionOwner: 'customer';
        provider: string;
        connectionId: string;
        vendorModelId: string;
        pricing: {
          currency: 'USD';
          text: {
            input: number | null;
            output: number | null;
            cacheRead: number | null;
            cacheWrite: { ttl: string | null; price: number }[];
            reasoning: number | null;
          } | null;
          image: {
            input: number | null;
            output: number | null;
            cacheRead: number | null;
            cacheWrite: { ttl: string | null; price: number }[];
            reasoning: number | null;
          } | null;
          audio: {
            input: number | null;
            output: number | null;
            cacheRead: number | null;
            cacheWrite: { ttl: string | null; price: number }[];
            reasoning: number | null;
          } | null;
          video: {
            input: number | null;
            output: number | null;
            cacheRead: number | null;
            cacheWrite: { ttl: string | null; price: number }[];
            reasoning: number | null;
          } | null;
          contextTiers: {
            minInputTokens: number;
            input: number | null;
            output: number | null;
            cacheRead: number | null;
          }[];
          units: {
            modality: 'text' | 'image' | 'audio' | 'video';
            direction: 'input' | 'output';
            unit: string;
            price: number;
          }[];
          webSearchPer1K: number | null;
          conditions: {
            label: string;
            description: string;
            modality: 'text' | 'image' | 'audio' | 'video';
            rates: {
              input: number | null;
              output: number | null;
              cacheRead: number | null;
              cacheWrite: { ttl: string | null; price: number }[];
              reasoning: number | null;
            };
          }[];
        } | null;
        pricingSource: 'offering' | 'connection';
      }
  )[];
};

export let mapManagementInstanceAiGatewayVirtualModelsTestDraftOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceAiGatewayVirtualModelsTestDraftOutput>(
    [
      [
        'request',
        0,
        [
          1,
          [
            'input_tokens',
            'message_count',
            'user_turns',
            'is_continuation',
            'has_images',
            'has_files',
            'has_audio',
            'tool_count'
          ]
        ]
      ],
      [
        'route',
        0,
        [
          1,
          [
            'version_id',
            'version_number',
            'rule_id',
            ['trace', 0, [2, [1, ['rule_id']]]],
            'skipped_models',
            ['decision', 0, [1, ['latency_ms', 'input_tokens', 'cost_usd']]]
          ]
        ]
      ],
      ['overrides', 0, [1, ['reasoning_effort', 'max_output_tokens']]],
      [
        'candidates',
        0,
        [
          2,
          [
            3,
            [
              [
                0,
                [
                  1,
                  [
                    'requested_model',
                    'connection_owner',
                    [
                      'pricing',
                      0,
                      [
                        1,
                        [
                          ['text', 0, [1, ['cache_read', 'cache_write']]],
                          ['image', 0, [1, ['cache_read', 'cache_write']]],
                          ['audio', 0, [1, ['cache_read', 'cache_write']]],
                          ['video', 0, [1, ['cache_read', 'cache_write']]],
                          [
                            'context_tiers',
                            1,
                            [2, [1, ['min_input_tokens', 'cache_read']]]
                          ],
                          ['web_search_per_1k', 'webSearchPer1K'],
                          [
                            'conditions',
                            0,
                            [
                              2,
                              [
                                1,
                                [
                                  [
                                    'rates',
                                    0,
                                    [1, ['cache_read', 'cache_write']]
                                  ]
                                ]
                              ]
                            ]
                          ]
                        ]
                      ]
                    ],
                    'connection_id',
                    'vendor_model_id',
                    'pricing_source'
                  ]
                ]
              ]
            ]
          ]
        ]
      ]
    ]
  );

export type ManagementInstanceAiGatewayVirtualModelsTestDraftBody = {
  definition: {
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
            reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high' | undefined;
            maxOutputTokens?: number | undefined;
            temperature?: number | undefined;
          }
        | undefined;
    }[];
    default: {
      models: { model: string; weight?: number | undefined }[];
      overrides?:
        | {
            reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high' | undefined;
            maxOutputTokens?: number | undefined;
            temperature?: number | undefined;
          }
        | undefined;
    };
    stickiness?:
      { metadataKey: string; ttlSeconds?: number | undefined } | undefined;
  };
  tokenId?: string | undefined;
  dialect: 'openai_chat' | 'anthropic_messages' | 'open_responses';
  request: Record<string, any>;
  metadata?: Record<string, string> | undefined;
};

export let mapManagementInstanceAiGatewayVirtualModelsTestDraftBody =
  /* @__PURE__ */ mapObject<ManagementInstanceAiGatewayVirtualModelsTestDraftBody>(
    [
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
                [
                  [
                    'overrides',
                    0,
                    [1, ['reasoning_effort', 'max_output_tokens']]
                  ]
                ]
              ]
            ],
            ['stickiness', 0, [1, ['metadata_key', 'ttl_seconds']]]
          ]
        ]
      ],
      'token_id'
    ]
  );
