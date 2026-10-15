import { mapObject } from '@metorial/util-resource-mapper/compact';

export type ManagementInstanceCustomProvidersEnvironmentsGetOutput = {
  object: 'custom_provider.environment';
  id: string;
  customProviderId: string;
  providerId: string | null;
  currentProviderVersionId: string | null;
  instanceId: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstanceCustomProvidersEnvironmentsGetOutput =
  /* @__PURE__ */ mapObject<ManagementInstanceCustomProvidersEnvironmentsGetOutput>(
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
