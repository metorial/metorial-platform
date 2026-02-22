import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceSessionsErrorsGetOutput = {
  object: 'session.error';
  id: string;
  code: string;
  message: string;
  data: Record<string, any>;
  sessionId: string;
  providerRunId: string | null;
  connectionId: string | null;
  groupId: string;
  similarErrorCount: number;
  createdAt: Date;
};

export let mapManagementInstanceSessionsErrorsGetOutput =
  mtMap.object<ManagementInstanceSessionsErrorsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    code: mtMap.objectField('code', mtMap.passthrough()),
    message: mtMap.objectField('message', mtMap.passthrough()),
    data: mtMap.objectField('data', mtMap.passthrough()),
    sessionId: mtMap.objectField('session_id', mtMap.passthrough()),
    providerRunId: mtMap.objectField('provider_run_id', mtMap.passthrough()),
    connectionId: mtMap.objectField('connection_id', mtMap.passthrough()),
    groupId: mtMap.objectField('group_id', mtMap.passthrough()),
    similarErrorCount: mtMap.objectField(
      'similar_error_count',
      mtMap.passthrough()
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date())
  });

