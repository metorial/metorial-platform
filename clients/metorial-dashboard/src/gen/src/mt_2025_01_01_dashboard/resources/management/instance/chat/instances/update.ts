import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceChatInstancesUpdateOutput = {
  object: 'chat.instance';
  id: string;
  status: 'draft' | 'active' | 'archived' | 'deleted';
  chatConnectionId: string;
  name: string;
  description: string | null;
  metadata: Record<string, any>;
  identity: {
    id: string;
    userId: string;
    name: string;
    username: string;
    providerType: string;
    email: string | null;
    imageUrl: string | null;
  } | null;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstanceChatInstancesUpdateOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceChatInstancesUpdateOutput>(
    [
      'chat_connection_id',
      ['identity', 0, [1, ['user_id', 'provider_type', 'image_url']]],
      'created_at',
      'updated_at'
    ],
    1
  );

export type ManagementInstanceChatInstancesUpdateBody = {
  name?: string | undefined;
  description?: string | null | undefined;
  metadata?: Record<string, any> | null | undefined;
  privateMetadata?: Record<string, any> | null | undefined;
};

export let mapManagementInstanceChatInstancesUpdateBody =
  /* @__PURE__ */ mapObject<ManagementInstanceChatInstancesUpdateBody>([
    'private_metadata'
  ]);
