import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceServerRunErrorsGetOutput = {
  object: 'server.server_run.error';
  id: string;
  code: string;
  message: string;
  metadata: Record<string, any>;
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
  };
  createdAt: Date;
};

export let mapManagementInstanceServerRunErrorsGetOutput =
  mtMap.object<ManagementInstanceServerRunErrorsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    code: mtMap.objectField('code', mtMap.passthrough()),
    message: mtMap.objectField('message', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
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
  });

