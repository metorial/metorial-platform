import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceSecretsGetOutput = {
  object: 'secret';
  id: string;
  status: 'active' | 'deleted';
  type: { identifier: string; name: string };
  description: string;
  metadata: Record<string, any>;
  organizationId: string;
  instanceId: string;
  fingerprint: string;
  lastUsedAt: Date | null;
  createdAt: Date;
};

export let mapDashboardInstanceSecretsGetOutput =
  mtMap.object<DashboardInstanceSecretsGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    type: mtMap.objectField(
      'type',
      mtMap.object({
        identifier: mtMap.objectField('identifier', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough())
      })
    ),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    organizationId: mtMap.objectField('organization_id', mtMap.passthrough()),
    instanceId: mtMap.objectField('instance_id', mtMap.passthrough()),
    fingerprint: mtMap.objectField('fingerprint', mtMap.passthrough()),
    lastUsedAt: mtMap.objectField('last_used_at', mtMap.date()),
    createdAt: mtMap.objectField('created_at', mtMap.date())
  });

