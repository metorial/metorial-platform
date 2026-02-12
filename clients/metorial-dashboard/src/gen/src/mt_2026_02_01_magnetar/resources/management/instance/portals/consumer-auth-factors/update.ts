import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstancePortalsConsumerAuthFactorsUpdateOutput = {
  object: 'consumer.auth_factor';
  id: string;
  type: 'email_code' | 'sso';
  status: 'active' | 'inactive';
  name: string;
  publicName: string;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstancePortalsConsumerAuthFactorsUpdateOutput =
  mtMap.object<ManagementInstancePortalsConsumerAuthFactorsUpdateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    type: mtMap.objectField('type', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    publicName: mtMap.objectField('publicName', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type ManagementInstancePortalsConsumerAuthFactorsUpdateBody = {
  name?: string | undefined;
  publicName?: string | undefined;
};

export let mapManagementInstancePortalsConsumerAuthFactorsUpdateBody =
  mtMap.object<ManagementInstancePortalsConsumerAuthFactorsUpdateBody>({
    name: mtMap.objectField('name', mtMap.passthrough()),
    publicName: mtMap.objectField('public_name', mtMap.passthrough())
  });

