import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceCustomServersListOutput = {
  items: {
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
    environments: {
      object: 'custom_server.environment';
      id: string;
      status: 'active' | 'archived' | 'deleted';
      type: 'remote';
      name: string;
      instanceId: string;
      customServerId: string;
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
    }[];
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementInstanceCustomServersListOutput =
  mtMap.object<ManagementInstanceCustomServersListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
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
              description: mtMap.objectField(
                'description',
                mtMap.passthrough()
              ),
              type: mtMap.objectField('type', mtMap.passthrough()),
              createdAt: mtMap.objectField('created_at', mtMap.date()),
              updatedAt: mtMap.objectField('updated_at', mtMap.date())
            })
          ),
          environments: mtMap.objectField(
            'environments',
            mtMap.array(
              mtMap.object({
                object: mtMap.objectField('object', mtMap.passthrough()),
                id: mtMap.objectField('id', mtMap.passthrough()),
                status: mtMap.objectField('status', mtMap.passthrough()),
                type: mtMap.objectField('type', mtMap.passthrough()),
                name: mtMap.objectField('name', mtMap.passthrough()),
                instanceId: mtMap.objectField(
                  'instance_id',
                  mtMap.passthrough()
                ),
                customServerId: mtMap.objectField(
                  'custom_server_id',
                  mtMap.passthrough()
                ),
                serverVariant: mtMap.objectField(
                  'server_variant',
                  mtMap.object({
                    object: mtMap.objectField('object', mtMap.passthrough()),
                    id: mtMap.objectField('id', mtMap.passthrough()),
                    identifier: mtMap.objectField(
                      'identifier',
                      mtMap.passthrough()
                    ),
                    serverId: mtMap.objectField(
                      'server_id',
                      mtMap.passthrough()
                    ),
                    source: mtMap.objectField(
                      'source',
                      mtMap.union([
                        mtMap.unionOption(
                          'object',
                          mtMap.object({
                            type: mtMap.objectField(
                              'type',
                              mtMap.passthrough()
                            ),
                            docker: mtMap.objectField(
                              'docker',
                              mtMap.object({
                                image: mtMap.objectField(
                                  'image',
                                  mtMap.passthrough()
                                )
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
                currentServerVersionId: mtMap.objectField(
                  'current_server_version_id',
                  mtMap.passthrough()
                ),
                createdAt: mtMap.objectField('created_at', mtMap.date()),
                updatedAt: mtMap.objectField('updated_at', mtMap.date())
              })
            )
          ),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          updatedAt: mtMap.objectField('updated_at', mtMap.date()),
          deletedAt: mtMap.objectField('deleted_at', mtMap.date())
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

export type ManagementInstanceCustomServersListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapManagementInstanceCustomServersListQuery = mtMap.union([
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

