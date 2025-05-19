import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceServersVersionsListOutput = {
  items: {
    object: 'server.server_version';
    id: string;
    identifier: string;
    serverId: string;
    serverVariantId: string;
    getLaunchParams: string;
    source:
      | { type: 'docker'; docker: { image: string; tag: string } }
      | { type: 'remote'; remote: { domain: string } };
    schema: {
      id: string;
      fingerprint: string;
      schema: Record<string, any>;
      serverId: string;
      serverVariantId: string;
      serverVersionId: string;
      createdAt: Date;
    };
    server: {
      object: 'server#preview';
      id: string;
      name: string;
      description: string | null;
      type: 'public';
      createdAt: Date;
      updatedAt: Date;
    };
    createdAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementInstanceServersVersionsListOutput =
  mtMap.object<ManagementInstanceServersVersionsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          identifier: mtMap.objectField('identifier', mtMap.passthrough()),
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
          schema: mtMap.objectField(
            'schema',
            mtMap.object({
              id: mtMap.objectField('id', mtMap.passthrough()),
              fingerprint: mtMap.objectField(
                'fingerprint',
                mtMap.passthrough()
              ),
              schema: mtMap.objectField('schema', mtMap.passthrough()),
              serverId: mtMap.objectField('server_id', mtMap.passthrough()),
              serverVariantId: mtMap.objectField(
                'server_variant_id',
                mtMap.passthrough()
              ),
              serverVersionId: mtMap.objectField(
                'server_version_id',
                mtMap.passthrough()
              ),
              createdAt: mtMap.objectField('created_at', mtMap.date())
            })
          ),
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

export type ManagementInstanceServersVersionsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & { variantId?: string | undefined };

export let mapManagementInstanceServersVersionsListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough()),
      variantId: mtMap.objectField('variant_id', mtMap.passthrough())
    })
  )
]);

