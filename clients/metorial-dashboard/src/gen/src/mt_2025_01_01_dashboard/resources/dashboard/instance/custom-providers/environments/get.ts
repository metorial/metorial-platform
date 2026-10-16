import { mapObject } from '@metorial/util-resource-mapper/compact';

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
  /* @__PURE__ */ mapObject<DashboardInstanceCustomProvidersEnvironmentsGetOutput>(
    [
      'custom_provider_id',
      'provider_id',
      'current_provider_version_id',
      'instance_id',
      'created_at',
      'updated_at'
    ],
    1
  );
