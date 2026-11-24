import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceChatsChannelsMembersListOutput = {
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

export let mapManagementInstanceChatsChannelsMembersListOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceChatsChannelsMembersListOutput>(
    [
      7,
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
    1
  );

export type ManagementInstanceChatsChannelsMembersListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapManagementInstanceChatsChannelsMembersListQuery =
  /* @__PURE__ */ createMapper<ManagementInstanceChatsChannelsMembersListQuery>(
    0
  );
