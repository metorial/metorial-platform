import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementOrganizationAssistantsGetOutput = {
  object: 'assistant';
  id: string;
  slug: string;
  name: string;
  ownerType: 'metorial' | 'organization';
  organizationId: string | null;
  implementation: {
    object: 'assistant.implementation';
    id: string;
    slug: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
  };
  defaultModel: {
    object: 'assistant.model';
    id: string;
    slug: string;
    name: string;
    contextWindow: number;
    inputCostPerMillionTokens: number;
    outputCostPerMillionTokens: number;
    provider: {
      object: 'assistant.model_provider';
      id: string;
      slug: string;
      name: string;
      imageUrl: string;
    };
  } | null;
  availableModels: {
    object: 'assistant.model';
    id: string;
    slug: string;
    name: string;
    contextWindow: number;
    inputCostPerMillionTokens: number;
    outputCostPerMillionTokens: number;
    provider: {
      object: 'assistant.model_provider';
      id: string;
      slug: string;
      name: string;
      imageUrl: string;
    };
  }[];
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementOrganizationAssistantsGetOutput =
  mtMap.object<ManagementOrganizationAssistantsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    slug: mtMap.objectField('slug', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    ownerType: mtMap.objectField('owner_type', mtMap.passthrough()),
    organizationId: mtMap.objectField('organization_id', mtMap.passthrough()),
    implementation: mtMap.objectField(
      'implementation',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        slug: mtMap.objectField('slug', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough()),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date())
      })
    ),
    defaultModel: mtMap.objectField(
      'default_model',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        slug: mtMap.objectField('slug', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough()),
        contextWindow: mtMap.objectField('context_window', mtMap.passthrough()),
        inputCostPerMillionTokens: mtMap.objectField(
          'input_cost_per_million_tokens',
          mtMap.passthrough()
        ),
        outputCostPerMillionTokens: mtMap.objectField(
          'output_cost_per_million_tokens',
          mtMap.passthrough()
        ),
        provider: mtMap.objectField(
          'provider',
          mtMap.object({
            object: mtMap.objectField('object', mtMap.passthrough()),
            id: mtMap.objectField('id', mtMap.passthrough()),
            slug: mtMap.objectField('slug', mtMap.passthrough()),
            name: mtMap.objectField('name', mtMap.passthrough()),
            imageUrl: mtMap.objectField('image_url', mtMap.passthrough())
          })
        )
      })
    ),
    availableModels: mtMap.objectField(
      'available_models',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          slug: mtMap.objectField('slug', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          contextWindow: mtMap.objectField(
            'context_window',
            mtMap.passthrough()
          ),
          inputCostPerMillionTokens: mtMap.objectField(
            'input_cost_per_million_tokens',
            mtMap.passthrough()
          ),
          outputCostPerMillionTokens: mtMap.objectField(
            'output_cost_per_million_tokens',
            mtMap.passthrough()
          ),
          provider: mtMap.objectField(
            'provider',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              slug: mtMap.objectField('slug', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough()),
              imageUrl: mtMap.objectField('image_url', mtMap.passthrough())
            })
          )
        })
      )
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

