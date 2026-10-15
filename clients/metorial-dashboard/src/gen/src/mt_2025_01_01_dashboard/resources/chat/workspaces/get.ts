import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ChatWorkspacesGetOutput = {
  object: 'chat.workspace';
  id: string;
  chatId: string;
  providerWorkspaceId: string;
  name: string | null;
  domain: string | null;
  imageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export let mapChatWorkspacesGetOutput =
  /* @__PURE__ */ mapObject<ChatWorkspacesGetOutput>(
    [
      'chat_id',
      'provider_workspace_id',
      'image_url',
      'created_at',
      'updated_at'
    ],
    1
  );

export type ChatWorkspacesGetQuery = { chatInstanceId: string };

export let mapChatWorkspacesGetQuery =
  /* @__PURE__ */ mapObject<ChatWorkspacesGetQuery>(['chat_instance_id']);
