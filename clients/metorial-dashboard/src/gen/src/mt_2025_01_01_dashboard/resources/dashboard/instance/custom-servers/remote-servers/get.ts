import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceCustomServersRemoteServersGetOutput = {
  object: 'custom_server.remote_server';
  id: string;
  remoteUrl: string;
  remoteProtocol: 'sse' | 'streamable_http';
  providerOauth: { config: Record<string, any>; scopes: string[] } | null;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstanceCustomServersRemoteServersGetOutput =
  mtMap.object<DashboardInstanceCustomServersRemoteServersGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    remoteUrl: mtMap.objectField('remote_url', mtMap.passthrough()),
    remoteProtocol: mtMap.objectField('remote_protocol', mtMap.passthrough()),
    providerOauth: mtMap.objectField(
      'provider_oauth',
      mtMap.object({
        config: mtMap.objectField('config', mtMap.passthrough()),
        scopes: mtMap.objectField('scopes', mtMap.array(mtMap.passthrough()))
      })
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

