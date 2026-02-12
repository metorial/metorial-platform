import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstancePortalsConsumerAuthFactorsCreateOutput = {
  object: 'consumer.auth_factor';
  id: string;
  type: 'email_code' | 'sso';
  status: 'active' | 'inactive';
  name: string;
  publicName: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstancePortalsConsumerAuthFactorsCreateOutput =
  mtMap.object<DashboardInstancePortalsConsumerAuthFactorsCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    type: mtMap.objectField('type', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    publicName: mtMap.objectField('publicName', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type DashboardInstancePortalsConsumerAuthFactorsCreateBody =
  | { type: 'email_code' }
  | { type: 'sso'; ssoTenantId: string };

export let mapDashboardInstancePortalsConsumerAuthFactorsCreateBody =
  mtMap.union([
    mtMap.unionOption(
      'object',
      mtMap.object({
        type: mtMap.objectField('type', mtMap.passthrough()),
        ssoTenantId: mtMap.objectField('sso_tenant_id', mtMap.passthrough())
      })
    )
  ]);

