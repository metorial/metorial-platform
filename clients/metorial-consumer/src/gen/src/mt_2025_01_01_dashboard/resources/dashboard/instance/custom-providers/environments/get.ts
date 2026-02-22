import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceCustomProvidersEnvironmentsGetOutput = {
  object: 'custom_provider.environment';
  id: string;
  customProviderId: string;
  providerId: string | null;
  currentProviderVersionId: string | null;
  instanceId: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstanceCustomProvidersEnvironmentsGetOutput =
  mtMap.object<DashboardInstanceCustomProvidersEnvironmentsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    customProviderId: mtMap.objectField(
      'custom_provider_id',
      mtMap.passthrough()
    ),
    providerId: mtMap.objectField('provider_id', mtMap.passthrough()),
    currentProviderVersionId: mtMap.objectField(
      'current_provider_version_id',
      mtMap.passthrough()
    ),
    instanceId: mtMap.objectField('instance_id', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

