import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstancePortalsConsumerGroupsGetOutput = {
  object: 'consumer.group';
  id: string;
  status: 'active' | 'archived' | 'deleted';
  name: string;
  description: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
} & { isManaged: boolean; isDefaultEveryoneGroup: boolean };

export let mapDashboardInstancePortalsConsumerGroupsGetOutput = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      object: mtMap.objectField('object', mtMap.passthrough()),
      id: mtMap.objectField('id', mtMap.passthrough()),
      status: mtMap.objectField('status', mtMap.passthrough()),
      name: mtMap.objectField('name', mtMap.passthrough()),
      description: mtMap.objectField('description', mtMap.passthrough()),
      isDefault: mtMap.objectField('is_default', mtMap.passthrough()),
      createdAt: mtMap.objectField('created_at', mtMap.date()),
      updatedAt: mtMap.objectField('updated_at', mtMap.date()),
      isManaged: mtMap.objectField('is_managed', mtMap.passthrough()),
      isDefaultEveryoneGroup: mtMap.objectField(
        'is_default_everyone_group',
        mtMap.passthrough()
      )
    })
  )
]);

