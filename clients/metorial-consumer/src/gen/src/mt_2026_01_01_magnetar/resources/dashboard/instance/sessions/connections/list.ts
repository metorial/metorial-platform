import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceSessionsConnectionsListOutput = {
  items: {
    object: 'session.connection';
    id: string;
    status: string;
    connectionState: string;
    transport: string;
    usage: {
      totalProductiveClientMessageCount: number;
      totalProductiveServerMessageCount: number;
    };
    mcp: {
      capabilities: Record<string, any>;
      protocolVersion: string;
      transport: string;
    } | null;
    sessionId: string;
    participant: {
      object: 'session.participant';
      id: string;
      type: string;
      identifier: string;
      name: string;
      data: Record<string, any>;
      providerId: string | null;
      createdAt: Date;
    } | null;
    hasErrors: boolean;
    hasWarnings: boolean;
    createdAt: Date;
    lastMessageAt: Date;
    lastActiveAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceSessionsConnectionsListOutput =
  mtMap.object<DashboardInstanceSessionsConnectionsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
          connectionState: mtMap.objectField(
            'connection_state',
            mtMap.passthrough()
          ),
          transport: mtMap.objectField('transport', mtMap.passthrough()),
          usage: mtMap.objectField(
            'usage',
            mtMap.object({
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
          mcp: mtMap.objectField(
            'mcp',
            mtMap.object({
              capabilities: mtMap.objectField(
                'capabilities',
                mtMap.passthrough()
              ),
              protocolVersion: mtMap.objectField(
                'protocol_version',
                mtMap.passthrough()
              ),
              transport: mtMap.objectField('transport', mtMap.passthrough())
            })
          ),
          sessionId: mtMap.objectField('session_id', mtMap.passthrough()),
          participant: mtMap.objectField(
            'participant',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              type: mtMap.objectField('type', mtMap.passthrough()),
              identifier: mtMap.objectField('identifier', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough()),
              data: mtMap.objectField('data', mtMap.passthrough()),
              providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
              createdAt: mtMap.objectField('created_at', mtMap.date())
            })
          ),
          hasErrors: mtMap.objectField('has_errors', mtMap.passthrough()),
          hasWarnings: mtMap.objectField('has_warnings', mtMap.passthrough()),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          lastMessageAt: mtMap.objectField('last_message_at', mtMap.date()),
          lastActiveAt: mtMap.objectField('last_active_at', mtMap.date())
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

export type DashboardInstanceSessionsConnectionsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  status?: 'active' | 'archived' | ('active' | 'archived')[] | undefined;
  connectionState?:
    | 'connected'
    | 'disconnected'
    | ('connected' | 'disconnected')[]
    | undefined;
  id?: string | string[] | undefined;
  sessionId?: string | string[] | undefined;
  sessionProviderId?: string | string[] | undefined;
  participantId?: string | string[] | undefined;
};

export let mapDashboardInstanceSessionsConnectionsListQuery = mtMap.union([
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
      connectionState: mtMap.objectField(
        'connection_state',
        mtMap.union([mtMap.unionOption('array', mtMap.union([]))])
      ),
      id: mtMap.objectField(
        'id',
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
      ),
      sessionProviderId: mtMap.objectField(
        'session_provider_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      participantId: mtMap.objectField(
        'participant_id',
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

