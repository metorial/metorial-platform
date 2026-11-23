import { createMapper } from '@metorial/util-resource-mapper/compact';

export type AiGatewayModelOfferingsListOutput = {
  items: {
    object: 'ai_gateway.model.offering';
    id: string;
    pinnedModel: string;
    vendorModelId: string;
    displayName: string;
    status: 'preview' | 'active' | 'deprecated' | 'retired';
    provider: { id: string; slug: string };
    model: { id: string; slug: string } | null;
    apis: string[];
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
    contextWindow: number | null;
    maxOutputTokens: number | null;
    modalities: { input: string[]; output: string[] };
    capabilities: {
      tools: boolean;
      toolChoice: string[] | null;
      structuredOutput: boolean;
      reasoning: { toggle: boolean; effort: string[] | null } | null;
      temperature: boolean;
      promptCaching: {
        implicit: boolean;
        explicit: boolean;
        ttls: string[];
      } | null;
      attachments: boolean;
    };
    variant: {
      serving: string | null;
      reasoning: 'on' | 'off' | null;
      quantization: string | null;
      free: boolean;
      region: string | null;
    };
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapAiGatewayModelOfferingsListOutput =
  /* @__PURE__ */ createMapper<AiGatewayModelOfferingsListOutput>([
    7,
    [
      1,
      [
        'pinned_model',
        'vendor_model_id',
        'display_name',
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
                [2, [1, [['rates', 0, [1, ['cache_read', 'cache_write']]]]]]
              ]
            ]
          ]
        ],
        'context_window',
        'max_output_tokens',
        [
          'capabilities',
          0,
          [1, ['tool_choice', 'structured_output', 'prompt_caching']]
        ]
      ]
    ]
  ]);

export type AiGatewayModelOfferingsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & { modelId?: string | undefined; provider?: string | undefined };

export let mapAiGatewayModelOfferingsListQuery =
  /* @__PURE__ */ createMapper<AiGatewayModelOfferingsListQuery>([
    3,
    [[0, [1, ['model_id']]]]
  ]);
