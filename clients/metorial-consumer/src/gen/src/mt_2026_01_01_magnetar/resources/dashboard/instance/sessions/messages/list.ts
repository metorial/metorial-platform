import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceSessionsMessagesListOutput = {
  items: {
    object: 'session.message';
    id: string;
    type: string;
    sender: {
      object: 'session.message.sender';
      type: string;
      id: string | null;
    };
    mcpMessage: {
      object: 'session.message.mcp_message';
      id: string;
      originalId: string | null;
      method: string | null;
      payload: Record<string, any>;
    };
    sessionId: string;
    serverSessionId: string;
    createdAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceSessionsMessagesListOutput =
  mtMap.object<DashboardInstanceSessionsMessagesListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          type: mtMap.objectField('type', mtMap.passthrough()),
          sender: mtMap.objectField(
            'sender',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              type: mtMap.objectField('type', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough())
            })
          ),
          mcpMessage: mtMap.objectField(
            'mcp_message',
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              originalId: mtMap.objectField('original_id', mtMap.passthrough()),
              method: mtMap.objectField('method', mtMap.passthrough()),
              payload: mtMap.objectField('payload', mtMap.passthrough())
            })
          ),
          sessionId: mtMap.objectField('session_id', mtMap.passthrough()),
          serverSessionId: mtMap.objectField(
            'server_session_id',
            mtMap.passthrough()
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

export type DashboardInstanceSessionsMessagesListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  type?: string | undefined;
  sessionProviderId?: string | string[] | undefined;
  providerRunId?: string | string[] | undefined;
};

export let mapDashboardInstanceSessionsMessagesListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough()),
      type: mtMap.objectField('type', mtMap.passthrough()),
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
      providerRunId: mtMap.objectField(
        'provider_run_id',
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

