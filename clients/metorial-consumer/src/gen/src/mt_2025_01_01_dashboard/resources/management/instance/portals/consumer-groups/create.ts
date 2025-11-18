import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstancePortalsConsumerGroupsCreateOutput = {
  object: 'consumer.group';
  id: string;
  status: 'active' | 'inactive';
  name: string;
  description: string | null;
  isDefault: boolean;
  ssoGroupIds: string[];
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstancePortalsConsumerGroupsCreateOutput =
  mtMap.object<ManagementInstancePortalsConsumerGroupsCreateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    status: mtMap.objectField('status', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    isDefault: mtMap.objectField('is_default', mtMap.passthrough()),
    ssoGroupIds: mtMap.objectField(
      'sso_group_ids',
      mtMap.array(mtMap.passthrough())
    ),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type ManagementInstancePortalsConsumerGroupsCreateBody = {
  name: string;
  description?: string | undefined;
  ssoGroupIds?: string[] | undefined;
  isDefault?: boolean | undefined;
};

export let mapManagementInstancePortalsConsumerGroupsCreateBody =
  mtMap.object<ManagementInstancePortalsConsumerGroupsCreateBody>({
    name: mtMap.objectField('name', mtMap.passthrough()),
    description: mtMap.objectField('description', mtMap.passthrough()),
    ssoGroupIds: mtMap.objectField(
      'sso_group_ids',
      mtMap.array(mtMap.passthrough())
    ),
    isDefault: mtMap.objectField('is_default', mtMap.passthrough())
  });

