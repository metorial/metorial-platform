import { mtMap } from '@metorial/util-resource-mapper';

export type ConversationsListOutput = {
  items: {
    object: 'assistant.conversation';
    id: string;
    title: string | null;
    assistantId: string;
    instanceId: string;
    organizationId: string;
    createdByActor: {
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
    };
    rootMessageId: string;
    assistant: {
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
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapConversationsListOutput = mtMap.object<ConversationsListOutput>({
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
        createdByActor: mtMap.objectField(
          'created_by_actor',
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
      hasMoreBefore: mtMap.objectField('has_more_before', mtMap.passthrough()),
      hasMoreAfter: mtMap.objectField('has_more_after', mtMap.passthrough())
    })
  )
});

export type ConversationsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & { assistantId?: string | string[] | undefined };

export let mapConversationsListQuery = mtMap.union([
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

