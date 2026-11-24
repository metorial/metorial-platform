import { createMapper } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceChatsChannelsListOutput = {
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

export let mapDashboardInstanceChatsChannelsListOutput =
  /* @__PURE__ */ createMapper<DashboardInstanceChatsChannelsListOutput>(
    [
      7,
      [
        1,
        [
          'chat_id',
          'workspace_id',
          'provider_type',
          'provider_channel_id',
          'has_access',
          [
            'recipient',
            0,
            [
              1,
              [
                'chat_id',
                'provider_type',
                'provider_author_id',
                'user_name',
                'full_name',
                'image_url',
                'is_self',
                'created_at',
                'updated_at',
                'last_interaction_at'
              ]
            ]
          ],
          'member_count',
          'created_at',
          'updated_at',
          'last_interaction_at'
        ]
      ]
    ],
    1
  );

export type DashboardInstanceChatsChannelsListQuery = {
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

export let mapDashboardInstanceChatsChannelsListQuery =
  /* @__PURE__ */ createMapper<DashboardInstanceChatsChannelsListQuery>([
    3,
    [[0, [1, ['workspace_id', 'has_access']]]]
  ]);
