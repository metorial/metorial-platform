import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceSessionsEventsGetOutput = {
  object: 'session.event';
  id: string;
  type: string | null;
  name: string | null;
  message: string | null;
  data: Record<string, any> | null;
  metadata: Record<string, any> | null;
  sessionId: string;
  sessionProviderId: string | null;
  providerRunId: string | null;
  createdAt: Date;
};

export let mapManagementInstanceSessionsEventsGetOutput =
  mtMap.object<ManagementInstanceSessionsEventsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    type: mtMap.objectField('type', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    message: mtMap.objectField('message', mtMap.passthrough()),
    data: mtMap.objectField('data', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    sessionId: mtMap.objectField('session_id', mtMap.passthrough()),
    sessionProviderId: mtMap.objectField('session_provider_id', mtMap.passthrough()),
    providerRunId: mtMap.objectField('provider_run_id', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date())
  });
