import { mapObject } from '@metorial/util-resource-mapper/compact';

export type AiGatewayRoutingPreviewOutput = {
  object: 'ai_gateway.route_preview';
  requested: string;
  request:
    | { type: 'pinned'; provider: string; vendorModelId: string }
    | { type: 'metorial' | 'unified'; name: string };
  via: 'slug' | 'alias' | 'key' | 'offering';
  model: { slug: string; labSlug: string };
  candidates: (
    | {
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

export let mapAiGatewayRoutingPreviewOutput =
  /* @__PURE__ */ mapObject<AiGatewayRoutingPreviewOutput>([
    ['request', 0, [3, [[0, [1, ['vendor_model_id']]]]]],
    ['model', 0, [1, ['lab_slug']]],
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
                              [['rates', 0, [1, ['cache_read', 'cache_write']]]]
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
  ]);

export type AiGatewayRoutingPreviewBody = {
  model: string;
  requiredFeatures?: 'zdr'[] | undefined;
};

export let mapAiGatewayRoutingPreviewBody =
  /* @__PURE__ */ mapObject<AiGatewayRoutingPreviewBody>(['required_features']);
