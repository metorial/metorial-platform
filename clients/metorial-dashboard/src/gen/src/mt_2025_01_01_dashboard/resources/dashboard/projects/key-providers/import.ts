import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardProjectsKeyProvidersImportOutput = {
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

export let mapDashboardProjectsKeyProvidersImportOutput =
  /* @__PURE__ */ mapObject<DashboardProjectsKeyProvidersImportOutput>(
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

export type DashboardProjectsKeyProvidersImportBody = {
  keyInput: Record<string, any>;
};

export let mapDashboardProjectsKeyProvidersImportBody =
  /* @__PURE__ */ mapObject<DashboardProjectsKeyProvidersImportBody>([
    'key_input'
  ]);
