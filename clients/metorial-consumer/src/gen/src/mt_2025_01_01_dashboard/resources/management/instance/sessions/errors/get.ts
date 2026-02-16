import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceSessionsErrorsGetOutput = {
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
};

export let mapManagementInstanceSessionsErrorsGetOutput =
  mtMap.object<ManagementInstanceSessionsErrorsGetOutput>({
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
    providerRunId: mtMap.objectField('provider_run_id', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date())
  });

