import {
  createMapper,
  mapObject
} from '@metorial/util-resource-mapper/compact';

export type DashboardProjectsKeyProvidersCreateManagedOutput = {
  object: 'key_provider';
  id: string;
  name: string;
  type: 'aws_kms' | 'local';
  owner: 'tenant' | 'system';
  status: 'active' | 'inactive' | 'degraded';
  isMetorialManaged: boolean;
  keyReuseTimeSeconds: number | null;
  keyInfo: Record<string, any>;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardProjectsKeyProvidersCreateManagedOutput =
  /* @__PURE__ */ mapObject<DashboardProjectsKeyProvidersCreateManagedOutput>(
    [
      'is_metorial_managed',
      'key_reuse_time_seconds',
      'key_info',
      'is_default',
      'created_at',
      'updated_at'
    ],
    1
  );

export type DashboardProjectsKeyProvidersCreateManagedBody = { name: string };

export let mapDashboardProjectsKeyProvidersCreateManagedBody =
  /* @__PURE__ */ createMapper<DashboardProjectsKeyProvidersCreateManagedBody>(
    0
  );
