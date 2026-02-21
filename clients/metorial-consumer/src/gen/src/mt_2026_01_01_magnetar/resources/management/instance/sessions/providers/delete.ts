import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceSessionsProvidersDeleteOutput = {
  object: 'session.provider';
  id: string;
  name: string | null;
  description: string | null;
  status: string | null;
  metadata: Record<string, any> | null;
  sessionId: string;
  providerId: string;
  providerDeploymentId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstanceSessionsProvidersDeleteOutput =
  mtMap.object<ManagementInstanceSessionsProvidersDeleteOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    sessionId: mtMap.objectField('session_id', mtMap.passthrough()),
    providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
    providerDeploymentId: mtMap.objectField(
      'provider_deployment_id',
      mtMap.passthrough()
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

