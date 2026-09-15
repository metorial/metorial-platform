import { mtMap } from '@metorial/util-resource-mapper';

export type ChatInstancesCreateOutput = {
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

export let mapChatInstancesCreateOutput =
  mtMap.object<ChatInstancesCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    chatConnectionId: mtMap.objectField(
      'chat_connection_id',
      mtMap.passthrough()
    ),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    identity: mtMap.objectField(
      'identity',
      mtMap.object({
        id: mtMap.objectField('id', mtMap.passthrough()),
        userId: mtMap.objectField('user_id', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough()),
        username: mtMap.objectField('username', mtMap.passthrough()),
        providerType: mtMap.objectField('provider_type', mtMap.passthrough()),
        email: mtMap.objectField('email', mtMap.passthrough()),
        imageUrl: mtMap.objectField('image_url', mtMap.passthrough())
      })
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type ChatInstancesCreateBody = {
  chatConnectionId: string;
  name?: string | undefined;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
  privateMetadata?: Record<string, any> | undefined;
  identityActorId?: string | null | undefined;
  identityId?: string | null | undefined;
};

export let mapChatInstancesCreateBody = mtMap.object<ChatInstancesCreateBody>({
  chatConnectionId: mtMap.objectField(
    'chat_connection_id',
    mtMap.passthrough()
  ),
  name: mtMap.objectField('name', mtMap.passthrough()),
  description: mtMap.objectField('description', mtMap.passthrough()),
  metadata: mtMap.objectField('metadata', mtMap.passthrough()),
  privateMetadata: mtMap.objectField('private_metadata', mtMap.passthrough()),
  identityActorId: mtMap.objectField('identity_actor_id', mtMap.passthrough()),
  identityId: mtMap.objectField('identity_id', mtMap.passthrough())
});

