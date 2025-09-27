import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceCustomServersVersionsListOutput = {
  items: ({
    object: 'custom_server.version';
    id: string;
    status: 'available' | 'current' | 'deploying' | 'deployment_failed';
    type: 'remote';
    isCurrent: boolean;
    versionIndex: number;
    serverVersion: {
      object: 'server.server_version';
      id: string;
      identifier: string;
      serverId: string;
      serverVariantId: string;
      getLaunchParams: string;
      source:
        | { type: 'docker'; docker: { image: string; tag: string } }
        | { type: 'remote'; remote: { domain: string } };
      schema: Record<string, any>;
      server: {
        object: 'server#preview';
        id: string;
        name: string;
        description: string | null;
        type: 'public' | 'custom';
        createdAt: Date;
        updatedAt: Date;
      };
      createdAt: Date;
    } | null;
    serverInstance: {
      type: 'remote';
      remoteServer: {
        object: 'custom_server.remote_server';
        id: string;
        remoteUrl: string;
        providerOauth: { config: Record<string, any>; scopes: string[] } | null;
        createdAt: Date;
        updatedAt: Date;
      } | null;
      managedServer: {
        object: 'custom_server.managed_server';
        id: string;
        providerOauth: { config: Record<string, any>; scopes: string[] } | null;
        createdAt: Date;
        updatedAt: Date;
      } | null;
    };
    customServerId: string;
    createdAt: Date;
    updatedAt: Date;
  } & { versionHash: string; deploymentId: string | null })[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementInstanceCustomServersVersionsListOutput =
  mtMap.object<ManagementInstanceCustomServersVersionsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.union([
          mtMap.unionOption(
            'object',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              status: mtMap.objectField('status', mtMap.passthrough()),
              type: mtMap.objectField('type', mtMap.passthrough()),
              isCurrent: mtMap.objectField('is_current', mtMap.passthrough()),
              versionIndex: mtMap.objectField(
                'version_index',
                mtMap.passthrough()
              ),
              serverVersion: mtMap.objectField(
                'server_version',
                mtMap.object({
                  object: mtMap.objectField('object', mtMap.passthrough()),
                  id: mtMap.objectField('id', mtMap.passthrough()),
                  identifier: mtMap.objectField(
                    'identifier',
                    mtMap.passthrough()
                  ),
                  serverId: mtMap.objectField('server_id', mtMap.passthrough()),
                  serverVariantId: mtMap.objectField(
                    'server_variant_id',
                    mtMap.passthrough()
                  ),
                  getLaunchParams: mtMap.objectField(
                    'get_launch_params',
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
                  schema: mtMap.objectField('schema', mtMap.passthrough()),
                  server: mtMap.objectField(
                    'server',
                    mtMap.object({
                      object: mtMap.objectField('object', mtMap.passthrough()),
                      id: mtMap.objectField('id', mtMap.passthrough()),
                      name: mtMap.objectField('name', mtMap.passthrough()),
                      description: mtMap.objectField(
                        'description',
                        mtMap.passthrough()
                      ),
                      type: mtMap.objectField('type', mtMap.passthrough()),
                      createdAt: mtMap.objectField('created_at', mtMap.date()),
                      updatedAt: mtMap.objectField('updated_at', mtMap.date())
                    })
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
                      remoteUrl: mtMap.objectField(
                        'remote_url',
                        mtMap.passthrough()
                      ),
                      providerOauth: mtMap.objectField(
                        'provider_oauth',
                        mtMap.object({
                          config: mtMap.objectField(
                            'config',
                            mtMap.passthrough()
                          ),
                          scopes: mtMap.objectField(
                            'scopes',
                            mtMap.array(mtMap.passthrough())
                          )
                        })
                      ),
                      createdAt: mtMap.objectField('created_at', mtMap.date()),
                      updatedAt: mtMap.objectField('updated_at', mtMap.date())
                    })
                  ),
                  managedServer: mtMap.objectField(
                    'managed_server',
                    mtMap.object({
                      object: mtMap.objectField('object', mtMap.passthrough()),
                      id: mtMap.objectField('id', mtMap.passthrough()),
                      providerOauth: mtMap.objectField(
                        'provider_oauth',
                        mtMap.object({
                          config: mtMap.objectField(
                            'config',
                            mtMap.passthrough()
                          ),
                          scopes: mtMap.objectField(
                            'scopes',
                            mtMap.array(mtMap.passthrough())
                          )
                        })
                      ),
                      createdAt: mtMap.objectField('created_at', mtMap.date()),
                      updatedAt: mtMap.objectField('updated_at', mtMap.date())
                    })
                  )
                })
              ),
              customServerId: mtMap.objectField(
                'custom_server_id',
                mtMap.passthrough()
              ),
              createdAt: mtMap.objectField('created_at', mtMap.date()),
              updatedAt: mtMap.objectField('updated_at', mtMap.date()),
              versionHash: mtMap.objectField(
                'version_hash',
                mtMap.passthrough()
              ),
              deploymentId: mtMap.objectField(
                'deployment_id',
                mtMap.passthrough()
              )
            })
          )
        ])
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

export type ManagementInstanceCustomServersVersionsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapManagementInstanceCustomServersVersionsListQuery = mtMap.union([
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

