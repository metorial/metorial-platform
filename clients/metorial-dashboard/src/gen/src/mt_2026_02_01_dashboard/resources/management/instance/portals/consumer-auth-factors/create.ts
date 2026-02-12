import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstancePortalsConsumerAuthFactorsCreateOutput = {
  object: 'consumer.auth_factor';
  id: string;
  type: 'email_code' | 'sso';
  status: 'active' | 'inactive';
  name: string;
  publicName: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstancePortalsConsumerAuthFactorsCreateOutput =
  mtMap.object<ManagementInstancePortalsConsumerAuthFactorsCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    type: mtMap.objectField('type', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    publicName: mtMap.objectField('publicName', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type ManagementInstancePortalsConsumerAuthFactorsCreateBody =
  | { type: 'email_code' }
  | { type: 'sso'; ssoTenantId: string };

export let mapManagementInstancePortalsConsumerAuthFactorsCreateBody =
  mtMap.union([
    mtMap.unionOption(
      'object',
      mtMap.object({
        type: mtMap.objectField('type', mtMap.passthrough()),
        ssoTenantId: mtMap.objectField('sso_tenant_id', mtMap.passthrough())
      })
    )
  ]);

