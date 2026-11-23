import type { VirtualModelDefinition } from '@mtsrc/ai-gateway-spec';

let slugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
let parameterPattern = /^[a-z][a-z0-9_]*$/;

export type TemplateParameter = { key: string; name: string; description: string };

export type VirtualModelTemplate = {
  slug: string;
  name: string;
  description: string;
  parameters: TemplateParameter[];
  usesDecisionModel: boolean;
  build: (models: Record<string, string>) => VirtualModelDefinition;
};

export let virtualModelTemplate = (template: VirtualModelTemplate): VirtualModelTemplate => {
  if (!slugPattern.test(template.slug)) {
    throw new Error(
      `Virtual model template slug "${template.slug}" must be lowercase kebab-case.`
    );
  }

  for (let parameter of template.parameters) {
    if (!parameterPattern.test(parameter.key)) {
      throw new Error(
        `Template "${template.slug}" parameter "${parameter.key}" must be snake_case.`
      );
    }
  }

  let placeholders = Object.fromEntries(
    template.parameters.map(parameter => [parameter.key, `<${parameter.key}>`])
  );
  if (!!template.build(placeholders).decision != template.usesDecisionModel) {
    throw new Error(
      `Template "${template.slug}" usesDecisionModel does not match its definition.`
    );
  }

  return template;
};
