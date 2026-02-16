import { mtMap } from '@metorial/util-resource-mapper';

export type ServersImplementationsListOutput = {
  items: {
    object: 'server.server_implementation';
    id: string;
    status: 'active' | 'archived' | 'deleted';
    isDefault: boolean;
    isEphemeral: boolean;
    name: string;
    description: string | null;
    metadata: Record<string, any>;
    getLaunchParams: string | null;
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
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapServersImplementationsListOutput =
  mtMap.object<ServersImplementationsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
          isDefault: mtMap.objectField('is_default', mtMap.passthrough()),
          isEphemeral: mtMap.objectField('is_ephemeral', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          description: mtMap.objectField('description', mtMap.passthrough()),
          metadata: mtMap.objectField('metadata', mtMap.passthrough()),
          getLaunchParams: mtMap.objectField(
            'get_launch_params',
            mtMap.passthrough()
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

export type ServersImplementationsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  status?:
    | 'active'
    | 'archived'
    | 'deleted'
    | ('active' | 'archived' | 'deleted')[]
    | undefined;
  serverId?: string | string[] | undefined;
  serverVariantId?: string | string[] | undefined;
  search?: string | undefined;
};

export let mapServersImplementationsListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough()),
      status: mtMap.objectField(
        'status',
        mtMap.union([mtMap.unionOption('array', mtMap.union([]))])
      ),
      serverId: mtMap.objectField(
        'server_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      serverVariantId: mtMap.objectField(
        'server_variant_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      search: mtMap.objectField('search', mtMap.passthrough())
    })
  )
]);

