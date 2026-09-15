import { mtMap } from '@metorial/util-resource-mapper';

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
  mtMap.object<ManagementInstanceChatWorkspacesGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    chatId: mtMap.objectField('chat_id', mtMap.passthrough()),
    providerWorkspaceId: mtMap.objectField(
      'provider_workspace_id',
      mtMap.passthrough()
    ),
    name: mtMap.objectField('name', mtMap.passthrough()),
    domain: mtMap.objectField('domain', mtMap.passthrough()),
    imageUrl: mtMap.objectField('image_url', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type ManagementInstanceChatWorkspacesGetQuery = {
  chatInstanceId: string;
};

export let mapManagementInstanceChatWorkspacesGetQuery =
  mtMap.object<ManagementInstanceChatWorkspacesGetQuery>({
    chatInstanceId: mtMap.objectField('chat_instance_id', mtMap.passthrough())
  });

