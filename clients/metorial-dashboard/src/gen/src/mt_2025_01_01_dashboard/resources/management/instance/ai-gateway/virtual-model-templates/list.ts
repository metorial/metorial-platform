import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceAiGatewayVirtualModelTemplatesListOutput = {
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

export let mapManagementInstanceAiGatewayVirtualModelTemplatesListOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceAiGatewayVirtualModelTemplatesListOutput>(
    [7, [1, ['uses_decision_model']]]
  );
