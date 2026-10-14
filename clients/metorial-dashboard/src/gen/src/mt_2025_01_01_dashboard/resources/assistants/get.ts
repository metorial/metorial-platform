import { mapObject } from '@metorial/util-resource-mapper/compact';

export type AssistantsGetOutput = {
  object: 'assistant';
  id: string;
  slug: string;
  name: string;
  ownerType: 'metorial' | 'organization';
  organizationId: string | null;
  defaultModel: {
    object: 'assistant.model';
    id: string;
    slug: string;
    name: string;
    contextWindow: number;
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

export let mapAssistantsGetOutput =
  /* @__PURE__ */ mapObject<AssistantsGetOutput>(
    [
      'owner_type',
      'organization_id',
      [
        'default_model',
        1,
        [1, ['context_window', ['provider', 0, [1, ['image_url']]]]]
      ],
      [
        'available_models',
        1,
        [2, [1, ['context_window', ['provider', 0, [1, ['image_url']]]]]]
      ],
      'created_at',
      'updated_at'
    ],
    1
  );
