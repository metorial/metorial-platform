import { mtMap } from '@metorial/util-resource-mapper';

export type ServersDeploymentsListOutput = {
  items: {
    object: 'server.server_deployment';
    id: string;
    status: 'active' | 'archived' | 'deleted';
    name: string;
    description: string | null;
    oauthConnection: {
      object: 'provider_oauth.connection';
      id: string;
      status: 'active' | 'archived';
      name: string;
      description: string | null;
      metadata: Record<string, any>;
      provider: { id: string; name: string; url: string; imageUrl: string };
      config: Record<string, any>;
      scopes: string[];
      clientId: string;
      instanceId: string;
      templateId: string | null;
      createdAt: Date;
      updatedAt: Date;
    } | null;
    result:
      | { status: 'active' }
      | { status: 'pending'; step: 'oauth_discovery' }
      | { status: 'failed'; code: string; message: string };
    metadata: Record<string, any>;
    secretId: string;
    server: {
      object: 'server#preview';
      id: string;
      name: string;
      description: string | null;
      type: 'public' | 'custom';
      createdAt: Date;
      updatedAt: Date;
    };
    config: {
      object: 'server.server_deployment.config';
      id: string;
      status: 'active' | 'inactive';
      secretId: string;
      createdAt: Date;
    };
    serverImplementation: {
      object: 'server.server_implementation';
      id: string;
      status: 'active' | 'archived' | 'deleted';
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
    };
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapServersDeploymentsListOutput =
  mtMap.object<ServersDeploymentsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          description: mtMap.objectField('description', mtMap.passthrough()),
          oauthConnection: mtMap.objectField(
            'oauth_connection',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              status: mtMap.objectField('status', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough()),
              description: mtMap.objectField(
                'description',
                mtMap.passthrough()
              ),
              metadata: mtMap.objectField('metadata', mtMap.passthrough()),
              provider: mtMap.objectField(
                'provider',
                mtMap.object({
                  id: mtMap.objectField('id', mtMap.passthrough()),
                  name: mtMap.objectField('name', mtMap.passthrough()),
                  url: mtMap.objectField('url', mtMap.passthrough()),
                  imageUrl: mtMap.objectField('image_url', mtMap.passthrough())
                })
              ),
              config: mtMap.objectField('config', mtMap.passthrough()),
              scopes: mtMap.objectField(
                'scopes',
                mtMap.array(mtMap.passthrough())
              ),
              clientId: mtMap.objectField('client_id', mtMap.passthrough()),
              instanceId: mtMap.objectField('instance_id', mtMap.passthrough()),
              templateId: mtMap.objectField('template_id', mtMap.passthrough()),
              createdAt: mtMap.objectField('created_at', mtMap.date()),
              updatedAt: mtMap.objectField('updated_at', mtMap.date())
            })
          ),
          result: mtMap.objectField(
            'result',
            mtMap.union([
              mtMap.unionOption(
                'object',
                mtMap.object({
                  status: mtMap.objectField('status', mtMap.passthrough()),
                  step: mtMap.objectField('step', mtMap.passthrough()),
                  code: mtMap.objectField('code', mtMap.passthrough()),
                  message: mtMap.objectField('message', mtMap.passthrough())
                })
              )
            ])
          ),
          metadata: mtMap.objectField('metadata', mtMap.passthrough()),
          secretId: mtMap.objectField('secret_id', mtMap.passthrough()),
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
          config: mtMap.objectField(
            'config',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              status: mtMap.objectField('status', mtMap.passthrough()),
              secretId: mtMap.objectField('secret_id', mtMap.passthrough()),
              createdAt: mtMap.objectField('created_at', mtMap.date())
            })
          ),
          serverImplementation: mtMap.objectField(
            'server_implementation',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              status: mtMap.objectField('status', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough()),
              description: mtMap.objectField(
                'description',
                mtMap.passthrough()
              ),
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

export type ServersDeploymentsListQuery = {
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
    | 'failed'
    | ('active' | 'archived' | 'deleted' | 'failed')[]
    | undefined;
  serverId?: string | string[] | undefined;
  serverVariantId?: string | string[] | undefined;
  serverImplementationId?: string | string[] | undefined;
  sessionId?: string | string[] | undefined;
};

export let mapServersDeploymentsListQuery = mtMap.union([
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
      serverImplementationId: mtMap.objectField(
        'server_implementation_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      sessionId: mtMap.objectField(
        'session_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      )
    })
  )
]);

