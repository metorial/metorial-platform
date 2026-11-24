import { createMapper } from '@metorial/util-resource-mapper/compact';

export type AssistantsListOutput = {
  items: {
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
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapAssistantsListOutput =
  /* @__PURE__ */ createMapper<AssistantsListOutput>(
    [
      7,
      [
        1,
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
        ]
      ]
    ],
    1
  );

export type AssistantsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapAssistantsListQuery =
  /* @__PURE__ */ createMapper<AssistantsListQuery>(0);
