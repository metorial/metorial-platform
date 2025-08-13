import { mtMap } from '@metorial/util-resource-mapper';

export type CustomServersRemoteServersGetOutput = {
  object: 'custom_server.remote_server';
  id: string;
  name: string | null;
  description: string | null;
  remoteUrl: string;
  connectionId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export let mapCustomServersRemoteServersGetOutput =
  mtMap.object<CustomServersRemoteServersGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    remoteUrl: mtMap.objectField('remote_url', mtMap.passthrough()),
    connectionId: mtMap.objectField('connection_id', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

