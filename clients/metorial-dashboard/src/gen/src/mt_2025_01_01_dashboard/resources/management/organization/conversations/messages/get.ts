import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementOrganizationConversationsMessagesGetOutput = {
  object: 'assistant.message';
  id: string;
  conversationItemId: string;
  type: 'root' | 'user' | 'assistant';
  assistantId: string | null;
  parentMessageId: string | null;
  model: {
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
  request: {
    object: 'assistant.request';
    id: string;
    status: 'pending' | 'completed' | 'cancelled' | 'failed';
    actorId: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  state: Record<string, any>;
  serialized: Record<string, any>;
  createdAt: Date;
};

export let mapManagementOrganizationConversationsMessagesGetOutput =
  mtMap.object<ManagementOrganizationConversationsMessagesGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    conversationItemId: mtMap.objectField(
      'conversation_item_id',
      mtMap.passthrough()
    ),
    type: mtMap.objectField('type', mtMap.passthrough()),
    assistantId: mtMap.objectField('assistant_id', mtMap.passthrough()),
    parentMessageId: mtMap.objectField(
      'parent_message_id',
      mtMap.passthrough()
    ),
    model: mtMap.objectField(
      'model',
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
    request: mtMap.objectField(
      'request',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        status: mtMap.objectField('status', mtMap.passthrough()),
        actorId: mtMap.objectField('actor_id', mtMap.passthrough()),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date())
      })
    ),
    state: mtMap.objectField('state', mtMap.passthrough()),
    serialized: mtMap.objectField('serialized', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date())
  });

