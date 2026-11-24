import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceChatWorkspacesListOutput = {
  items: {
    object: 'chat.workspace';
    id: string;
    chatId: string;
    providerWorkspaceId: string;
    name: string | null;
    domain: string | null;
    imageUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementInstanceChatWorkspacesListOutput =
  /* @__PURE__ */ createMapper<ManagementInstanceChatWorkspacesListOutput>(
    [
      7,
      [
        1,
        [
          'chat_id',
          'provider_workspace_id',
          'image_url',
          'created_at',
          'updated_at'
        ]
      ]
    ],
    1
  );

export type ManagementInstanceChatWorkspacesListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & { chatInstanceId: string; search?: string | undefined };

export let mapManagementInstanceChatWorkspacesListQuery =
  /* @__PURE__ */ createMapper<ManagementInstanceChatWorkspacesListQuery>([
    3,
    [[0, [1, ['chat_instance_id']]]]
  ]);
