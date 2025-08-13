import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceCustomServersVersionsListOutput = {
  items: {
    object: 'custom_server.version';
    id: string;
    status: 'upcoming' | 'available' | 'current';
    type: 'remote';
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
    environmentId: string;
    instanceId: string;
    customServerId: string;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceCustomServersVersionsListOutput =
  mtMap.object<DashboardInstanceCustomServersVersionsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
          type: mtMap.objectField('type', mtMap.passthrough()),
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
                          image: mtMap.objectField(
                            'image',
                            mtMap.passthrough()
                          ),
                          tag: mtMap.objectField('tag', mtMap.passthrough())
                        })
                      ),
                      remote: mtMap.objectField(
                        'remote',
                        mtMap.object({
                          domain: mtMap.objectField(
                            'domain',
                            mtMap.passthrough()
                          )
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
                  description: mtMap.objectField(
                    'description',
                    mtMap.passthrough()
                  ),
                  remoteUrl: mtMap.objectField(
                    'remote_url',
                    mtMap.passthrough()
                  ),
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
          environmentId: mtMap.objectField(
            'environment_id',
            mtMap.passthrough()
          ),
          instanceId: mtMap.objectField('instance_id', mtMap.passthrough()),
          customServerId: mtMap.objectField(
            'custom_server_id',
            mtMap.passthrough()
          ),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          updatedAt: mtMap.objectField('updated_at', mtMap.date())
        })
      )
    ),
    pagination: mtMap.objectField(
      'pagination',
      mtMap.object({
        hasMoreBefore: mtMap.objectField(
          'has_more_before',
          mtMap.passthrough()
        ),
        hasMoreAfter: mtMap.objectField('has_more_after', mtMap.passthrough())
      })
    )
  });

export type DashboardInstanceCustomServersVersionsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapDashboardInstanceCustomServersVersionsListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough())
    })
  )
]);

