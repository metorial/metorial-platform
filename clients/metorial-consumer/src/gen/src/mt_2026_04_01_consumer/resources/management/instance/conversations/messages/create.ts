import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceConversationsMessagesCreateOutput = {
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
    actor: {
      type: 'organization_actor' | 'consumer' | 'unknown';
      name: string;
      imageUrl: string | null;
      email: string | null;
      organizationActor: {
        object: 'organization.actor';
        id: string;
        type: 'member' | 'machine_access';
        organizationId: string;
        name: string;
        email: string | null;
        imageUrl: string;
        teams: {
          id: string;
          name: string;
          slug: string;
          assignmentId: string;
          createdAt: Date;
          updatedAt: Date;
        }[];
        createdAt: Date;
        updatedAt: Date;
      } | null;
      consumer: {
        object: 'consumer';
        id: string;
        name: string;
        email: string;
        imageUrl: string;
        createdAt: Date;
        updatedAt: Date;
      } | null;
    } | null;
    createdAt: Date;
    updatedAt: Date;
  };
  items: Record<string, any>[];
  createdAt: Date;
};

export let mapManagementInstanceConversationsMessagesCreateOutput =
  mtMap.object<ManagementInstanceConversationsMessagesCreateOutput>({
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
        actor: mtMap.objectField(
          'actor',
          mtMap.object({
            type: mtMap.objectField('type', mtMap.passthrough()),
            name: mtMap.objectField('name', mtMap.passthrough()),
            imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
            email: mtMap.objectField('email', mtMap.passthrough()),
            organizationActor: mtMap.objectField(
              'organization_actor',
              mtMap.object({
                object: mtMap.objectField('object', mtMap.passthrough()),
                id: mtMap.objectField('id', mtMap.passthrough()),
                type: mtMap.objectField('type', mtMap.passthrough()),
                organizationId: mtMap.objectField(
                  'organization_id',
                  mtMap.passthrough()
                ),
                name: mtMap.objectField('name', mtMap.passthrough()),
                email: mtMap.objectField('email', mtMap.passthrough()),
                imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
                teams: mtMap.objectField(
                  'teams',
                  mtMap.array(
                    mtMap.object({
                      id: mtMap.objectField('id', mtMap.passthrough()),
                      name: mtMap.objectField('name', mtMap.passthrough()),
                      slug: mtMap.objectField('slug', mtMap.passthrough()),
                      assignmentId: mtMap.objectField(
                        'assignment_id',
                        mtMap.passthrough()
                      ),
                      createdAt: mtMap.objectField('created_at', mtMap.date()),
                      updatedAt: mtMap.objectField('updated_at', mtMap.date())
                    })
                  )
                ),
                createdAt: mtMap.objectField('created_at', mtMap.date()),
                updatedAt: mtMap.objectField('updated_at', mtMap.date())
              })
            ),
            consumer: mtMap.objectField(
              'consumer',
              mtMap.object({
                object: mtMap.objectField('object', mtMap.passthrough()),
                id: mtMap.objectField('id', mtMap.passthrough()),
                name: mtMap.objectField('name', mtMap.passthrough()),
                email: mtMap.objectField('email', mtMap.passthrough()),
                imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
                createdAt: mtMap.objectField('created_at', mtMap.date()),
                updatedAt: mtMap.objectField('updated_at', mtMap.date())
              })
            )
          })
        ),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date())
      })
    ),
    items: mtMap.objectField('items', mtMap.array(mtMap.passthrough())),
    createdAt: mtMap.objectField('created_at', mtMap.date())
  });

export type ManagementInstanceConversationsMessagesCreateBody = {
  message: {
    parts: (
      | { type: 'text'; text: string }
      | {
          type: 'file';
          data: string;
          encoding: 'utf-8' | 'base64';
          mediaType: string;
          filename?: string | undefined;
        }
    )[];
  };
  parentMessageId?: string | undefined;
  modelId?: string | undefined;
};

export let mapManagementInstanceConversationsMessagesCreateBody =
  mtMap.object<ManagementInstanceConversationsMessagesCreateBody>({
    message: mtMap.objectField(
      'message',
      mtMap.object({
        parts: mtMap.objectField(
          'parts',
          mtMap.array(
            mtMap.union([
              mtMap.unionOption(
                'object',
                mtMap.object({
                  type: mtMap.objectField('type', mtMap.passthrough()),
                  text: mtMap.objectField('text', mtMap.passthrough()),
                  data: mtMap.objectField('data', mtMap.passthrough()),
                  encoding: mtMap.objectField('encoding', mtMap.passthrough()),
                  mediaType: mtMap.objectField(
                    'media_type',
                    mtMap.passthrough()
                  ),
                  filename: mtMap.objectField('filename', mtMap.passthrough())
                })
              )
            ])
          )
        )
      })
    ),
    parentMessageId: mtMap.objectField(
      'parent_message_id',
      mtMap.passthrough()
    ),
    modelId: mtMap.objectField('model_id', mtMap.passthrough())
  });

