import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceSessionTemplatesProvidersDeleteOutput = {
  object: 'session.template.provider';
  id: string;
  name: string | null;
  description: string | null;
  metadata: Record<string, any> | null;
  sessionTemplateId: string;
  providerId: string;
  providerDeploymentId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstanceSessionTemplatesProvidersDeleteOutput =
  mtMap.object<DashboardInstanceSessionTemplatesProvidersDeleteOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    sessionTemplateId: mtMap.objectField(
      'session_template_id',
      mtMap.passthrough()
    ),
    providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
    providerDeploymentId: mtMap.objectField(
      'provider_deployment_id',
      mtMap.passthrough()
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

