import { mapObject } from '@metorial/util-resource-mapper/compact';

export type AiGatewayVirtualModelsCreateFromTemplateOutput = {
  object: 'ai_gateway.virtual_model';
  id: string;
  slug: string;
  name: string;
  description: string | null;
  currentVersion: {
    object: 'ai_gateway.virtual_model.version';
    id: string;
    number: number;
    definition: {
      decision: {
        model: 'clef-flash' | 'clef' | 'jev';
        connectionId: string | null;
        timeoutMs: number | null;
        onError: 'default' | 'fail' | null;
        context: {
          priorTurns: number | null;
          maxChars: number | null;
          includeSystem: boolean | null;
          includeToolNames: boolean | null;
        } | null;
      } | null;
      signals: Record<
        string,
        | { type: 'boolean'; instructions: string }
        | {
            type: 'choice';
            instructions: string;
            options: Record<string, string>;
          }
        | { type: 'score'; instructions: string; levels: string[] }
      > | null;
      rules: {
        id: string;
        description: string | null;
        when: string;
        models: { model: string; weight: number | null }[];
        overrides: {
          reasoningEffort: 'minimal' | 'low' | 'medium' | 'high' | null;
          maxOutputTokens: number | null;
          temperature: number | null;
        } | null;
      }[];
      default: {
        models: { model: string; weight: number | null }[];
        overrides: {
          reasoningEffort: 'minimal' | 'low' | 'medium' | 'high' | null;
          maxOutputTokens: number | null;
          temperature: number | null;
        } | null;
      };
      stickiness: { metadataKey: string; ttlSeconds: number | null } | null;
    };
    targetModels: string[];
    createdAt: Date;
  } | null;
  warnings: string[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

export let mapAiGatewayVirtualModelsCreateFromTemplateOutput =
  /* @__PURE__ */ mapObject<AiGatewayVirtualModelsCreateFromTemplateOutput>(
    [
      [
        'current_version',
        1,
        [
          1,
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
            'target_models',
            'created_at'
          ]
        ]
      ],
      'created_at',
      'updated_at',
      'deleted_at'
    ],
    1
  );

export type AiGatewayVirtualModelsCreateFromTemplateBody = {
  template: string;
  slug: string;
  name: string;
  description?: string | null | undefined;
  parameters: Record<string, string>;
  decisionConnectionId?: string | undefined;
};

export let mapAiGatewayVirtualModelsCreateFromTemplateBody =
  /* @__PURE__ */ mapObject<AiGatewayVirtualModelsCreateFromTemplateBody>([
    'decision_connection_id'
  ]);
