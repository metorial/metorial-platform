import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceSessionsConnectionsListOutput = {
  items: {
    object: 'session.connection';
    id: string;
    status: string | null;
    connectionState: string | null;
    mcp: {
      object: 'session.connection.mcp';
      version: string | null;
      connectionType: string | null;
      client: {
        object: 'session.connection.client';
        name?: string | undefined;
        version?: string | undefined;
        capabilities: Record<string, any>;
      } | null;
      server: {
        object: 'session.connection.server';
        name?: string | undefined;
        version?: string | undefined;
        capabilities: Record<string, any>;
      } | null;
    };
    metadata: Record<string, any> | null;
    sessionId: string;
    sessionProviderId: string | null;
    startedAt: Date | null;
    endedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
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
          connectionState: mtMap.objectField('connection_state', mtMap.passthrough()),
          mcp: mtMap.objectField(
            'mcp',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              version: mtMap.objectField('version', mtMap.passthrough()),
              connectionType: mtMap.objectField('connection_type', mtMap.passthrough()),
              client: mtMap.objectField(
                'client',
                mtMap.object({
                  object: mtMap.objectField('object', mtMap.passthrough()),
                  name: mtMap.objectField('name', mtMap.passthrough()),
                  version: mtMap.objectField('version', mtMap.passthrough()),
                  capabilities: mtMap.objectField('capabilities', mtMap.passthrough())
                })
              ),
              server: mtMap.objectField(
                'server',
                mtMap.object({
                  object: mtMap.objectField('object', mtMap.passthrough()),
                  name: mtMap.objectField('name', mtMap.passthrough()),
                  version: mtMap.objectField('version', mtMap.passthrough()),
                  capabilities: mtMap.objectField('capabilities', mtMap.passthrough())
                })
              )
            })
          ),
          metadata: mtMap.objectField('metadata', mtMap.passthrough()),
          sessionId: mtMap.objectField('session_id', mtMap.passthrough()),
          sessionProviderId: mtMap.objectField('session_provider_id', mtMap.passthrough()),
          startedAt: mtMap.objectField('started_at', mtMap.date()),
          endedAt: mtMap.objectField('ended_at', mtMap.date()),
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

export type DashboardInstanceSessionsConnectionsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  status?: string | undefined;
  connectionState?: string | undefined;
  sessionProviderId?: string | string[] | undefined;
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
      status: mtMap.objectField('status', mtMap.passthrough()),
      connectionState: mtMap.objectField('connection_state', mtMap.passthrough()),
      sessionProviderId: mtMap.objectField(
        'session_provider_id',
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
