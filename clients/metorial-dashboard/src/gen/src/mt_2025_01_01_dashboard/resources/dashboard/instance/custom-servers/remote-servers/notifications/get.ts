import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceCustomServersRemoteServersNotificationsGetOutput =
  {
    object: 'custom_server.remote_server.notification';
    id: string;
    type: 'connection_issue';
    message: string;
    payload: Record<string, any> | null;
    remoteServerId: string;
    createdAt: Date;
  };

export let mapDashboardInstanceCustomServersRemoteServersNotificationsGetOutput =
  mtMap.object<DashboardInstanceCustomServersRemoteServersNotificationsGetOutput>(
    {
      object: mtMap.objectField('object', mtMap.passthrough()),
      id: mtMap.objectField('id', mtMap.passthrough()),
      type: mtMap.objectField('type', mtMap.passthrough()),
      message: mtMap.objectField('message', mtMap.passthrough()),
      payload: mtMap.objectField('payload', mtMap.passthrough()),
      remoteServerId: mtMap.objectField(
        'remote_server_id',
        mtMap.passthrough()
      ),
      createdAt: mtMap.objectField('created_at', mtMap.date())
    }
  );

