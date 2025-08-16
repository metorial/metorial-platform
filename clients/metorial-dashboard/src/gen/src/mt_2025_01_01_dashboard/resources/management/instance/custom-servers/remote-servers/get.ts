import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceCustomServersRemoteServersGetOutput = {
  object: 'custom_server.remote_server';
  id: string;
  name: string | null;
  description: string | null;
  remoteUrl: string;
  providerOauth: {
    status: 'pending' | 'active' | 'inactive';
    type: 'none' | 'manual' | 'auto_discovery';
    config: Record<string, any> | null;
    createdAt: Date;
    updatedAt: Date;
  };
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstanceCustomServersRemoteServersGetOutput =
  mtMap.object<ManagementInstanceCustomServersRemoteServersGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    remoteUrl: mtMap.objectField('remote_url', mtMap.passthrough()),
    providerOauth: mtMap.objectField(
      'provider_oauth',
      mtMap.object({
        status: mtMap.objectField('status', mtMap.passthrough()),
        type: mtMap.objectField('type', mtMap.passthrough()),
        config: mtMap.objectField('config', mtMap.passthrough()),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date())
      })
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

