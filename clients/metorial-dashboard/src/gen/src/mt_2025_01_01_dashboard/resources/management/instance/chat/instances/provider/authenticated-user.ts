import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceChatInstancesProviderAuthenticatedUserOutput = {
  object: 'chat.authenticated_user';
  id: string | null;
  chatId: string | null;
  type: 'user' | 'app' | 'system' | 'webhook' | 'unknown';
  role: 'member' | 'guest' | 'unknown';
  providerType: string | null;
  providerAuthorId: string;
  userName: string;
  fullName: string;
  email: string | null;
  imageUrl: string | null;
  isSelf: boolean;
  workspace: {
    id: string;
    providerWorkspaceId: string;
    name: string | null;
    domain: string | null;
    imageUrl: string | null;
  } | null;
};

export let mapManagementInstanceChatInstancesProviderAuthenticatedUserOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceChatInstancesProviderAuthenticatedUserOutput>(
    [
      'chat_id',
      'provider_type',
      'provider_author_id',
      'user_name',
      'full_name',
      'image_url',
      'is_self',
      ['workspace', 0, [1, ['provider_workspace_id', 'image_url']]]
    ]
  );
