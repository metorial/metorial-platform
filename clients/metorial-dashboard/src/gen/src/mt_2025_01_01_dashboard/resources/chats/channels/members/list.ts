import { mtMap } from '@metorial/util-resource-mapper';

export type ChatsChannelsMembersListOutput = {
  items: {
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
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapChatsChannelsMembersListOutput =
  mtMap.object<ChatsChannelsMembersListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          chatId: mtMap.objectField('chat_id', mtMap.passthrough()),
          type: mtMap.objectField('type', mtMap.passthrough()),
          role: mtMap.objectField('role', mtMap.passthrough()),
          providerType: mtMap.objectField('provider_type', mtMap.passthrough()),
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

export type ChatsChannelsMembersListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapChatsChannelsMembersListQuery = mtMap.union([
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

