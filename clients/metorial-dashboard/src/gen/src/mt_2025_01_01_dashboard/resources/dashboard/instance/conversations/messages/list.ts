import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceConversationsMessagesListOutput = {
  items: {
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
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceConversationsMessagesListOutput =
  mtMap.object<DashboardInstanceConversationsMessagesListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
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
                      imageUrl: mtMap.objectField(
                        'image_url',
                        mtMap.passthrough()
                      ),
                      teams: mtMap.objectField(
                        'teams',
                        mtMap.array(
                          mtMap.object({
                            id: mtMap.objectField('id', mtMap.passthrough()),
                            name: mtMap.objectField(
                              'name',
                              mtMap.passthrough()
                            ),
                            slug: mtMap.objectField(
                              'slug',
                              mtMap.passthrough()
                            ),
                            assignmentId: mtMap.objectField(
                              'assignment_id',
                              mtMap.passthrough()
                            ),
                            createdAt: mtMap.objectField(
                              'created_at',
                              mtMap.date()
                            ),
                            updatedAt: mtMap.objectField(
                              'updated_at',
                              mtMap.date()
                            )
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
                      imageUrl: mtMap.objectField(
                        'image_url',
                        mtMap.passthrough()
                      ),
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

export type DashboardInstanceConversationsMessagesListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapDashboardInstanceConversationsMessagesListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough())
    })
  )
]);

