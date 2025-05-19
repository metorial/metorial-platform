import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceSessionsServerSessionsListOutput = {
  items: {
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
    server: {
      object: 'server#preview';
      id: string;
      name: string;
      description: string | null;
      type: 'public';
      createdAt: Date;
      updatedAt: Date;
    };
    session: {
      object: 'session#preview';
      id: string;
      status: 'active' | 'deleted';
      connectionStatus: 'connected' | 'disconnected';
      usage: {
        totalProductiveMessageCount: number;
        totalProductiveClientMessageCount: number;
        totalProductiveServerMessageCount: number;
      };
      metadata: Record<string, any>;
      createdAt: Date;
      updatedAt: Date;
    };
    serverDeployment: {
      object: 'server.server_deployment#preview';
      id: string;
      name: string | null;
      description: string | null;
      metadata: Record<string, any>;
      createdAt: Date;
      updatedAt: Date;
    };
    createdAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceSessionsServerSessionsListOutput =
  mtMap.object<DashboardInstanceSessionsServerSessionsListOutput>({
    items: mtMap.objectField(
      'items',
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
                  version: mtMap.objectField('version', mtMap.passthrough()),
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
                  version: mtMap.objectField('version', mtMap.passthrough()),
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
          session: mtMap.objectField(
            'session',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              status: mtMap.objectField('status', mtMap.passthrough()),
              connectionStatus: mtMap.objectField(
                'connection_status',
                mtMap.passthrough()
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
          ),
          serverDeployment: mtMap.objectField(
            'server_deployment',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough()),
              description: mtMap.objectField(
                'description',
                mtMap.passthrough()
              ),
              metadata: mtMap.objectField('metadata', mtMap.passthrough()),
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

export type DashboardInstanceSessionsServerSessionsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapDashboardInstanceSessionsServerSessionsListQuery = mtMap.union([
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

