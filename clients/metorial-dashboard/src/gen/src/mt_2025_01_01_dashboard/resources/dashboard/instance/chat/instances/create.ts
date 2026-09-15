import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceChatInstancesCreateOutput = {
  object: 'chat.instance';
  id: string;
  status: 'draft' | 'active' | 'archived' | 'deleted';
  chatConnectionId: string;
  name: string;
  description: string | null;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstanceChatInstancesCreateOutput =
  mtMap.object<DashboardInstanceChatInstancesCreateOutput>({
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
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type DashboardInstanceChatInstancesCreateBody = {
  chatConnectionId: string;
  name?: string | undefined;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
  privateMetadata?: Record<string, any> | undefined;
  identityActorId?: string | null | undefined;
  identityId?: string | null | undefined;
};

export let mapDashboardInstanceChatInstancesCreateBody =
  mtMap.object<DashboardInstanceChatInstancesCreateBody>({
    chatConnectionId: mtMap.objectField(
      'chat_connection_id',
      mtMap.passthrough()
    ),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    privateMetadata: mtMap.objectField('private_metadata', mtMap.passthrough()),
    identityActorId: mtMap.objectField(
      'identity_actor_id',
      mtMap.passthrough()
    ),
    identityId: mtMap.objectField('identity_id', mtMap.passthrough())
  });

