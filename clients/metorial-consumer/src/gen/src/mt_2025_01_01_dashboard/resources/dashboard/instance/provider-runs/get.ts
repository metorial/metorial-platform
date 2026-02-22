import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceProviderRunsGetOutput = {
  object: 'session.provider_run';
  id: string;
  status: string;
  sessionId: string;
  sessionProviderId: string;
  providerId: string;
  connectionId: string;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstanceProviderRunsGetOutput =
  mtMap.object<DashboardInstanceProviderRunsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    sessionId: mtMap.objectField('session_id', mtMap.passthrough()),
    sessionProviderId: mtMap.objectField(
      'session_provider_id',
      mtMap.passthrough()
    ),
    providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
    connectionId: mtMap.objectField('connection_id', mtMap.passthrough()),
    completedAt: mtMap.objectField('completed_at', mtMap.date()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

