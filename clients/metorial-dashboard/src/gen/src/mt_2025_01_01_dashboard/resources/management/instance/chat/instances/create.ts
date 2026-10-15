import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceChatInstancesCreateOutput = {
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

export let mapManagementInstanceChatInstancesCreateOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceChatInstancesCreateOutput>(
    [
      'chat_connection_id',
      ['identity', 0, [1, ['user_id', 'provider_type', 'image_url']]],
      'created_at',
      'updated_at'
    ],
    1
  );

export type ManagementInstanceChatInstancesCreateBody = {
  chatConnectionId: string;
  name?: string | undefined;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
  privateMetadata?: Record<string, any> | undefined;
  identityActorId?: string | null | undefined;
  identityId?: string | null | undefined;
};

export let mapManagementInstanceChatInstancesCreateBody =
  /* @__PURE__ */ mapObject<ManagementInstanceChatInstancesCreateBody>([
    'chat_connection_id',
    'private_metadata',
    'identity_actor_id',
    'identity_id'
  ]);
