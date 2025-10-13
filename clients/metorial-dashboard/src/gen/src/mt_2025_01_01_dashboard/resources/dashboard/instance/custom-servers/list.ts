import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceCustomServersListOutput = {
  items: ({
    object: 'custom_server';
    id: string;
    status: 'active' | 'archived' | 'deleted';
    type: 'remote' | 'managed';
    publicationStatus: 'public' | 'private';
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
    currentVersionId: string | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
  } & {
    fork: { status: 'disabled' } | { status: 'enabled'; templateId: string };
    repository: {
      object: 'scm.repo';
      id: string;
      name: string;
      owner: string;
      url: string;
      defaultBranch: string;
      createdAt: Date;
      updatedAt: Date;
    } | null;
  })[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceCustomServersListOutput =
  mtMap.object<DashboardInstanceCustomServersListOutput>({
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
              publicationStatus: mtMap.objectField(
                'publication_status',
                mtMap.passthrough()
              ),
              name: mtMap.objectField('name', mtMap.passthrough()),
              description: mtMap.objectField(
                'description',
                mtMap.passthrough()
              ),
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
              serverVariant: mtMap.objectField(
                'server_variant',
                mtMap.object({
                  object: mtMap.objectField('object', mtMap.passthrough()),
                  id: mtMap.objectField('id', mtMap.passthrough()),
                  identifier: mtMap.objectField(
                    'identifier',
                    mtMap.passthrough()
                  ),
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
              currentVersionId: mtMap.objectField(
                'current_version_id',
                mtMap.passthrough()
              ),
              createdAt: mtMap.objectField('created_at', mtMap.date()),
              updatedAt: mtMap.objectField('updated_at', mtMap.date()),
              deletedAt: mtMap.objectField('deleted_at', mtMap.date()),
              fork: mtMap.objectField(
                'fork',
                mtMap.union([
                  mtMap.unionOption(
                    'object',
                    mtMap.object({
                      status: mtMap.objectField('status', mtMap.passthrough()),
                      templateId: mtMap.objectField(
                        'template_id',
                        mtMap.passthrough()
                      )
                    })
                  )
                ])
              ),
              repository: mtMap.objectField(
                'repository',
                mtMap.object({
                  object: mtMap.objectField('object', mtMap.passthrough()),
                  id: mtMap.objectField('id', mtMap.passthrough()),
                  name: mtMap.objectField('name', mtMap.passthrough()),
                  owner: mtMap.objectField('owner', mtMap.passthrough()),
                  url: mtMap.objectField('url', mtMap.passthrough()),
                  defaultBranch: mtMap.objectField(
                    'default_branch',
                    mtMap.passthrough()
                  ),
                  createdAt: mtMap.objectField('created_at', mtMap.date()),
                  updatedAt: mtMap.objectField('updated_at', mtMap.date())
                })
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

export type DashboardInstanceCustomServersListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & { type?: ('remote' | 'managed')[] | 'remote' | 'managed' | undefined };

export let mapDashboardInstanceCustomServersListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough()),
      type: mtMap.objectField(
        'type',
        mtMap.union([mtMap.unionOption('array', mtMap.union([]))])
      )
    })
  )
]);

