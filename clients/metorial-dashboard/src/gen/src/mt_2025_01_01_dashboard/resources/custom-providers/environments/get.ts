import { mapObject } from '@metorial/util-resource-mapper/compact';

export type CustomProvidersEnvironmentsGetOutput = {
  object: 'custom_provider.environment';
  id: string;
  customProviderId: string;
  providerId: string | null;
  currentProviderVersionId: string | null;
  instanceId: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapCustomProvidersEnvironmentsGetOutput =
  /* @__PURE__ */ mapObject<CustomProvidersEnvironmentsGetOutput>(
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
