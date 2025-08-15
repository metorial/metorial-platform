import { mtMap } from '@metorial/util-resource-mapper';

export type CustomServersVersionsCreateOutput = {
  object: 'custom_server.version';
  id: string;
  status: 'upcoming' | 'available' | 'current';
  type: 'remote';
  isCurrent: boolean;
  versionIndex: number;
  versionHash: string;
  serverVersion: {
    object: 'server.server_version#preview';
    id: string;
    identifier: string;
    serverId: string;
    serverVariantId: string;
    source:
      | { type: 'docker'; docker: { image: string; tag: string } }
      | { type: 'remote'; remote: { domain: string } };
    createdAt: Date;
  };
  serverInstance: {
    type: 'remote';
    remoteServer: {
      object: 'custom_server.remote_server';
      id: string;
      name: string | null;
      description: string | null;
      remoteUrl: string;
      connectionId: string | null;
      createdAt: Date;
      updatedAt: Date;
    } | null;
  };
  customServerId: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapCustomServersVersionsCreateOutput =
  mtMap.object<CustomServersVersionsCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    type: mtMap.objectField('type', mtMap.passthrough()),
    isCurrent: mtMap.objectField('is_current', mtMap.passthrough()),
    versionIndex: mtMap.objectField('version_index', mtMap.passthrough()),
    versionHash: mtMap.objectField('version_hash', mtMap.passthrough()),
    serverVersion: mtMap.objectField(
      'server_version',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        identifier: mtMap.objectField('identifier', mtMap.passthrough()),
        serverId: mtMap.objectField('server_id', mtMap.passthrough()),
        serverVariantId: mtMap.objectField(
          'server_variant_id',
          mtMap.passthrough()
        ),
        source: mtMap.objectField(
          'source',
          mtMap.union([
            mtMap.unionOption(
              'object',
              mtMap.object({
                type: mtMap.objectField('type', mtMap.passthrough()),
                docker: mtMap.objectField(
                  'docker',
                  mtMap.object({
                    image: mtMap.objectField('image', mtMap.passthrough()),
                    tag: mtMap.objectField('tag', mtMap.passthrough())
                  })
                ),
                remote: mtMap.objectField(
                  'remote',
                  mtMap.object({
                    domain: mtMap.objectField('domain', mtMap.passthrough())
                  })
                )
              })
            )
          ])
        ),
        createdAt: mtMap.objectField('created_at', mtMap.date())
      })
    ),
    serverInstance: mtMap.objectField(
      'server_instance',
      mtMap.object({
        type: mtMap.objectField('type', mtMap.passthrough()),
        remoteServer: mtMap.objectField(
          'remote_server',
          mtMap.object({
            object: mtMap.objectField('object', mtMap.passthrough()),
            id: mtMap.objectField('id', mtMap.passthrough()),
            name: mtMap.objectField('name', mtMap.passthrough()),
            description: mtMap.objectField('description', mtMap.passthrough()),
            remoteUrl: mtMap.objectField('remote_url', mtMap.passthrough()),
            connectionId: mtMap.objectField(
              'connection_id',
              mtMap.passthrough()
            ),
            createdAt: mtMap.objectField('created_at', mtMap.date()),
            updatedAt: mtMap.objectField('updated_at', mtMap.date())
          })
        )
      })
    ),
    customServerId: mtMap.objectField('custom_server_id', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type CustomServersVersionsCreateBody = {
  name: string;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
  implementation: {
    type: 'remote_server';
    remoteServer: {
      name?: string | undefined;
      description?: string | undefined;
      connectionId?: string | undefined;
      remoteUrl: string;
    };
    config?:
      | { schema?: any | undefined; getLaunchParams?: string | undefined }
      | undefined;
  };
};

export let mapCustomServersVersionsCreateBody =
  mtMap.object<CustomServersVersionsCreateBody>({
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    implementation: mtMap.objectField(
      'implementation',
      mtMap.object({
        type: mtMap.objectField('type', mtMap.passthrough()),
        remoteServer: mtMap.objectField(
          'remote_server',
          mtMap.object({
            name: mtMap.objectField('name', mtMap.passthrough()),
            description: mtMap.objectField('description', mtMap.passthrough()),
            connectionId: mtMap.objectField(
              'connection_id',
              mtMap.passthrough()
            ),
            remoteUrl: mtMap.objectField('remote_url', mtMap.passthrough())
          })
        ),
        config: mtMap.objectField(
          'config',
          mtMap.object({
            schema: mtMap.objectField('schema', mtMap.passthrough()),
            getLaunchParams: mtMap.objectField(
              'getLaunchParams',
              mtMap.passthrough()
            )
          })
        )
      })
    )
  });

