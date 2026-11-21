import { createMapper } from '@metorial/util-resource-mapper/compact';

export type AiGatewayVirtualModelTemplatesListOutput = {
  items: {
    object: 'ai_gateway.virtual_model.template';
    slug: string;
    name: string;
    description: string;
    parameters: { key: string; name: string; description: string }[];
    usesDecisionModel: boolean;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapAiGatewayVirtualModelTemplatesListOutput =
  /* @__PURE__ */ createMapper<AiGatewayVirtualModelTemplatesListOutput>([
    7,
    [1, ['uses_decision_model']]
  ]);
