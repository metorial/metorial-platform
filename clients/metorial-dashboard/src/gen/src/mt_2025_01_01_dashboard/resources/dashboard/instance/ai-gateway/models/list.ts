import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceAiGatewayModelsListOutput = {
  items: {
    object: 'ai_gateway.model';
    id: string;
    slug: string;
    name: string;
    description: string | null;
    kind: string;
    status: 'preview' | 'active' | 'deprecated' | 'retired';
    lab: { id: string; slug: string; name: string };
    familySlug: string | null;
    releaseDate: Date | null;
    openWeights: boolean;
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
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceAiGatewayModelsListOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceAiGatewayModelsListOutput>([
    7,
    [
      1,
      [
        'family_slug',
        ['release_date', 1, 4],
        'open_weights',
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

export type DashboardInstanceAiGatewayModelsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  lab?: string | undefined;
  kind?: string | undefined;
  search?: string | undefined;
};

export let mapDashboardInstanceAiGatewayModelsListQuery =
  /* @__PURE__ */ createMapper<DashboardInstanceAiGatewayModelsListQuery>(0);
