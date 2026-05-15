import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceStoresGetOutput = {
  object: 'store';
  id: string;
  name: string;
  access: 'private' | 'public_read' | 'public_write';
  itemCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstanceStoresGetOutput =
  mtMap.object<DashboardInstanceStoresGetOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    access: mtMap.objectField('access', mtMap.passthrough()),
    itemCount: mtMap.objectField('item_count', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

