import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceServerRunsListOutput = {
  items: {
    object: 'server.server_run';
    id: string;
    type: 'hosted' | 'external';
    status: 'active' | 'failed' | 'completed';
    serverVersionId: string;
    serverDeploymentId: string;
    serverSessionId: string;
    sessionId: string;
    createdAt: Date;
    updatedAt: Date;
    startedAt: Date | null;
    stoppedAt: Date | null;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapDashboardInstanceServerRunsListOutput =
  mtMap.object<DashboardInstanceServerRunsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          type: mtMap.objectField('type', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
          serverVersionId: mtMap.objectField(
            'server_version_id',
            mtMap.passthrough()
          ),
          serverDeploymentId: mtMap.objectField(
            'server_deployment_id',
            mtMap.passthrough()
          ),
          serverSessionId: mtMap.objectField(
            'server_session_id',
            mtMap.passthrough()
          ),
          sessionId: mtMap.objectField('session_id', mtMap.passthrough()),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          updatedAt: mtMap.objectField('updated_at', mtMap.date()),
          startedAt: mtMap.objectField('started_at', mtMap.date()),
          stoppedAt: mtMap.objectField('stopped_at', mtMap.date())
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

export type DashboardInstanceServerRunsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  status?:
    | 'active'
    | 'failed'
    | 'completed'
    | ('active' | 'failed' | 'completed')[]
    | undefined;
  serverSessionIds?: string | string[] | undefined;
  serverImplementationIds?: string | string[] | undefined;
  serverDeploymentIds?: string | string[] | undefined;
};

export let mapDashboardInstanceServerRunsListQuery = mtMap.union([
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
      serverSessionIds: mtMap.objectField(
        'server_session_ids',
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

