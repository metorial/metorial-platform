import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementOrganizationConversationsListOutput = {
  items: {
    object: 'assistant.conversation';
    id: string;
    title: string | null;
    assistantId: string;
    instanceId: string;
    organizationId: string;
    createdByActorId: string;
    rootMessageId: string;
    assistant: {
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
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementOrganizationConversationsListOutput =
  mtMap.object<ManagementOrganizationConversationsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          title: mtMap.objectField('title', mtMap.passthrough()),
          assistantId: mtMap.objectField('assistant_id', mtMap.passthrough()),
          instanceId: mtMap.objectField('instance_id', mtMap.passthrough()),
          organizationId: mtMap.objectField(
            'organization_id',
            mtMap.passthrough()
          ),
          createdByActorId: mtMap.objectField(
            'created_by_actor_id',
            mtMap.passthrough()
          ),
          rootMessageId: mtMap.objectField(
            'root_message_id',
            mtMap.passthrough()
          ),
          assistant: mtMap.objectField(
            'assistant',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              slug: mtMap.objectField('slug', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough()),
              ownerType: mtMap.objectField('owner_type', mtMap.passthrough()),
              organizationId: mtMap.objectField(
                'organization_id',
                mtMap.passthrough()
              ),
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
                      imageUrl: mtMap.objectField(
                        'image_url',
                        mtMap.passthrough()
                      )
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
                        object: mtMap.objectField(
                          'object',
                          mtMap.passthrough()
                        ),
                        id: mtMap.objectField('id', mtMap.passthrough()),
                        slug: mtMap.objectField('slug', mtMap.passthrough()),
                        name: mtMap.objectField('name', mtMap.passthrough()),
                        imageUrl: mtMap.objectField(
                          'image_url',
                          mtMap.passthrough()
                        )
                      })
                    )
                  })
                )
              ),
              createdAt: mtMap.objectField('created_at', mtMap.date()),
              updatedAt: mtMap.objectField('updated_at', mtMap.date())
            })
          ),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          updatedAt: mtMap.objectField('updated_at', mtMap.date())
        })
      )
    ),
    pagination: mtMap.objectField(
      'pagination',
      mtMap.object({
        hasMoreBefore: mtMap.objectField(
          'has_more_before',
          mtMap.passthrough()
        ),
        hasMoreAfter: mtMap.objectField('has_more_after', mtMap.passthrough())
      })
    )
  });

export type ManagementOrganizationConversationsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & { assistantId?: string | string[] | undefined };

export let mapManagementOrganizationConversationsListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough()),
      assistantId: mtMap.objectField(
        'assistant_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      )
    })
  )
]);

