import { mtMap } from '@metorial/util-resource-mapper';

export type DashboardInstanceStoresUpdateOutput = {
  object: 'store';
  id: string;
  name: string;
  access: 'private' | 'public_read' | 'public_write';
  itemCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export let mapDashboardInstanceStoresUpdateOutput =
  mtMap.object<DashboardInstanceStoresUpdateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    access: mtMap.objectField('access', mtMap.passthrough()),
    itemCount: mtMap.objectField('item_count', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type DashboardInstanceStoresUpdateBody = {
  name?: string | undefined;
  access?: 'private' | 'public_read' | 'public_write' | undefined;
};

export let mapDashboardInstanceStoresUpdateBody =
  mtMap.object<DashboardInstanceStoresUpdateBody>({
    name: mtMap.objectField('name', mtMap.passthrough()),
    access: mtMap.objectField('access', mtMap.passthrough())
  });

