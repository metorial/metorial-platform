import { mtMap } from '@metorial/util-resource-mapper';

export type CustomServersRemoteServersGetOutput = {
  object: 'custom_server.remote_server';
  id: string;
  remoteUrl: string;
  remoteProtocol: 'sse' | 'streamable_http';
  providerOauth:
    | { type: 'custom' }
    | { type: 'json'; config: Record<string, any>; scopes: string[] }
    | null;
  createdAt: Date;
  updatedAt: Date;
};

export let mapCustomServersRemoteServersGetOutput =
  mtMap.object<CustomServersRemoteServersGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    remoteUrl: mtMap.objectField('remote_url', mtMap.passthrough()),
    remoteProtocol: mtMap.objectField('remote_protocol', mtMap.passthrough()),
    providerOauth: mtMap.objectField(
      'provider_oauth',
      mtMap.union([
        mtMap.unionOption(
          'object',
          mtMap.object({
            type: mtMap.objectField('type', mtMap.passthrough()),
            config: mtMap.objectField('config', mtMap.passthrough()),
            scopes: mtMap.objectField(
              'scopes',
              mtMap.array(mtMap.passthrough())
            )
          })
        )
      ])
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

