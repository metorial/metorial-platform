import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardProjectsKeyProvidersSetDefaultOutput = {
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

export let mapDashboardProjectsKeyProvidersSetDefaultOutput =
  mtMap.object<DashboardProjectsKeyProvidersSetDefaultOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    type: mtMap.objectField('type', mtMap.passthrough()),
    owner: mtMap.objectField('owner', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    isMetorialManaged: mtMap.objectField(
      'is_metorial_managed',
      mtMap.passthrough()
    ),
    keyReuseTimeSeconds: mtMap.objectField(
      'key_reuse_time_seconds',
      mtMap.passthrough()
    ),
    keyInfo: mtMap.objectField('key_info', mtMap.passthrough()),
    isDefault: mtMap.objectField('is_default', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

