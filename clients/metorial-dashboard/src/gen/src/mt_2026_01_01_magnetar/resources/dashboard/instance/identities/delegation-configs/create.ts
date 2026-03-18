import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceIdentitiesDelegationConfigsCreateOutput = {
  object: 'identity.delegation_config';
  id: string;
  status: 'active' | 'archived' | 'deleted';
  isDefault: boolean;
  name: string | null;
  description: string | null;
  metadata: Record<string, any> | null;
  subDelegationBehavior: 'allow' | 'deny' | 'require_consent';
  subDelegationDepth: number;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstanceIdentitiesDelegationConfigsCreateOutput =
  mtMap.object<DashboardInstanceIdentitiesDelegationConfigsCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    isDefault: mtMap.objectField('is_default', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    subDelegationBehavior: mtMap.objectField(
      'sub_delegation_behavior',
      mtMap.passthrough()
    ),
    subDelegationDepth: mtMap.objectField(
      'sub_delegation_depth',
      mtMap.passthrough()
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type DashboardInstanceIdentitiesDelegationConfigsCreateBody = {
  name?: string | undefined;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
  subDelegationBehavior: 'allow' | 'deny' | 'require_consent';
  subDelegationDepth?: number | undefined;
};

export let mapDashboardInstanceIdentitiesDelegationConfigsCreateBody =
  mtMap.object<DashboardInstanceIdentitiesDelegationConfigsCreateBody>({
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    metadata: mtMap.objectField('metadata', mtMap.passthrough()),
    subDelegationBehavior: mtMap.objectField(
      'sub_delegation_behavior',
      mtMap.passthrough()
    ),
    subDelegationDepth: mtMap.objectField(
      'sub_delegation_depth',
      mtMap.passthrough()
    )
  });

