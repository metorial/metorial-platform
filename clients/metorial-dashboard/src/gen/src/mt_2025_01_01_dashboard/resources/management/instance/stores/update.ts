import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementInstanceStoresUpdateOutput = {
  object: 'store';
  id: string;
  name: string;
  access: 'private' | 'public_read' | 'public_write';
  itemCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export let mapManagementInstanceStoresUpdateOutput =
  mtMap.object<ManagementInstanceStoresUpdateOutput>({
    object: mtMap.objectField('object', mtMap.passthrough()),
    id: mtMap.objectField('id', mtMap.passthrough()),
    name: mtMap.objectField('name', mtMap.passthrough()),
    access: mtMap.objectField('access', mtMap.passthrough()),
    itemCount: mtMap.objectField('item_count', mtMap.passthrough()),
    createdAt: mtMap.objectField('created_at', mtMap.date()),
    updatedAt: mtMap.objectField('updated_at', mtMap.date())
  });

export type ManagementInstanceStoresUpdateBody = {
  name?: string | undefined;
  access?: 'private' | 'public_read' | 'public_write' | undefined;
};

export let mapManagementInstanceStoresUpdateBody =
  mtMap.object<ManagementInstanceStoresUpdateBody>({
    name: mtMap.objectField('name', mtMap.passthrough()),
    access: mtMap.objectField('access', mtMap.passthrough())
  });

