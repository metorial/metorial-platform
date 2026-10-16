import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceChatsChannelsMembersGetOutput = {
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
};

export let mapDashboardInstanceChatsChannelsMembersGetOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceChatsChannelsMembersGetOutput>(
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
    ],
    1
  );
