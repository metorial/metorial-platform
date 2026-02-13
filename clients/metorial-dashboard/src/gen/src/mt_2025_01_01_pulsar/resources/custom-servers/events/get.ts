import { mtMap } from '@metorial/util-resource-mapper';

export type CustomServersEventsGetOutput = {
  object: 'custom_server.event';
  id: string;
  type: 'remote_connection_issue';
  message: string;
  payload: Record<string, any>;
  customServerId: string;
  customServerVersionId: string | null;
  createdAt: Date;
};

export let mapCustomServersEventsGetOutput =
  mtMap.object<CustomServersEventsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    type: mtMap.objectField('type', mtMap.passthrough()),
    message: mtMap.objectField('message', mtMap.passthrough()),
    payload: mtMap.objectField('payload', mtMap.passthrough()),
    customServerId: mtMap.objectField('custom_server_id', mtMap.passthrough()),
    customServerVersionId: mtMap.objectField(
      'custom_server_version_id',
      mtMap.passthrough()
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date())
  });

