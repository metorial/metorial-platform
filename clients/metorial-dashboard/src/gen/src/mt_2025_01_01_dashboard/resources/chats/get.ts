import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ChatsGetOutput = {
  object: 'chat';
  id: string;
  status: 'active' | 'archived' | 'deleted';
  name: string;
  chatConnectionId: string;
  chatInstanceId: string;
  chatInstanceProviderId: string;
  providerId: string;
  workspaceId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export let mapChatsGetOutput = /* @__PURE__ */ mapObject<ChatsGetOutput>(
  [
    'chat_connection_id',
    'chat_instance_id',
    'chat_instance_provider_id',
    'provider_id',
    'workspace_id',
    'created_at',
    'updated_at'
  ],
  1
);
