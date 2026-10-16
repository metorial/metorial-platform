import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceChatWorkspacesGetOutput = {
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

export let mapManagementInstanceChatWorkspacesGetOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceChatWorkspacesGetOutput>(
    [
      'chat_id',
      'provider_workspace_id',
      'image_url',
      'created_at',
      'updated_at'
    ],
    1
  );

export type ManagementInstanceChatWorkspacesGetQuery = {
  chatInstanceId: string;
};

export let mapManagementInstanceChatWorkspacesGetQuery =
  /* @__PURE__ */ mapObject<ManagementInstanceChatWorkspacesGetQuery>([
    'chat_instance_id'
  ]);
