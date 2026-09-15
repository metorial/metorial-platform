import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceChatInstancesUpdateOutput = {
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

export let mapDashboardInstanceChatInstancesUpdateOutput =
  mtMap.object<DashboardInstanceChatInstancesUpdateOutput>({
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

export type DashboardInstanceChatInstancesUpdateBody = {
  name?: string | undefined;
  description?: string | null | undefined;
  metadata?: Record<string, any> | null | undefined;
  privateMetadata?: Record<string, any> | null | undefined;
};

export let mapDashboardInstanceChatInstancesUpdateBody =
  mtMap.object<DashboardInstanceChatInstancesUpdateBody>({
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    privateMetadata: mtMap.objectField('private_metadata', mtMap.passthrough())
  });

