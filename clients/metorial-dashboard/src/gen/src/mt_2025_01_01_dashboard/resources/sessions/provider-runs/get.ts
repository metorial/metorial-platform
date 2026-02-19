import { mtMap } from '@metorial/util-resource-mapper';

export type SessionsProviderRunsGetOutput = {
  object: 'session.provider_run';
  id: string;
  status: string | null;
  name: string | null;
  description: string | null;
  metadata: Record<string, any> | null;
  sessionId: string;
  sessionProviderId: string | null;
  providerId: string | null;
  providerDeploymentId: string | null;
  providerVersionId: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export let mapSessionsProviderRunsGetOutput = mtMap.object<SessionsProviderRunsGetOutput>({
  object: mtMap.objectField('object', mtMap.passthrough()),
  id: mtMap.objectField('id', mtMap.passthrough()),
  status: mtMap.objectField('status', mtMap.passthrough()),
  name: mtMap.objectField('name', mtMap.passthrough()),
  description: mtMap.objectField('description', mtMap.passthrough()),
  metadata: mtMap.objectField('metadata', mtMap.passthrough()),
  sessionId: mtMap.objectField('session_id', mtMap.passthrough()),
  sessionProviderId: mtMap.objectField('session_provider_id', mtMap.passthrough()),
  providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
  providerDeploymentId: mtMap.objectField('provider_deployment_id', mtMap.passthrough()),
  providerVersionId: mtMap.objectField('provider_version_id', mtMap.passthrough()),
  startedAt: mtMap.objectField('started_at', mtMap.date()),
  completedAt: mtMap.objectField('completed_at', mtMap.date()),
  createdAt: mtMap.objectField('created_at', mtMap.date()),
  updatedAt: mtMap.objectField('updated_at', mtMap.date())
});
