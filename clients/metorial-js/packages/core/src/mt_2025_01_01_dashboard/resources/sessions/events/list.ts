import { mtMap } from '@metorial/util-resource-mapper';

export type SessionsEventsListOutput = {
  items: {
    object: 'session.event';
    id: string;
    type:
      | 'message'
      | 'error'
      | 'server_run_created'
      | 'server_run_started'
      | 'server_run_stopped'
      | 'client_connected'
      | 'client_disconnected';
    sessionId: string;
    serverRun: {
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
    } | null;
    createdAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapSessionsEventsListOutput = mtMap.object<SessionsEventsListOutput>(
  {
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          type: mtMap.objectField('type', mtMap.passthrough()),
          sessionId: mtMap.objectField('session_id', mtMap.passthrough()),
          serverRun: mtMap.objectField(
            'server_run',
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

export type SessionsEventsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapSessionsEventsListQuery = mtMap.union([
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

