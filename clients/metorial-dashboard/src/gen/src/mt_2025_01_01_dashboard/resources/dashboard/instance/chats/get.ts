import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceChatsGetOutput = {
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

export let mapDashboardInstanceChatsGetOutput =
  mtMap.object<DashboardInstanceChatsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    chatConnectionId: mtMap.objectField(
      'chat_connection_id',
      mtMap.passthrough()
    ),
    chatInstanceId: mtMap.objectField('chat_instance_id', mtMap.passthrough()),
    chatInstanceProviderId: mtMap.objectField(
      'chat_instance_provider_id',
      mtMap.passthrough()
    ),
    providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
    workspaceId: mtMap.objectField('workspace_id', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

