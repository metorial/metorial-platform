import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceAiGatewayModelsGetOutput = {
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
};

export let mapDashboardInstanceAiGatewayModelsGetOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceAiGatewayModelsGetOutput>([
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
  ]);
