import { mtMap } from '@metorial/util-resource-mapper';

export type SessionsErrorsListOutput = {
  items: {
    object: 'session.error';
    id: string;
    type: string | null;
    name: string | null;
    message: string | null;
    stack: string | null;
    metadata: Record<string, any> | null;
    sessionId: string;
    sessionErrorGroupId: string | null;
    providerRunId: string | null;
    createdAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapSessionsErrorsListOutput = mtMap.object<SessionsErrorsListOutput>(
  {
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          type: mtMap.objectField('type', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          message: mtMap.objectField('message', mtMap.passthrough()),
          stack: mtMap.objectField('stack', mtMap.passthrough()),
          metadata: mtMap.objectField('metadata', mtMap.passthrough()),
          sessionId: mtMap.objectField('session_id', mtMap.passthrough()),
          sessionErrorGroupId: mtMap.objectField(
            'session_error_group_id',
            mtMap.passthrough()
          ),
          providerRunId: mtMap.objectField(
            'provider_run_id',
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
  }
);

export type SessionsErrorsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  type?: string | undefined;
  sessionErrorGroupId?: string | string[] | undefined;
  providerRunId?: string | string[] | undefined;
};

export let mapSessionsErrorsListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough()),
      type: mtMap.objectField('type', mtMap.passthrough()),
      sessionErrorGroupId: mtMap.objectField(
        'session_error_group_id',
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

