import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceChatsChannelsListOutput = {
  items: {
    object: 'chat.channel';
    id: string;
    chatId: string;
    workspaceId: string | null;
    type:
      | 'public'
      | 'private'
      | 'dm'
      | 'group_dm'
      | 'shared'
      | 'announcement'
      | 'forum'
      | 'unknown';
    providerType: string;
    providerChannelId: string;
    name: string | null;
    topic: string | null;
    subject: string | null;
    hasAccess: boolean;
    recipient: {
      object: 'chat.author';
      id: string;
      chatId: string;
      type: 'user' | 'app' | 'system' | 'webhook' | 'unknown';
      role: 'member' | 'guest' | 'unknown';
      providerType: string;
      providerAuthorId: string;
      userName: string;
      fullName: string;
      email: string | null;
      imageUrl: string | null;
      isSelf: boolean;
      createdAt: Date;
      updatedAt: Date;
      lastInteractionAt: Date | null;
    } | null;
    memberCount: number | null;
    permalink: string | null;
    context: {
      type:
        | 'issue'
        | 'pull_request'
        | 'review'
        | 'page'
        | 'ticket'
        | 'post'
        | 'unknown';
      id: string;
      description?: string | undefined;
      status?: string | undefined;
      url?: string | undefined;
      author?: { id: string; name: string } | undefined;
      assignee?: { id: string; name: string } | undefined;
      labels?: string[] | undefined;
    } | null;
    createdAt: Date;
    updatedAt: Date;
    lastInteractionAt: Date | null;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementInstanceChatsChannelsListOutput =
  mtMap.object<ManagementInstanceChatsChannelsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          chatId: mtMap.objectField('chat_id', mtMap.passthrough()),
          workspaceId: mtMap.objectField('workspace_id', mtMap.passthrough()),
          type: mtMap.objectField('type', mtMap.passthrough()),
          providerType: mtMap.objectField('provider_type', mtMap.passthrough()),
          providerChannelId: mtMap.objectField(
            'provider_channel_id',
            mtMap.passthrough()
          ),
          name: mtMap.objectField('name', mtMap.passthrough()),
          topic: mtMap.objectField('topic', mtMap.passthrough()),
          subject: mtMap.objectField('subject', mtMap.passthrough()),
          hasAccess: mtMap.objectField('has_access', mtMap.passthrough()),
          recipient: mtMap.objectField(
            'recipient',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              chatId: mtMap.objectField('chat_id', mtMap.passthrough()),
              type: mtMap.objectField('type', mtMap.passthrough()),
              role: mtMap.objectField('role', mtMap.passthrough()),
              providerType: mtMap.objectField(
                'provider_type',
                mtMap.passthrough()
              ),
              providerAuthorId: mtMap.objectField(
                'provider_author_id',
                mtMap.passthrough()
              ),
              userName: mtMap.objectField('user_name', mtMap.passthrough()),
              fullName: mtMap.objectField('full_name', mtMap.passthrough()),
              email: mtMap.objectField('email', mtMap.passthrough()),
              imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
              isSelf: mtMap.objectField('is_self', mtMap.passthrough()),
              createdAt: mtMap.objectField('created_at', mtMap.date()),
              updatedAt: mtMap.objectField('updated_at', mtMap.date()),
              lastInteractionAt: mtMap.objectField(
                'last_interaction_at',
                mtMap.date()
              )
            })
          ),
          memberCount: mtMap.objectField('member_count', mtMap.passthrough()),
          permalink: mtMap.objectField('permalink', mtMap.passthrough()),
          context: mtMap.objectField(
            'context',
            mtMap.object({
              type: mtMap.objectField('type', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              description: mtMap.objectField(
                'description',
                mtMap.passthrough()
              ),
              status: mtMap.objectField('status', mtMap.passthrough()),
              url: mtMap.objectField('url', mtMap.passthrough()),
              author: mtMap.objectField(
                'author',
                mtMap.object({
                  id: mtMap.objectField('id', mtMap.passthrough()),
                  name: mtMap.objectField('name', mtMap.passthrough())
                })
              ),
              assignee: mtMap.objectField(
                'assignee',
                mtMap.object({
                  id: mtMap.objectField('id', mtMap.passthrough()),
                  name: mtMap.objectField('name', mtMap.passthrough())
                })
              ),
              labels: mtMap.objectField(
                'labels',
                mtMap.array(mtMap.passthrough())
              )
            })
          ),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          updatedAt: mtMap.objectField('updated_at', mtMap.date()),
          lastInteractionAt: mtMap.objectField(
            'last_interaction_at',
            mtMap.date()
          )
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

export type ManagementInstanceChatsChannelsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  workspaceId?: string | undefined;
  type?:
    | 'public'
    | 'private'
    | 'dm'
    | 'group_dm'
    | 'shared'
    | 'announcement'
    | 'forum'
    | 'unknown'
    | undefined;
  search?: string | undefined;
  hasAccess?: boolean | undefined;
};

export let mapManagementInstanceChatsChannelsListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough()),
      workspaceId: mtMap.objectField('workspace_id', mtMap.passthrough()),
      type: mtMap.objectField('type', mtMap.passthrough()),
      search: mtMap.objectField('search', mtMap.passthrough()),
      hasAccess: mtMap.objectField('has_access', mtMap.passthrough())
    })
  )
]);

