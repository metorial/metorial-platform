import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceChatWorkspacesGetOutput = {
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

export let mapDashboardInstanceChatWorkspacesGetOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceChatWorkspacesGetOutput>(
    [
      'chat_id',
      'provider_workspace_id',
      'image_url',
      'created_at',
      'updated_at'
    ],
    1
  );

export type DashboardInstanceChatWorkspacesGetQuery = {
  chatInstanceId: string;
};

export let mapDashboardInstanceChatWorkspacesGetQuery =
  /* @__PURE__ */ mapObject<DashboardInstanceChatWorkspacesGetQuery>([
    'chat_instance_id'
  ]);
