import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceCustomServersCreateOutput = {
  object: 'custom_server';
  id: string;
  status: 'active' | 'archived' | 'deleted';
  type: 'remote';
  name: string;
  description: string | null;
  metadata: Record<string, any>;
  server: {
    object: 'server#preview';
    id: string;
    name: string;
    description: string | null;
    type: 'public' | 'custom';
    createdAt: Date;
    updatedAt: Date;
  };
  serverVariant: {
    object: 'server.server_variant#preview';
    id: string;
    identifier: string;
    serverId: string;
    source:
      | { type: 'docker'; docker: { image: string } }
      | { type: 'remote'; remote: { domain: string } };
    createdAt: Date;
  };
  currentServerVersionId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

export let mapDashboardInstanceCustomServersCreateOutput =
  mtMap.object<DashboardInstanceCustomServersCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    type: mtMap.objectField('type', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    server: mtMap.objectField(
      'server',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough()),
        description: mtMap.objectField('description', mtMap.passthrough()),
        type: mtMap.objectField('type', mtMap.passthrough()),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date())
      })
    ),
    serverVariant: mtMap.objectField(
      'server_variant',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        identifier: mtMap.objectField('identifier', mtMap.passthrough()),
        serverId: mtMap.objectField('server_id', mtMap.passthrough()),
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
                    image: mtMap.objectField('image', mtMap.passthrough())
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
    currentServerVersionId: mtMap.objectField(
      'current_server_version_id',
      mtMap.passthrough()
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date()),
    deletedAt: mtMap.objectField('deleted_at', mtMap.date())
  });

export type DashboardInstanceCustomServersCreateBody = {
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

export let mapDashboardInstanceCustomServersCreateBody =
  mtMap.object<DashboardInstanceCustomServersCreateBody>({
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

