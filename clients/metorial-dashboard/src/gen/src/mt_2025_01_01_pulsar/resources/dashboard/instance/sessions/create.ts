import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceSessionsCreateOutput = {
  object: 'session';
  id: string;
  status: 'active' | 'deleted';
  connectionStatus: 'connected' | 'disconnected';
  clientSecret: {
    object: 'client_secret';
    type: 'session';
    id: string;
    secret: string;
    expiresAt: Date;
  };
  serverDeployments: {
    object: 'session.server_deployment#preview';
    id: string;
    name: string | null;
    description: string | null;
    metadata: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
    server: {
      object: 'server#preview';
      id: string;
      name: string;
      description: string | null;
      type: 'public';
      createdAt: Date;
      updatedAt: Date;
    };
    connectionUrls: { sse: string; streamableHttp: string; websocket: string };
  }[];
  usage: {
    totalProductiveMessageCount: number;
    totalProductiveClientMessageCount: number;
    totalProductiveServerMessageCount: number;
  };
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstanceSessionsCreateOutput =
  mtMap.object<DashboardInstanceSessionsCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    connectionStatus: mtMap.objectField(
      'connection_status',
      mtMap.passthrough()
    ),
    clientSecret: mtMap.objectField(
      'client_secret',
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        type: mtMap.objectField('type', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        secret: mtMap.objectField('secret', mtMap.passthrough()),
        expiresAt: mtMap.objectField('expires_at', mtMap.date())
      })
    ),
    serverDeployments: mtMap.objectField(
      'server_deployments',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          description: mtMap.objectField('description', mtMap.passthrough()),
          metadata: mtMap.objectField('metadata', mtMap.passthrough()),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          updatedAt: mtMap.objectField('updated_at', mtMap.date()),
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
          connectionUrls: mtMap.objectField(
            'connection_urls',
            mtMap.object({
              sse: mtMap.objectField('sse', mtMap.passthrough()),
              streamableHttp: mtMap.objectField(
                'streamable_http',
                mtMap.passthrough()
              ),
              websocket: mtMap.objectField('websocket', mtMap.passthrough())
            })
          )
        })
      )
    ),
    usage: mtMap.objectField(
      'usage',
      mtMap.object({
        totalProductiveMessageCount: mtMap.objectField(
          'total_productive_message_count',
          mtMap.passthrough()
        ),
        totalProductiveClientMessageCount: mtMap.objectField(
          'total_productive_client_message_count',
          mtMap.passthrough()
        ),
        totalProductiveServerMessageCount: mtMap.objectField(
          'total_productive_server_message_count',
          mtMap.passthrough()
        )
      })
    ),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type DashboardInstanceSessionsCreateBody =
  | {
      serverDeployments: (
        | ({
            name?: string | undefined;
            description?: string | undefined;
            metadata?: Record<string, any> | undefined;
            config: Record<string, any>;
          } & (
            | {
                serverImplementation: {
                  name?: string | undefined;
                  description?: string | undefined;
                  metadata?: Record<string, any> | undefined;
                  getLaunchParams?: string | undefined;
                } & ({ serverId: string } | { serverVariantId: string });
              }
            | { serverImplementationId: string }
            | { serverVariantId: string }
            | { serverId: string }
          ))
        | string
        | { serverDeploymentId: string }
      )[];
    }
  | { serverDeploymentIds: string[] | string };

export let mapDashboardInstanceSessionsCreateBody = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      serverDeployments: mtMap.objectField(
        'server_deployments',
        mtMap.array(
          mtMap.union([
            mtMap.unionOption(
              'object',
              mtMap.object({
                name: mtMap.objectField('name', mtMap.passthrough()),
                description: mtMap.objectField(
                  'description',
                  mtMap.passthrough()
                ),
                metadata: mtMap.objectField('metadata', mtMap.passthrough()),
                config: mtMap.objectField('config', mtMap.passthrough()),
                serverImplementation: mtMap.objectField(
                  'server_implementation',
                  mtMap.union([
                    mtMap.unionOption(
                      'object',
                      mtMap.object({
                        name: mtMap.objectField('name', mtMap.passthrough()),
                        description: mtMap.objectField(
                          'description',
                          mtMap.passthrough()
                        ),
                        metadata: mtMap.objectField(
                          'metadata',
                          mtMap.passthrough()
                        ),
                        getLaunchParams: mtMap.objectField(
                          'get_launch_params',
                          mtMap.passthrough()
                        ),
                        serverId: mtMap.objectField(
                          'server_id',
                          mtMap.passthrough()
                        ),
                        serverVariantId: mtMap.objectField(
                          'server_variant_id',
                          mtMap.passthrough()
                        )
                      })
                    )
                  ])
                ),
                serverImplementationId: mtMap.objectField(
                  'server_implementation_id',
                  mtMap.passthrough()
                ),
                serverVariantId: mtMap.objectField(
                  'server_variant_id',
                  mtMap.passthrough()
                ),
                serverId: mtMap.objectField('server_id', mtMap.passthrough()),
                serverDeploymentId: mtMap.objectField(
                  'server_deployment_id',
                  mtMap.passthrough()
                )
              })
            ),
            mtMap.unionOption('string', mtMap.passthrough())
          ])
        )
      ),
      serverDeploymentIds: mtMap.objectField(
        'server_deployment_ids',
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

