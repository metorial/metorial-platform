import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceSessionsParticipantsListOutput = {
  items: {
    object: 'session.participant';
    id: string;
    type:
      | 'unknown'
      | 'provider'
      | 'mcp_client'
      | 'metorial_protocol_client'
      | 'system'
      | 'tool_call';
    identifier: string;
    name: string;
    data: { identifier: string; name: string };
    providerId: string | null;
    createdAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceSessionsParticipantsListOutput =
  mtMap.object<DashboardInstanceSessionsParticipantsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          type: mtMap.objectField('type', mtMap.passthrough()),
          identifier: mtMap.objectField('identifier', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          data: mtMap.objectField(
            'data',
            mtMap.object({
              identifier: mtMap.objectField('identifier', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough())
            })
          ),
          providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
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

export type DashboardInstanceSessionsParticipantsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  type?:
    | 'unknown'
    | 'provider'
    | 'system'
    | 'tool_call'
    | 'mcp_client'
    | 'metorial_protocol_client'
    | (
        | 'unknown'
        | 'provider'
        | 'system'
        | 'tool_call'
        | 'mcp_client'
        | 'metorial_protocol_client'
      )[]
    | undefined;
  id?: string | string[] | undefined;
  sessionId?: string | string[] | undefined;
  sessionConnectionId?: string | string[] | undefined;
  sessionMessageId?: string | string[] | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
  updatedAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapDashboardInstanceSessionsParticipantsListQuery = mtMap.union([
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
      sessionConnectionId: mtMap.objectField(
        'session_connection_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      sessionMessageId: mtMap.objectField(
        'session_message_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      createdAt: mtMap.objectField(
        'created_at',
        mtMap.object({
          gt: mtMap.objectField('gt', mtMap.date()),
          lt: mtMap.objectField('lt', mtMap.date())
        })
      ),
      updatedAt: mtMap.objectField(
        'updated_at',
        mtMap.object({
          gt: mtMap.objectField('gt', mtMap.date()),
          lt: mtMap.objectField('lt', mtMap.date())
        })
      )
    })
  )
]);

