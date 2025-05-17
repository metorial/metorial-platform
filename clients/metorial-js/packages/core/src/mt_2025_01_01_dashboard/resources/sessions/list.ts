import { mtMap } from '@metorial/util-resource-mapper';

export type SessionsListOutput = {
  items: {
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
      object: 'server.server_deployment#preview';
      id: string;
      status: 'active' | 'archived' | 'deleted';
      name: string;
      description: string | null;
      metadata: Record<string, any>;
      secretId: string;
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
      updatedAt: Date;
    }[];
    serverSessions: {
      object: 'session.server_session';
      id: string;
      status: 'active';
      mcp: {
        object: 'mcp';
        version: string;
        connectionType: 'sse' | 'streamable_http' | 'websocket';
        client: {
          object: 'session.server_session.client';
          name: string;
          version: string;
          capabilities: Record<string, any>;
        } | null;
        server: {
          object: 'session.server_session.server';
          name: string;
          version: string;
          capabilities: Record<string, any>;
        } | null;
      };
      usage: {
        totalProductiveMessageCount: number;
        totalProductiveClientMessageCount: number;
        totalProductiveServerMessageCount: number;
      };
      serverDeploymentId: string;
      sessionId: string;
      createdAt: Date;
    }[];
    usage: {
      totalProductiveMessageCount: number;
      totalProductiveClientMessageCount: number;
      totalProductiveServerMessageCount: number;
    };
    metadata: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapSessionsListOutput = mtMap.object<SessionsListOutput>({
  items: mtMap.objectField(
    'items',
    mtMap.array(
      mtMap.object({
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
              status: mtMap.objectField('status', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough()),
              description: mtMap.objectField(
                'description',
                mtMap.passthrough()
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
              createdAt: mtMap.objectField('created_at', mtMap.date()),
              updatedAt: mtMap.objectField('updated_at', mtMap.date())
            })
          )
        ),
        serverSessions: mtMap.objectField(
          'server_sessions',
          mtMap.array(
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              status: mtMap.objectField('status', mtMap.passthrough()),
              mcp: mtMap.objectField(
                'mcp',
                mtMap.object({
                  object: mtMap.objectField('object', mtMap.passthrough()),
                  version: mtMap.objectField('version', mtMap.passthrough()),
                  connectionType: mtMap.objectField(
                    'connection_type',
                    mtMap.passthrough()
                  ),
                  client: mtMap.objectField(
                    'client',
                    mtMap.object({
                      object: mtMap.objectField('object', mtMap.passthrough()),
                      name: mtMap.objectField('name', mtMap.passthrough()),
                      version: mtMap.objectField(
                        'version',
                        mtMap.passthrough()
                      ),
                      capabilities: mtMap.objectField(
                        'capabilities',
                        mtMap.passthrough()
                      )
                    })
                  ),
                  server: mtMap.objectField(
                    'server',
                    mtMap.object({
                      object: mtMap.objectField('object', mtMap.passthrough()),
                      name: mtMap.objectField('name', mtMap.passthrough()),
                      version: mtMap.objectField(
                        'version',
                        mtMap.passthrough()
                      ),
                      capabilities: mtMap.objectField(
                        'capabilities',
                        mtMap.passthrough()
                      )
                    })
                  )
                })
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
              serverDeploymentId: mtMap.objectField(
                'server_deployment_id',
                mtMap.passthrough()
              ),
              sessionId: mtMap.objectField('session_id', mtMap.passthrough()),
              createdAt: mtMap.objectField('created_at', mtMap.date())
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
      })
    )
  ),
  pagination: mtMap.objectField(
    'pagination',
    mtMap.object({
      hasMoreBefore: mtMap.objectField('has_more_before', mtMap.passthrough()),
      hasMoreAfter: mtMap.objectField('has_more_after', mtMap.passthrough())
    })
  )
});

export type SessionsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  status?: 'active' | 'deleted' | ('active' | 'deleted')[] | undefined;
  serverIds?: string | string[] | undefined;
  serverVariantIds?: string | string[] | undefined;
  serverImplementationIds?: string | string[] | undefined;
  serverDeploymentIds?: string | string[] | undefined;
};

export let mapSessionsListQuery = mtMap.union([
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
      serverIds: mtMap.objectField(
        'server_ids',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      serverVariantIds: mtMap.objectField(
        'server_variant_ids',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      serverImplementationIds: mtMap.objectField(
        'server_implementation_ids',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
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

